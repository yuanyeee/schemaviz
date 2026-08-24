import initSqlJs, { Database, SqlJsStatic } from 'sql.js';
import * as fs from 'fs';
import { BaseAdapter } from './base';
import { Schema, Column, Index, ForeignKey } from '../types';
import { parseColumnType } from '../core/columnType';

// Cache the SQL.js WASM module to avoid reloading it on every connection
let cachedSqlJs: SqlJsStatic | null = null;

export class SQLiteAdapter extends BaseAdapter {
  private db: Database | null = null;

  async connect(): Promise<void> {
    if (!this.config.filename) {
      throw new Error('SQLite requires a filename');
    }

    if (!cachedSqlJs) {
      cachedSqlJs = await initSqlJs();
    }
    const SQL = cachedSqlJs;

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
      this.db.close();
      this.db = null;
    }
  }

  async getTableNames(): Promise<string[]> {
    if (!this.db) throw new Error('Not connected');
    const result = this.db.exec(`
      SELECT name FROM sqlite_master
      WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `);
    if (result.length === 0) return [];
    return result[0].values.map((row: unknown[]) => row[0] as string);
  }

  async extractSchema(): Promise<Schema> {
    if (!this.db) {
      throw new Error('Not connected to database');
    }

    const tables = await this.buildTables(await this.getTableNames());

    return {
      database: this.config.filename || 'sqlite',
      type: 'sqlite',
      tables,
      generatedAt: new Date().toISOString(),
    };
  }

  async extractSchemaForTables(tableNames: string[]): Promise<Schema> {
    if (!this.db) throw new Error('Not connected');
    return {
      database: this.config.filename || 'sqlite',
      type: 'sqlite',
      tables: await this.buildTables(tableNames),
      generatedAt: new Date().toISOString(),
    };
  }

  // SQLite metadata is only exposed through per-table PRAGMA statements, so
  // the batch interface loops over them. This is acceptable here: sql.js runs
  // in-process against a local file, so there is no network round-trip per
  // table (unlike the client/server adapters).
  protected async getColumnsForTables(tableNames: string[]): Promise<Map<string, Column[]>> {
    const map = new Map<string, Column[]>();
    for (const tableName of tableNames) {
      map.set(tableName, await this.getColumnsForTable(tableName));
    }
    return map;
  }

  protected async getIndexesForTables(tableNames: string[]): Promise<Map<string, Index[]>> {
    const map = new Map<string, Index[]>();
    for (const tableName of tableNames) {
      map.set(tableName, await this.getIndexesForTable(tableName));
    }
    return map;
  }

  protected async getForeignKeysForTables(
    tableNames: string[],
  ): Promise<Map<string, ForeignKey[]>> {
    const map = new Map<string, ForeignKey[]>();
    for (const tableName of tableNames) {
      map.set(tableName, await this.getForeignKeysForTable(tableName));
    }
    return map;
  }

  private async getColumnsForTable(tableName: string): Promise<Column[]> {
    if (!this.db) throw new Error('Not connected');

    const stmt = this.db.prepare(`PRAGMA table_info("${tableName}")`);
    const columns: Column[] = [];

    // Get foreign keys
    const fkResult = this.db.exec(`PRAGMA foreign_key_list("${tableName}")`);
    const foreignKeyColumns = new Set<string>();
    if (fkResult.length > 0) {
      fkResult[0].values.forEach((row: unknown[]) => {
        foreignKeyColumns.add(row[3] as string); // from column
      });
    }

    while (stmt.step()) {
      const row = stmt.getAsObject();
      const columnName = String(row.name);
      // PRAGMA reports the declared type verbatim (e.g. "VARCHAR(100)", "DECIMAL(10,2)")
      const parsed = parseColumnType(typeof row.type === 'string' ? row.type : 'TEXT');
      columns.push({
        name: columnName,
        type: parsed.type,
        nullable: row.notnull === 0,
        defaultValue: typeof row.dflt_value === 'string' ? row.dflt_value : undefined,
        isPrimaryKey: row.pk === 1,
        isForeignKey: foreignKeyColumns.has(columnName),
        length: parsed.length,
        precision: parsed.precision,
        scale: parsed.scale,
      });
    }
    stmt.free();

    return columns;
  }

  private async getIndexesForTable(tableName: string): Promise<Index[]> {
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
        indexInfo[0].values.forEach((col: unknown[]) => {
          indexColumns.push(col[2] as string); // column name
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

  private async getForeignKeysForTable(tableName: string): Promise<ForeignKey[]> {
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
