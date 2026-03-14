import mysql, { Pool, RowDataPacket } from 'mysql2/promise';
import { BaseAdapter } from './base';
import { Schema, Table, Column, Index, ForeignKey } from '../types';

export class MySQLAdapter extends BaseAdapter {
  private pool: Pool | null = null;

  async connect(): Promise<void> {
    this.pool = mysql.createPool({
      host: this.config.host || 'localhost',
      port: this.config.port || 3306,
      database: this.config.database,
      user: this.config.user,
      password: this.config.password,
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

    const [rows] = await this.pool.query<RowDataPacket[]>(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = ? 
        AND TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_NAME
    `, [this.config.database]);

    const tables: Table[] = [];
    for (const row of rows) {
      const tableName = row.TABLE_NAME;
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

    const [rows] = await this.pool.query<RowDataPacket[]>(`
      SELECT 
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
        AND TABLE_NAME = ?
      ORDER BY ORDINAL_POSITION
    `, [this.config.database, tableName]);

    return rows.map((row: any) => ({
      name: row.COLUMN_NAME,
      type: row.DATA_TYPE,
      nullable: row.IS_NULLABLE === 'YES',
      defaultValue: row.COLUMN_DEFAULT,
      isPrimaryKey: row.COLUMN_KEY === 'PRI',
      isForeignKey: row.COLUMN_KEY === 'MUL',
    }));
  }

  protected async getIndexes(tableName: string): Promise<Index[]> {
    if (!this.pool) throw new Error('Not connected');

    const [rows] = await this.pool.query<RowDataPacket[]>(`
      SHOW INDEX FROM \`${tableName}\`
    `, []);

    const indexMap = new Map<string, { name: string; columns: string[]; isUnique: boolean }>();

    for (const row of rows as any[]) {
      if (!indexMap.has(row.Key_name)) {
        indexMap.set(row.Key_name, {
          name: row.Key_name,
          columns: [],
          isUnique: row.Non_unique === 0,
        });
      }
      indexMap.get(row.Key_name)!.columns.push(row.Column_name);
    }

    return Array.from(indexMap.values());
  }

  protected async getForeignKeys(tableName: string): Promise<ForeignKey[]> {
    if (!this.pool) throw new Error('Not connected');

    const [rows] = await this.pool.query<RowDataPacket[]>(`
      SELECT 
        CONSTRAINT_NAME,
        COLUMN_NAME,
        REFERENCED_TABLE_NAME,
        REFERENCED_COLUMN_NAME
      FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = ? 
        AND TABLE_NAME = ?
        AND REFERENCED_TABLE_NAME IS NOT NULL
    `, [this.config.database, tableName]);

    const fkMap = new Map<string, ForeignKey>();

    for (const row of rows as any) {
      if (!fkMap.has(row.CONSTRAINT_NAME)) {
        fkMap.set(row.CONSTRAINT_NAME, {
          name: row.CONSTRAINT_NAME,
          columns: [],
          referencedTable: row.REFERENCED_TABLE_NAME,
          referencedColumns: [],
        });
      }
      fkMap.get(row.CONSTRAINT_NAME)!.columns.push(row.COLUMN_NAME);
      fkMap.get(row.CONSTRAINT_NAME)!.referencedColumns.push(row.REFERENCED_COLUMN_NAME);
    }

    return Array.from(fkMap.values());
  }
}
