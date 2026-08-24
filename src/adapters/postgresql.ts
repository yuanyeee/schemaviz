import { Pool } from 'pg';
import { BaseAdapter } from './base';
import { Schema, Column, Index, ForeignKey } from '../types';
import { isLengthType, isPrecisionType } from '../core/columnType';

export class PostgreSQLAdapter extends BaseAdapter {
  private pool: Pool | null = null;

  async connect(): Promise<void> {
    this.pool = new Pool({
      host: this.config.host || 'localhost',
      port: this.config.port || 5432,
      database: this.config.database,
      user: this.config.user,
      password: this.config.password,
      max: 1,
    });

    // Test connection
    const client = await this.pool.connect();
    client.release();
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }

  async getDatabases(): Promise<string[]> {
    if (!this.pool) throw new Error('Not connected');
    const result = await this.pool.query(`
      SELECT datname FROM pg_database
      WHERE datistemplate = false AND datname NOT IN ('postgres')
      ORDER BY datname
    `);
    return result.rows.map((r: { datname: string }) => r.datname);
  }

  async getTableNames(): Promise<string[]> {
    if (!this.pool) throw new Error('Not connected');
    const result = await this.pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    return result.rows.map((r: { table_name: string }) => r.table_name);
  }

  async extractSchema(): Promise<Schema> {
    if (!this.pool) {
      throw new Error('Not connected to database');
    }

    const tables = await this.buildTables(await this.getTableNames());

    return {
      database: this.config.database,
      type: 'postgresql',
      tables,
      generatedAt: new Date().toISOString(),
    };
  }

  async extractSchemaForTables(tableNames: string[]): Promise<Schema> {
    if (!this.pool) throw new Error('Not connected');
    return {
      database: this.config.database,
      type: 'postgresql',
      tables: await this.buildTables(tableNames),
      generatedAt: new Date().toISOString(),
    };
  }

  // T3.2: all metadata is fetched for every requested table in ONE query per
  // category (was 4 queries per table). Rows arrive ordered by table name and
  // ordinal position, so grouping in encounter order preserves column order.
  protected async getColumnsForTables(tableNames: string[]): Promise<Map<string, Column[]>> {
    const map = new Map<string, Column[]>();
    if (tableNames.length === 0) return map;
    if (!this.pool) throw new Error('Not connected');

    const result = await this.pool.query(
      `
      SELECT
        c.table_name,
        c.column_name,
        c.data_type,
        c.column_default,
        c.is_nullable,
        c.character_maximum_length,
        c.numeric_precision,
        c.numeric_scale,
        CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END as is_primary_key,
        CASE WHEN fk.column_name IS NOT NULL THEN true ELSE false END as is_foreign_key
      FROM information_schema.columns c
      LEFT JOIN (
        SELECT ku.table_name, ku.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage ku
          ON tc.constraint_name = ku.constraint_name
         AND tc.table_name = ku.table_name
        WHERE tc.table_name = ANY($1)
          AND tc.table_schema = 'public'
          AND tc.constraint_type = 'PRIMARY KEY'
      ) pk ON c.table_name = pk.table_name AND c.column_name = pk.column_name
      LEFT JOIN (
        SELECT kcu.table_name, kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
         AND tc.table_name = kcu.table_name
        WHERE tc.table_name = ANY($1)
          AND tc.table_schema = 'public'
          AND tc.constraint_type = 'FOREIGN KEY'
      ) fk ON c.table_name = fk.table_name AND c.column_name = fk.column_name
      WHERE c.table_name = ANY($1)
        AND c.table_schema = 'public'
      ORDER BY c.table_name, c.ordinal_position
    `,
      [tableNames],
    );

    // information_schema reports numeric_precision for integer types too, so
    // length is kept only for character/binary types and precision/scale only
    // for exact numerics.
    interface ColumnRow {
      table_name: string;
      column_name: string;
      data_type: string;
      is_nullable: string;
      column_default: string | null;
      character_maximum_length: number | null;
      numeric_precision: number | null;
      numeric_scale: number | null;
      is_primary_key: boolean;
      is_foreign_key: boolean;
    }
    for (const row of result.rows as ColumnRow[]) {
      const column: Column = {
        name: row.column_name,
        type: row.data_type,
        nullable: row.is_nullable === 'YES',
        defaultValue: row.column_default ?? undefined,
        isPrimaryKey: row.is_primary_key,
        isForeignKey: row.is_foreign_key,
        length:
          isLengthType(row.data_type) && row.character_maximum_length != null
            ? row.character_maximum_length
            : undefined,
        precision:
          isPrecisionType(row.data_type) && row.numeric_precision != null
            ? row.numeric_precision
            : undefined,
        scale:
          isPrecisionType(row.data_type) && row.numeric_scale != null
            ? row.numeric_scale
            : undefined,
      };
      const list = map.get(row.table_name);
      if (list) list.push(column);
      else map.set(row.table_name, [column]);
    }
    return map;
  }

  protected async getIndexesForTables(tableNames: string[]): Promise<Map<string, Index[]>> {
    const map = new Map<string, Index[]>();
    if (tableNames.length === 0) return map;
    if (!this.pool) throw new Error('Not connected');

    const result = await this.pool.query(
      `
      SELECT
        t.relname as table_name,
        i.relname as index_name,
        a.attname as column_name,
        ix.indisunique as is_unique
      FROM pg_class t
      JOIN pg_namespace n ON n.oid = t.relnamespace
      JOIN pg_index ix ON t.oid = ix.indrelid
      JOIN pg_class i ON i.oid = ix.indexrelid
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
      WHERE t.relname = ANY($1)
        AND n.nspname = 'public'
      ORDER BY t.relname, i.relname, a.attnum
    `,
      [tableNames],
    );

    interface IndexRow {
      table_name: string;
      index_name: string;
      column_name: string;
      is_unique: boolean;
    }
    // Index name -> accumulated index, per table
    const perTable = new Map<string, Map<string, Index>>();
    for (const row of result.rows as IndexRow[]) {
      let byIndex = perTable.get(row.table_name);
      if (!byIndex) {
        byIndex = new Map<string, Index>();
        perTable.set(row.table_name, byIndex);
      }
      let idx = byIndex.get(row.index_name);
      if (!idx) {
        idx = { name: row.index_name, columns: [], isUnique: row.is_unique };
        byIndex.set(row.index_name, idx);
      }
      idx.columns.push(row.column_name);
    }
    for (const [tableName, byIndex] of perTable) {
      map.set(tableName, Array.from(byIndex.values()));
    }
    return map;
  }

  protected async getForeignKeysForTables(
    tableNames: string[],
  ): Promise<Map<string, ForeignKey[]>> {
    const map = new Map<string, ForeignKey[]>();
    if (tableNames.length === 0) return map;
    if (!this.pool) throw new Error('Not connected');

    const result = await this.pool.query(
      `
      SELECT
        tc.table_name,
        tc.constraint_name as fk_name,
        kcu.column_name as column_name,
        ccu.table_name AS referenced_table,
        ccu.column_name AS referenced_column
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
       AND tc.table_name = kcu.table_name
      JOIN information_schema.constraint_column_usage ccu
        ON tc.constraint_name = ccu.constraint_name
      WHERE tc.table_name = ANY($1)
        AND tc.table_schema = 'public'
        AND tc.constraint_type = 'FOREIGN KEY'
    `,
      [tableNames],
    );

    interface FkRow {
      table_name: string;
      fk_name: string;
      column_name: string;
      referenced_table: string;
      referenced_column: string;
    }
    const perTable = new Map<string, Map<string, ForeignKey>>();
    for (const row of result.rows as FkRow[]) {
      let byFk = perTable.get(row.table_name);
      if (!byFk) {
        byFk = new Map<string, ForeignKey>();
        perTable.set(row.table_name, byFk);
      }
      let fk = byFk.get(row.fk_name);
      if (!fk) {
        fk = {
          name: row.fk_name,
          columns: [],
          referencedTable: row.referenced_table,
          referencedColumns: [],
        };
        byFk.set(row.fk_name, fk);
      }
      fk.columns.push(row.column_name);
      fk.referencedColumns.push(row.referenced_column);
    }
    for (const [tableName, byFk] of perTable) {
      map.set(tableName, Array.from(byFk.values()));
    }
    return map;
  }
}
