import mssql from 'mssql';
import { BaseAdapter } from './base';
import { Schema, Column, Index, ForeignKey } from '../types';
import { isLengthType, isPrecisionType } from '../core/columnType';

export class SQLServerAdapter extends BaseAdapter {
  private pool: mssql.ConnectionPool | null = null;

  async connect(): Promise<void> {
    const config: mssql.config = {
      server: this.config.host || 'localhost',
      database: this.config.database,
      options: {
        encrypt: false,
        trustServerCertificate: true,
      },
    };

    // SQL Server Express uses named instances (e.g. localhost\SQLEXPRESS)
    if (this.config.instanceName) {
      config.options!.instanceName = this.config.instanceName;
      // When using named instances, port should not be set (uses SQL Browser)
    } else {
      config.port = this.config.port || 1433;
    }

    // Windows Authentication vs SQL Authentication
    if (this.config.authType === 'windows') {
      // For Windows Auth, use domain/integrated authentication via NTLM
      config.authentication = {
        type: 'ntlm',
        options: {
          domain: this.config.domain || '',
          userName: this.config.user || '',
          password: this.config.password || '',
        },
      };
    } else {
      config.user = this.config.user;
      config.password = this.config.password;
    }

    // Connection timeout
    if (this.config.connectionTimeout) {
      config.connectionTimeout = this.config.connectionTimeout;
    }

    try {
      this.pool = await mssql.connect(config);
    } catch (err) {
      const target = this.config.instanceName
        ? `${this.config.host}\\${this.config.instanceName}`
        : `${this.config.host}:${this.config.port || 1433}`;
      throw new Error(
        `Failed to connect to ${target} - ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.close();
      this.pool = null;
    }
  }

  async getDatabases(): Promise<string[]> {
    if (!this.pool) throw new Error('Not connected');
    const result = await this.pool.query(`
      SELECT name FROM sys.databases
      WHERE name NOT IN ('master', 'tempdb', 'model', 'msdb')
        AND state_desc = 'ONLINE'
      ORDER BY name
    `);
    return result.recordset.map((r) => r.name);
  }

  async getTableNames(): Promise<string[]> {
    if (!this.pool) throw new Error('Not connected');
    const result = await this.pool.query(`
      SELECT TABLE_NAME
      FROM information_schema.TABLES
      WHERE TABLE_TYPE = 'BASE TABLE'
        AND TABLE_SCHEMA = 'dbo'
      ORDER BY TABLE_NAME
    `);
    return result.recordset.map((r) => r.TABLE_NAME);
  }

  async extractSchemaForTables(tableNames: string[]): Promise<Schema> {
    if (!this.pool) throw new Error('Not connected');

    const tables = await this.buildTables(tableNames);

    return {
      database: this.config.database,
      type: 'sqlserver',
      tables,
      generatedAt: new Date().toISOString(),
    };
  }

  async extractSchema(): Promise<Schema> {
    if (!this.pool) {
      throw new Error('Not connected to database');
    }

    const tables = await this.buildTables(await this.getTableNames());

    return {
      database: this.config.database,
      type: 'sqlserver',
      tables,
      generatedAt: new Date().toISOString(),
    };
  }

  // T3.2: all metadata is fetched for every requested table in ONE query per
  // category (was 4 queries per table). The mssql driver cannot expand array
  // parameters for IN (...), so the table filter is built as a parameterized
  // list (@t0, @t1, ...) — never string-concatenated values.
  private addTableFilter(req: mssql.Request, tableNames: string[]): string {
    const params: string[] = [];
    tableNames.forEach((name, i) => {
      const key = `t${i}`;
      req.input(key, mssql.NVarChar, name);
      params.push(`@${key}`);
    });
    return params.join(', ');
  }

  protected async getColumnsForTables(tableNames: string[]): Promise<Map<string, Column[]>> {
    const map = new Map<string, Column[]>();
    if (tableNames.length === 0) return map;
    if (!this.pool) throw new Error('Not connected');

    const req = this.pool.request();
    const tableFilter = this.addTableFilter(req, tableNames);
    const result = await req.query(`
      SELECT
        c.TABLE_NAME,
        c.COLUMN_NAME,
        c.DATA_TYPE,
        c.COLUMN_DEFAULT,
        c.IS_NULLABLE,
        c.CHARACTER_MAXIMUM_LENGTH,
        c.NUMERIC_PRECISION,
        c.NUMERIC_SCALE,
        CASE WHEN pk.COLUMN_NAME IS NOT NULL THEN 1 ELSE 0 END as IS_PRIMARY_KEY,
        CASE WHEN fk.COLUMN_NAME IS NOT NULL THEN 1 ELSE 0 END as IS_FOREIGN_KEY
      FROM information_schema.COLUMNS c
      LEFT JOIN (
        SELECT ku.TABLE_NAME, ku.COLUMN_NAME
        FROM information_schema.TABLE_CONSTRAINTS tc
        JOIN information_schema.KEY_COLUMN_USAGE ku
          ON tc.CONSTRAINT_NAME = ku.CONSTRAINT_NAME
         AND tc.TABLE_NAME = ku.TABLE_NAME
        WHERE tc.TABLE_SCHEMA = 'dbo'
          AND tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
          AND ku.TABLE_NAME IN (${tableFilter})
      ) pk ON c.TABLE_NAME = pk.TABLE_NAME AND c.COLUMN_NAME = pk.COLUMN_NAME
      LEFT JOIN (
        SELECT ku.TABLE_NAME, ku.COLUMN_NAME
        FROM information_schema.TABLE_CONSTRAINTS tc
        JOIN information_schema.KEY_COLUMN_USAGE ku
          ON tc.CONSTRAINT_NAME = ku.CONSTRAINT_NAME
         AND tc.TABLE_NAME = ku.TABLE_NAME
        WHERE tc.TABLE_SCHEMA = 'dbo'
          AND tc.CONSTRAINT_TYPE = 'FOREIGN KEY'
          AND ku.TABLE_NAME IN (${tableFilter})
      ) fk ON c.TABLE_NAME = fk.TABLE_NAME AND c.COLUMN_NAME = fk.COLUMN_NAME
      WHERE c.TABLE_SCHEMA = 'dbo'
        AND c.TABLE_NAME IN (${tableFilter})
      ORDER BY c.TABLE_NAME, c.ORDINAL_POSITION
    `);

    // CHARACTER_MAXIMUM_LENGTH is -1 for (n)varchar(MAX); keep it only for
    // character/binary types, and precision/scale only for exact numerics.
    for (const row of result.recordset) {
      const column: Column = {
        name: row.COLUMN_NAME,
        type: row.DATA_TYPE,
        nullable: row.IS_NULLABLE === 'YES',
        defaultValue: row.COLUMN_DEFAULT ?? undefined,
        isPrimaryKey: row.IS_PRIMARY_KEY === 1,
        isForeignKey: row.IS_FOREIGN_KEY === 1,
        length:
          isLengthType(row.DATA_TYPE) && row.CHARACTER_MAXIMUM_LENGTH > 0
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

    const req = this.pool.request();
    const tableFilter = this.addTableFilter(req, tableNames);
    const result = await req.query(`
      SELECT
        st.name as table_name,
        i.name as index_name,
        COL_NAME(ic.object_id, ic.column_id) as column_name,
        i.is_unique
      FROM sys.indexes i
      JOIN sys.index_columns ic
        ON i.object_id = ic.object_id AND i.index_id = ic.index_id
      JOIN sys.tables st ON i.object_id = st.object_id
      WHERE st.name IN (${tableFilter})
        AND i.is_primary_key = 0
      ORDER BY st.name, i.name, ic.key_ordinal
    `);

    const perTable = new Map<string, Map<string, Index>>();
    for (const row of result.recordset) {
      const tableName = row.table_name as string;
      let byIndex = perTable.get(tableName);
      if (!byIndex) {
        byIndex = new Map<string, Index>();
        perTable.set(tableName, byIndex);
      }
      let idx = byIndex.get(row.index_name);
      if (!idx) {
        idx = { name: row.index_name, columns: [], isUnique: row.is_unique };
        byIndex.set(row.index_name, idx);
      }
      if (row.column_name) {
        idx.columns.push(row.column_name);
      }
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

    const req = this.pool.request();
    const tableFilter = this.addTableFilter(req, tableNames);
    const result = await req.query(`
      SELECT
        tp.name as table_name,
        fk.name as fk_name,
        cp.name as column_name,
        tr.name as referenced_table,
        cr.name as referenced_column
      FROM sys.foreign_keys fk
      JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
      JOIN sys.tables tp ON fk.parent_object_id = tp.object_id
      JOIN sys.columns cp ON fkc.parent_object_id = cp.object_id AND fkc.parent_column_id = cp.column_id
      JOIN sys.columns cr ON fkc.referenced_object_id = cr.object_id AND fkc.referenced_column_id = cr.column_id
      JOIN sys.tables tr ON fkc.referenced_object_id = tr.object_id
      WHERE tp.name IN (${tableFilter})
      ORDER BY tp.name, fk.name, fkc.constraint_column_id
    `);

    const perTable = new Map<string, Map<string, ForeignKey>>();
    for (const row of result.recordset) {
      const tableName = row.table_name as string;
      let byFk = perTable.get(tableName);
      if (!byFk) {
        byFk = new Map<string, ForeignKey>();
        perTable.set(tableName, byFk);
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
