import { Schema, Table, Column, Index, ForeignKey, DatabaseConfig } from '../types';

/**
 * Base adapter for database schema extraction
 */
export abstract class BaseAdapter {
  protected config: DatabaseConfig;

  constructor(config: DatabaseConfig) {
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
   * Get list of table names (for table selection UI).
   * Every concrete adapter overrides this with a cheap metadata query
   * (the base implementation must not go through getTables — that would
   * extract every column/index/FK just to list names).
   */
  async getTableNames(): Promise<string[]> {
    throw new Error('getTableNames() is not implemented for this adapter');
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
      tables: full.tables.filter((t) => nameSet.has(t.name)),
    };
  }

  /**
   * Get all tables with their columns, indexes and foreign keys.
   */
  protected async getTables(): Promise<Table[]> {
    return this.buildTables(await this.getTableNames());
  }

  /**
   * Assemble Table objects from batched metadata lookups (T3.2).
   * Adapters fetch each category for ALL requested tables in a single
   * query, then the results are joined in memory — no per-table queries.
   */
  protected async buildTables(tableNames: string[]): Promise<Table[]> {
    const [columnsMap, indexesMap, foreignKeysMap] = await Promise.all([
      this.getColumnsForTables(tableNames),
      this.getIndexesForTables(tableNames),
      this.getForeignKeysForTables(tableNames),
    ]);
    return tableNames.map((name) => ({
      name,
      columns: columnsMap.get(name) ?? [],
      indexes: indexesMap.get(name) ?? [],
      foreignKeys: foreignKeysMap.get(name) ?? [],
    }));
  }

  /**
   * Get columns for all given tables in one batch (keyed by table name)
   */
  protected abstract getColumnsForTables(tableNames: string[]): Promise<Map<string, Column[]>>;

  /**
   * Get indexes for all given tables in one batch (keyed by table name)
   */
  protected abstract getIndexesForTables(tableNames: string[]): Promise<Map<string, Index[]>>;

  /**
   * Get foreign keys for all given tables in one batch (keyed by table name)
   */
  protected abstract getForeignKeysForTables(
    tableNames: string[],
  ): Promise<Map<string, ForeignKey[]>>;
}

/**
 * Factory function to create the appropriate adapter
 */
export function createAdapter(config: DatabaseConfig): BaseAdapter {
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
