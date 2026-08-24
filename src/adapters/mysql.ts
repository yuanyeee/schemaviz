import mysql, { Pool, RowDataPacket } from 'mysql2/promise';
import { BaseAdapter } from './base';
import { Schema, Column, Index, ForeignKey } from '../types';
import { isLengthType, isPrecisionType } from '../core/columnType';

export class MySQLAdapter extends BaseAdapter {
  private pool: Pool | null = null;

  async connect(): Promise<void> {
    this.pool = mysql.createPool({
      host: this.config.host || 'localhost',
      port: this.config.port || 3306,
      database: this.config.database,
      user: this.config.user,
      password: this.config.password,
      connectionLimit: 5,
      waitForConnections: true,
      connectTimeout: 10000,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
    });

    // Test connection
    const connection = await this.pool.getConnection();
    connection.release();
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }

  async getDatabases(): Promise<string[]> {
    if (!this.pool) throw new Error('Not connected');
    const [rows] = await this.pool.query<RowDataPacket[]>(`
      SELECT SCHEMA_NAME FROM information_schema.SCHEMATA
      WHERE SCHEMA_NAME NOT IN ('information_schema', 'mysql', 'performance_schema', 'sys')
      ORDER BY SCHEMA_NAME
    `);
    return rows.map((r) => r.SCHEMA_NAME as string);
  }

  async getTableNames(): Promise<string[]> {
    if (!this.pool) throw new Error('Not connected');
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `
      SELECT TABLE_NAME
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = ?
        AND TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_NAME
    `,
      [this.config.database],
    );
    return rows.map((r) => r.TABLE_NAME as string);
  }

  async extractSchema(): Promise<Schema> {
    if (!this.pool) {
      throw new Error('Not connected to database');
    }

    const tables = await this.buildTables(await this.getTableNames());

    return {
      database: this.config.database,
      type: 'mysql',
      tables,
      generatedAt: new Date().toISOString(),
    };
  }

  async extractSchemaForTables(tableNames: string[]): Promise<Schema> {
    if (!this.pool) throw new Error('Not connected');
    return {
      database: this.config.database,
      type: 'mysql',
      tables: await this.buildTables(tableNames),
      generatedAt: new Date().toISOString(),
    };
  }

  // T3.2: all metadata is fetched for every requested table in ONE query per
  // category (was 3 queries per table). Rows arrive ordered by table name and
  // ordinal position, so grouping in encounter order preserves column order.
  protected async getColumnsForTables(tableNames: string[]): Promise<Map<string, Column[]>> {
    const map = new Map<string, Column[]>();
    if (tableNames.length === 0) return map;
    if (!this.pool) throw new Error('Not connected');

    const [rows] = await this.pool.query<RowDataPacket[]>(
      `
      SELECT
        TABLE_NAME,
        COLUMN_NAME,
        DATA_TYPE,
        COLUMN_DEFAULT,
        IS_NULLABLE,
        COLUMN_KEY,
        CHARACTER_MAXIMUM_LENGTH,
        NUMERIC_PRECISION,
        NUMERIC_SCALE,
        EXTRA
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ?
        AND TABLE_NAME IN (?)
      ORDER BY TABLE_NAME, ORDINAL_POSITION
    `,
      [this.config.database, tableNames],
    );

    // CHARACTER_MAXIMUM_LENGTH is only meaningful for character/binary types,
    // and NUMERIC_PRECISION/SCALE only for exact numerics (integers report them too).
    for (const row of rows) {
      const column: Column = {
        name: row.COLUMN_NAME,
        type: row.DATA_TYPE,
        nullable: row.IS_NULLABLE === 'YES',
        defaultValue: row.COLUMN_DEFAULT ?? undefined,
        isPrimaryKey: row.COLUMN_KEY === 'PRI',
        isForeignKey: row.COLUMN_KEY === 'MUL',
        length:
          isLengthType(row.DATA_TYPE) && row.CHARACTER_MAXIMUM_LENGTH != null
            ? row.CHARACTER_MAXIMUM_LENGTH
            : undefined,
        precision:
          isPrecisionType(row.DATA_TYPE) && row.NUMERIC_PRECISION != null
            ? row.NUMERIC_PRECISION
            : undefined,
        scale:
          isPrecisionType(row.DATA_TYPE) && row.NUMERIC_SCALE != null
            ? row.NUMERIC_SCALE
            : undefined,
      };
      const list = map.get(row.TABLE_NAME as string);
      if (list) list.push(column);
      else map.set(row.TABLE_NAME as string, [column]);
    }
    return map;
  }

  protected async getIndexesForTables(tableNames: string[]): Promise<Map<string, Index[]>> {
    const map = new Map<string, Index[]>();
    if (tableNames.length === 0) return map;
    if (!this.pool) throw new Error('Not connected');

    // information_schema.STATISTICS carries the same data as SHOW INDEX
    // (Key_name/Non_unique/Column_name, ordered by SEQ_IN_INDEX) but can be
    // queried for all tables at once.
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `
      SELECT
        TABLE_NAME,
        INDEX_NAME AS Key_name,
        NON_UNIQUE AS Non_unique,
        COLUMN_NAME AS Column_name
      FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = ?
        AND TABLE_NAME IN (?)
      ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX
    `,
      [this.config.database, tableNames],
    );

    const perTable = new Map<string, Map<string, Index>>();
    for (const row of rows) {
      const tableName = row.TABLE_NAME as string;
      let byIndex = perTable.get(tableName);
      if (!byIndex) {
        byIndex = new Map<string, Index>();
        perTable.set(tableName, byIndex);
      }
      let idx = byIndex.get(row.Key_name);
      if (!idx) {
        idx = { name: row.Key_name, columns: [], isUnique: row.Non_unique === 0 };
        byIndex.set(row.Key_name, idx);
      }
      idx.columns.push(row.Column_name);
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

    const [rows] = await this.pool.query<RowDataPacket[]>(
      `
      SELECT
        TABLE_NAME,
        CONSTRAINT_NAME,
        COLUMN_NAME,
        REFERENCED_TABLE_NAME,
        REFERENCED_COLUMN_NAME
      FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = ?
        AND TABLE_NAME IN (?)
        AND REFERENCED_TABLE_NAME IS NOT NULL
      ORDER BY TABLE_NAME, CONSTRAINT_NAME, ORDINAL_POSITION
    `,
      [this.config.database, tableNames],
    );

    const perTable = new Map<string, Map<string, ForeignKey>>();
    for (const row of rows) {
      const tableName = row.TABLE_NAME as string;
      let byFk = perTable.get(tableName);
      if (!byFk) {
        byFk = new Map<string, ForeignKey>();
        perTable.set(tableName, byFk);
      }
      let fk = byFk.get(row.CONSTRAINT_NAME);
      if (!fk) {
        fk = {
          name: row.CONSTRAINT_NAME,
          columns: [],
          referencedTable: row.REFERENCED_TABLE_NAME,
          referencedColumns: [],
        };
        byFk.set(row.CONSTRAINT_NAME, fk);
      }
      fk.columns.push(row.COLUMN_NAME);
      fk.referencedColumns.push(row.REFERENCED_COLUMN_NAME);
    }
    for (const [tableName, byFk] of perTable) {
      map.set(tableName, Array.from(byFk.values()));
    }
    return map;
  }
}
