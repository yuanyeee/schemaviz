import initSqlJs, { Database } from 'sql.js';
import * as fs from 'fs';
import * as path from 'path';
import { BaseAdapter } from './base';
import { Schema, Table, Column, Index, ForeignKey } from '../types';

export class SQLiteAdapter extends BaseAdapter {
  private db: Database | null = null;

  async connect(): Promise<void> {
    if (!this.config.filename) {
      throw new Error('SQLite requires a filename');
    }
    
    const SQL = await initSqlJs();
    
    // Check if file exists
    if (fs.existsSync(this.config.filename)) {
      const buffer = fs.readFileSync(this.config.filename);
      this.db = new SQL.Database(buffer);
    } else {
      this.db = new SQL.Database();
    }
  }

  async disconnect(): Promise<void> {
    if (this.db) {
      // Save database to file before closing
      if (this.config.filename) {
        const data = this.db.export();
        const buffer = Buffer.from(data);
        fs.writeFileSync(this.config.filename, buffer);
      }
      this.db.close();
      this.db = null;
    }
  }

  async extractSchema(): Promise<Schema> {
    if (!this.db) {
      throw new Error('Not connected to database');
    }

    const tables = await this.getTables();

    return {
      database: this.config.filename || 'sqlite',
      tables,
      generatedAt: new Date().toISOString(),
    };
  }

  protected async getTables(): Promise<Table[]> {
    if (!this.db) throw new Error('Not connected');

    const result = this.db.exec(`
      SELECT name 
      FROM sqlite_master 
      WHERE type = 'table' 
        AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `);

    if (result.length === 0) return [];

    const tableNames = result[0].values.map((row: any) => row[0]);

    const tables: Table[] = [];
    for (const tableName of tableNames) {
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
    if (!this.db) throw new Error('Not connected');

    const stmt = this.db.prepare(`PRAGMA table_info("${tableName}")`);
    const columns: Column[] = [];

    // Get foreign keys
    const fkResult = this.db.exec(`PRAGMA foreign_key_list("${tableName}")`);
    const foreignKeyColumns = new Set<string>();
    if (fkResult.length > 0) {
      fkResult[0].values.forEach((row: any) => {
        foreignKeyColumns.add(row[3]); // from column
      });
    }

    while (stmt.step()) {
      const row = stmt.getAsObject() as any;
      columns.push({
        name: row.name,
        type: row.type || 'TEXT',
        nullable: row.notnull === 0,
        defaultValue: row.dflt_value,
        isPrimaryKey: row.pk === 1,
        isForeignKey: foreignKeyColumns.has(row.name),
      });
    }
    stmt.free();

    return columns;
  }

  protected async getIndexes(tableName: string): Promise<Index[]> {
    if (!this.db) throw new Error('Not connected');

    const result = this.db.exec(`PRAGMA index_list("${tableName}")`);
    
    if (result.length === 0) return [];

    const indexes: Index[] = [];

    for (const row of result[0].values) {
      const indexName = row[1] as string;
      const isUnique = row[2] === 1;
      
      const indexInfo = this.db.exec(`PRAGMA index_info("${indexName}")`);
      const indexColumns: string[] = [];
      
      if (indexInfo.length > 0) {
        indexInfo[0].values.forEach((col: any) => {
          indexColumns.push(col[2]); // column name
        });
      }

      indexes.push({
        name: indexName,
        columns: indexColumns,
        isUnique,
      });
    }

    return indexes;
  }

  protected async getForeignKeys(tableName: string): Promise<ForeignKey[]> {
    if (!this.db) throw new Error('Not connected');

    const result = this.db.exec(`PRAGMA foreign_key_list("${tableName}")`);

    if (result.length === 0) return [];

    const fkMap = new Map<string, ForeignKey>();

    for (const row of result[0].values) {
      const fkName = `fk_${tableName}_${row[3]}_${row[2]}`;
      if (!fkMap.has(fkName)) {
        fkMap.set(fkName, {
          name: fkName,
          columns: [],
          referencedTable: row[2] as string,
          referencedColumns: [],
        });
      }
      fkMap.get(fkName)!.columns.push(row[3] as string);
      fkMap.get(fkName)!.referencedColumns.push(row[4] as string);
    }

    return Array.from(fkMap.values());
  }
}
