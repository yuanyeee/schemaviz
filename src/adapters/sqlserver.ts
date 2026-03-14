import mssql, { Pool } from 'mssql';
import { BaseAdapter } from './base';
import { Schema, Table, Column, Index, ForeignKey } from '../types';

export class SQLServerAdapter extends BaseAdapter {
  private pool: Pool | null = null;

  async connect(): Promise<void> {
    const config: mssql.config = {
      server: this.config.host || 'localhost',
      port: this.config.port || 1433,
      database: this.config.database,
      user: this.config.user,
      password: this.config.password,
      options: {
        encrypt: false,
        trustServerCertificate: true,
      },
    };

    try {
      this.pool = await mssql.connect(config);
    } catch (err: any) {
      throw new Error(`Failed to connect to ${this.config.host}:${this.config.port} - ${err.message}`);
    }
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.close();
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
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_TYPE = 'BASE TABLE'
        AND TABLE_SCHEMA = 'dbo'
      ORDER BY TABLE_NAME
    `);

    const tables: Table[] = [];
    for (const row of result.recordset) {
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

    const result = await this.pool.query(`
      SELECT 
        c.COLUMN_NAME,
        c.DATA_TYPE,
        c.COLUMN_DEFAULT,
        c.IS_NULLABLE,
        c.CHARACTER_MAXIMUM_LENGTH,
        c.NUMERIC_PRECISION,
        c.NUMERIC_SCALE,
        CASE WHEN pk.COLUMN_NAME IS NOT NULL THEN 1 ELSE 0 END as IS_PRIMARY_KEY
      FROM information_schema.COLUMNS c
      LEFT JOIN (
        SELECT ku.TABLE_NAME, ku.COLUMN_NAME
        FROM information_schema.TABLE_CONSTRAINTS tc
        JOIN information_schema.KEY_COLUMN_USAGE ku 
          ON tc.CONSTRAINT_NAME = ku.CONSTRAINT_NAME
        WHERE tc.TABLE_SCHEMA = 'dbo' 
          AND tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
          AND ku.TABLE_NAME = @tableName
      ) pk ON c.TABLE_NAME = pk.TABLE_NAME AND c.COLUMN_NAME = pk.COLUMN_NAME
      WHERE c.TABLE_SCHEMA = 'dbo' 
        AND c.TABLE_NAME = @tableName
      ORDER BY c.ORDINAL_POSITION
    `, { tableName });

    // Get foreign key columns
    const fkResult = await this.pool.query(`
      SELECT ku.COLUMN_NAME
      FROM information_schema.TABLE_CONSTRAINTS tc
      JOIN information_schema.KEY_COLUMN_USAGE ku 
        ON tc.CONSTRAINT_NAME = ku.CONSTRAINT_NAME
      WHERE tc.TABLE_SCHEMA = 'dbo' 
        AND tc.TABLE_NAME = @tableName
        AND tc.CONSTRAINT_TYPE = 'FOREIGN KEY'
    `, { tableName });

    const foreignKeys = new Set(fkResult.recordset.map((r: any) => r.COLUMN_NAME));

    return result.recordset.map((row: any) => ({
      name: row.COLUMN_NAME,
      type: row.DATA_TYPE,
      nullable: row.IS_NULLABLE === 'YES',
      defaultValue: row.COLUMN_DEFAULT,
      isPrimaryKey: row.IS_PRIMARY_KEY === 1,
      isForeignKey: foreignKeys.has(row.COLUMN_NAME),
    }));
  }

  protected async getIndexes(tableName: string): Promise<Index[]> {
    if (!this.pool) throw new Error('Not connected');

    const result = await this.pool.query(`
      SELECT 
        i.name as index_name,
        COL_NAME(ic.object_id, ic.column_id) as column_name,
        i.is_unique
      FROM sys.indexes i
      JOIN sys.index_columns ic 
        ON i.object_id = ic.object_id AND i.index_id = ic.index_id
      WHERE OBJECT_NAME(i.object_id) = @tableName
        AND i.is_primary_key = 0
      ORDER BY i.name, ic.key_ordinal
    `, { tableName });

    const indexMap = new Map<string, { name: string; columns: string[]; isUnique: boolean }>();

    for (const row of result.recordset) {
      if (!indexMap.has(row.index_name)) {
        indexMap.set(row.index_name, {
          name: row.index_name,
          columns: [],
          isUnique: row.is_unique,
        });
      }
      if (row.column_name) {
        indexMap.get(row.index_name)!.columns.push(row.column_name);
      }
    }

    return Array.from(indexMap.values());
  }

  protected async getForeignKeys(tableName: string): Promise<ForeignKey[]> {
    if (!this.pool) throw new Error('Not connected');

    const result = await this.pool.query(`
      SELECT 
        fk.name as fk_name,
        cp.name as column_name,
        tr.name as referenced_table,
        cr.name as referenced_column
      FROM sys.foreign_keys fk
      JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
      JOIN sys.columns cp ON fkc.parent_object_id = cp.object_id AND fkc.parent_column_id = cp.column_id
      JOIN sys.columns cr ON fkc.referenced_object_id = cr.object_id AND fkc.referenced_column_id = cr.column_id
      JOIN sys.tables tr ON fkc.referenced_object_id = tr.object_id
      WHERE fk.parent_object_id = OBJECT_ID(@tableName)
      ORDER BY fk.name, fkc.constraint_column_id
    `, { tableName });

    const fkMap = new Map<string, ForeignKey>();

    for (const row of result.recordset) {
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
