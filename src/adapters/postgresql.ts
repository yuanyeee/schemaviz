import { Pool, PoolClient } from 'pg';
import { BaseAdapter } from './base';
import { Schema, Table, Column, Index, ForeignKey } from '../types';

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

  async extractSchema(): Promise<Schema> {
    if (!this.pool) {
      throw new Error('Not connected to database');
    }

    const tables = await this.getTables();

    return {
      database: this.config.database,
      tables,
      generatedAt: new Date().toISOString(),
    };
  }

  protected async getTables(): Promise<Table[]> {
    if (!this.pool) throw new Error('Not connected');

    const result = await this.pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    const tables: Table[] = [];
    for (const row of result.rows) {
      const tableName = row.table_name;
      const columns = await this.getColumns(tableName);
      const indexes = await this.getIndexes(tableName);
      const foreignKeys = await this.getForeignKeys(tableName);

      tables.push({
        name: tableName,
        columns,
        indexes,
        foreignKeys,
      });
    }

    return tables;
  }

  protected async getColumns(tableName: string): Promise<Column[]> {
    if (!this.pool) throw new Error('Not connected');

    const result = await this.pool.query(`
      SELECT 
        c.column_name,
        c.data_type,
        c.column_default,
        c.is_nullable,
        c.character_maximum_length,
        c.numeric_precision,
        c.numeric_scale,
        CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END as is_primary_key
      FROM information_schema.columns c
      LEFT JOIN (
        SELECT ku.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage ku 
          ON tc.constraint_name = ku.constraint_name
        WHERE tc.table_name = $1 
          AND tc.constraint_type = 'PRIMARY KEY'
      ) pk ON c.column_name = pk.column_name
      WHERE c.table_name = $1 
        AND c.table_schema = 'public'
      ORDER BY c.ordinal_position
    `, [tableName]);

    const primaryKeys = new Set(
      result.rows.filter((r: any) => r.is_primary_key).map((r: any) => r.column_name)
    );

    // Get foreign key columns
    const fkResult = await this.pool.query(`
      SELECT kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
      WHERE tc.table_name = $1 
        AND tc.constraint_type = 'FOREIGN KEY'
    `, [tableName]);

    const foreignKeys = new Set(fkResult.rows.map((r: any) => r.column_name));

    return result.rows.map((row: any) => ({
      name: row.column_name,
      type: row.data_type,
      nullable: row.is_nullable === 'YES',
      defaultValue: row.column_default,
      isPrimaryKey: primaryKeys.has(row.column_name),
      isForeignKey: foreignKeys.has(row.column_name),
    }));
  }

  protected async getIndexes(tableName: string): Promise<Index[]> {
    if (!this.pool) throw new Error('Not connected');

    const result = await this.pool.query(`
      SELECT 
        i.relname as index_name,
        a.attname as column_name,
        ix.indisunique as is_unique
      FROM pg_class t
      JOIN pg_index ix ON t.oid = ix.indrelid
      JOIN pg_class i ON i.oid = ix.indexrelid
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
      WHERE t.relname = $1
      ORDER BY i.relname, a.attnum
    `, [tableName]);

    const indexMap = new Map<string, { name: string; columns: string[]; isUnique: boolean }>();

    for (const row of result.rows) {
      if (!indexMap.has(row.index_name)) {
        indexMap.set(row.index_name, {
          name: row.index_name,
          columns: [],
          isUnique: row.is_unique,
        });
      }
      indexMap.get(row.index_name)!.columns.push(row.column_name);
    }

    return Array.from(indexMap.values());
  }

  protected async getForeignKeys(tableName: string): Promise<ForeignKey[]> {
    if (!this.pool) throw new Error('Not connected');

    const result = await this.pool.query(`
      SELECT
        tc.constraint_name as fk_name,
        kcu.column_name as column_name,
        ccu.table_name AS referenced_table,
        ccu.column_name AS referenced_column
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage ccu
        ON tc.constraint_name = ccu.constraint_name
      WHERE tc.table_name = $1 
        AND tc.constraint_type = 'FOREIGN KEY'
    `, [tableName]);

    const fkMap = new Map<string, ForeignKey>();

    for (const row of result.rows) {
      if (!fkMap.has(row.fk_name)) {
        fkMap.set(row.fk_name, {
          name: row.fk_name,
          columns: [],
          referencedTable: row.referenced_table,
          referencedColumns: [],
        });
      }
      fkMap.get(row.fk_name)!.columns.push(row.column_name);
      fkMap.get(row.fk_name)!.referencedColumns.push(row.referenced_column);
    }

    return Array.from(fkMap.values());
  }
}
