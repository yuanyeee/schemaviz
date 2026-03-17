import { Schema, Table, Column, Index, ForeignKey } from '../types';

/**
 * Base adapter for database schema extraction
 */
export abstract class BaseAdapter {
  protected config: any;

  constructor(config: any) {
    this.config = config;
  }

  /**
   * Connect to the database
   */
  abstract connect(): Promise<void>;

  /**
   * Disconnect from the database
   */
  abstract disconnect(): Promise<void>;

  /**
   * Extract the full schema
   */
  abstract extractSchema(): Promise<Schema>;

  /**
   * Get list of databases (for DB selection UI)
   */
  async getDatabases(): Promise<string[]> {
    return [];
  }

  /**
   * Get list of table names (for table selection UI)
   */
  async getTableNames(): Promise<string[]> {
    const tables = await this.getTables();
    return tables.map(t => t.name);
  }

  /**
   * Extract schema for specific tables only
   */
  async extractSchemaForTables(tableNames: string[]): Promise<Schema> {
    // Default: extract full schema and filter
    const full = await this.extractSchema();
    const nameSet = new Set(tableNames);
    return {
      ...full,
      tables: full.tables.filter(t => nameSet.has(t.name)),
    };
  }

  /**
   * Get all tables
   */
  protected abstract getTables(): Promise<Table[]>;

  /**
   * Get columns for a specific table
   */
  protected abstract getColumns(tableName: string): Promise<Column[]>;

  /**
   * Get indexes for a specific table
   */
  protected abstract getIndexes(tableName: string): Promise<Index[]>;

  /**
   * Get foreign keys for a specific table
   */
  protected abstract getForeignKeys(tableName: string): Promise<ForeignKey[]>;

  /**
   * Helper to map database column type to generic type
   */
  protected mapType(dbType: string): string {
    const type = dbType.toLowerCase();
    
    if (type.includes('int') || type.includes('serial') || type.includes('identity')) {
      return 'INT';
    }
    if (type.includes('varchar') || type.includes('text') || type.includes('char')) {
      return 'STRING';
    }
    if (type.includes('decimal') || type.includes('numeric') || type.includes('float') || type.includes('double')) {
      return 'DECIMAL';
    }
    if (type.includes('date') && type.includes('time')) {
      return 'DATETIME';
    }
    if (type.includes('date')) {
      return 'DATE';
    }
    if (type.includes('time')) {
      return 'TIME';
    }
    if (type.includes('bool')) {
      return 'BOOLEAN';
    }
    if (type.includes('json')) {
      return 'JSON';
    }
    if (type.includes('uuid')) {
      return 'UUID';
    }
    if (type.includes('bytea') || type.includes('blob') || type.includes('binary')) {
      return 'BINARY';
    }
    
    return 'STRING';
  }
}

/**
 * Factory function to create the appropriate adapter
 */
export function createAdapter(config: any): BaseAdapter {
  switch (config.type) {
    case 'postgresql':
      return new (require('./postgresql').PostgreSQLAdapter)(config);
    case 'mysql':
      return new (require('./mysql').MySQLAdapter)(config);
    case 'sqlite':
      return new (require('./sqlite').SQLiteAdapter)(config);
    case 'sqlserver':
      return new (require('./sqlserver').SQLServerAdapter)(config);
    default:
      throw new Error(`Unsupported database type: ${config.type}`);
  }
}
