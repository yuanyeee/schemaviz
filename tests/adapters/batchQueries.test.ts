import { describe, it, expect } from 'vitest';
import { PostgreSQLAdapter } from '../../src/adapters/postgresql';
import { MySQLAdapter } from '../../src/adapters/mysql';
import { SQLServerAdapter } from '../../src/adapters/sqlserver';
import { Schema } from '../../src/types';

// T3.2: the network adapters must fetch schema metadata with a CONSTANT number
// of queries (one per category), no matter how many tables are requested.
// These tests inject fake driver pools that record every query and return
// canned rows, proving both the O(1) query count and the in-memory grouping
// logic — without a live database.

const TABLE_NAMES = ['alpha', 'beta', 'gamma'];

// ── canned row sets ──────────────────────────────────────────────────────────

function pgRows(sql: string): Record<string, unknown>[] {
  if (sql.includes('FROM information_schema.tables')) {
    return TABLE_NAMES.map((n) => ({ table_name: n }));
  }
  if (sql.includes('FROM information_schema.columns')) {
    return [
      {
        table_name: 'alpha',
        column_name: 'id',
        data_type: 'integer',
        column_default: null,
        is_nullable: 'NO',
        character_maximum_length: null,
        numeric_precision: 32,
        numeric_scale: 0,
        is_primary_key: true,
        is_foreign_key: false,
      },
      {
        table_name: 'alpha',
        column_name: 'name',
        data_type: 'character varying',
        column_default: null,
        is_nullable: 'YES',
        character_maximum_length: 50,
        numeric_precision: null,
        numeric_scale: null,
        is_primary_key: false,
        is_foreign_key: false,
      },
      {
        table_name: 'beta',
        column_name: 'id',
        data_type: 'integer',
        column_default: null,
        is_nullable: 'NO',
        character_maximum_length: null,
        numeric_precision: 32,
        numeric_scale: 0,
        is_primary_key: true,
        is_foreign_key: false,
      },
      {
        table_name: 'beta',
        column_name: 'alpha_id',
        data_type: 'integer',
        column_default: null,
        is_nullable: 'NO',
        character_maximum_length: null,
        numeric_precision: 32,
        numeric_scale: 0,
        is_primary_key: false,
        is_foreign_key: true,
      },
      {
        table_name: 'gamma',
        column_name: 'note',
        data_type: 'text',
        column_default: null,
        is_nullable: 'YES',
        character_maximum_length: null,
        numeric_precision: null,
        numeric_scale: null,
        is_primary_key: false,
        is_foreign_key: false,
      },
    ];
  }
  if (sql.includes('FROM pg_class')) {
    return [
      { table_name: 'alpha', index_name: 'idx_alpha_name', column_name: 'name', is_unique: false },
      { table_name: 'beta', index_name: 'uq_beta_id', column_name: 'id', is_unique: true },
    ];
  }
  if (sql.includes('table_constraints')) {
    return [
      {
        table_name: 'beta',
        fk_name: 'fk_beta_alpha',
        column_name: 'alpha_id',
        referenced_table: 'alpha',
        referenced_column: 'id',
      },
    ];
  }
  throw new Error('unexpected query: ' + sql.slice(0, 80));
}

function myRows(sql: string): Record<string, unknown>[] {
  if (sql.includes('FROM information_schema.TABLES')) {
    return TABLE_NAMES.map((n) => ({ TABLE_NAME: n }));
  }
  if (sql.includes('FROM information_schema.COLUMNS')) {
    return [
      {
        TABLE_NAME: 'alpha',
        COLUMN_NAME: 'id',
        DATA_TYPE: 'int',
        COLUMN_DEFAULT: null,
        IS_NULLABLE: 'NO',
        COLUMN_KEY: 'PRI',
        CHARACTER_MAXIMUM_LENGTH: null,
        NUMERIC_PRECISION: 10,
        NUMERIC_SCALE: 0,
        EXTRA: '',
      },
      {
        TABLE_NAME: 'alpha',
        COLUMN_NAME: 'name',
        DATA_TYPE: 'varchar',
        COLUMN_DEFAULT: null,
        IS_NULLABLE: 'YES',
        COLUMN_KEY: '',
        CHARACTER_MAXIMUM_LENGTH: 50,
        NUMERIC_PRECISION: null,
        NUMERIC_SCALE: null,
        EXTRA: '',
      },
      {
        TABLE_NAME: 'beta',
        COLUMN_NAME: 'id',
        DATA_TYPE: 'int',
        COLUMN_DEFAULT: null,
        IS_NULLABLE: 'NO',
        COLUMN_KEY: 'PRI',
        CHARACTER_MAXIMUM_LENGTH: null,
        NUMERIC_PRECISION: 10,
        NUMERIC_SCALE: 0,
        EXTRA: '',
      },
      {
        TABLE_NAME: 'beta',
        COLUMN_NAME: 'alpha_id',
        DATA_TYPE: 'int',
        COLUMN_DEFAULT: null,
        IS_NULLABLE: 'NO',
        COLUMN_KEY: 'MUL',
        CHARACTER_MAXIMUM_LENGTH: null,
        NUMERIC_PRECISION: 10,
        NUMERIC_SCALE: 0,
        EXTRA: '',
      },
      {
        TABLE_NAME: 'gamma',
        COLUMN_NAME: 'note',
        DATA_TYPE: 'text',
        COLUMN_DEFAULT: null,
        IS_NULLABLE: 'YES',
        COLUMN_KEY: '',
        CHARACTER_MAXIMUM_LENGTH: null,
        NUMERIC_PRECISION: null,
        NUMERIC_SCALE: null,
        EXTRA: '',
      },
    ];
  }
  if (sql.includes('FROM information_schema.STATISTICS')) {
    return [
      { TABLE_NAME: 'alpha', Key_name: 'idx_alpha_name', Non_unique: 1, Column_name: 'name' },
      { TABLE_NAME: 'beta', Key_name: 'uq_beta_id', Non_unique: 0, Column_name: 'id' },
    ];
  }
  if (sql.includes('FROM information_schema.KEY_COLUMN_USAGE')) {
    return [
      {
        TABLE_NAME: 'beta',
        CONSTRAINT_NAME: 'fk_beta_alpha',
        COLUMN_NAME: 'alpha_id',
        REFERENCED_TABLE_NAME: 'alpha',
        REFERENCED_COLUMN_NAME: 'id',
      },
    ];
  }
  throw new Error('unexpected query: ' + sql.slice(0, 80));
}

function msRows(sql: string): Record<string, unknown>[] {
  if (sql.includes('FROM information_schema.TABLES')) {
    return TABLE_NAMES.map((n) => ({ TABLE_NAME: n }));
  }
  if (sql.includes('FROM information_schema.COLUMNS')) {
    return [
      {
        TABLE_NAME: 'alpha',
        COLUMN_NAME: 'id',
        DATA_TYPE: 'int',
        COLUMN_DEFAULT: null,
        IS_NULLABLE: 'NO',
        CHARACTER_MAXIMUM_LENGTH: null,
        NUMERIC_PRECISION: 10,
        NUMERIC_SCALE: 0,
        IS_PRIMARY_KEY: 1,
        IS_FOREIGN_KEY: 0,
      },
      {
        TABLE_NAME: 'alpha',
        COLUMN_NAME: 'name',
        DATA_TYPE: 'nvarchar',
        COLUMN_DEFAULT: null,
        IS_NULLABLE: 'YES',
        CHARACTER_MAXIMUM_LENGTH: 50,
        NUMERIC_PRECISION: null,
        NUMERIC_SCALE: null,
        IS_PRIMARY_KEY: 0,
        IS_FOREIGN_KEY: 0,
      },
      {
        TABLE_NAME: 'beta',
        COLUMN_NAME: 'id',
        DATA_TYPE: 'int',
        COLUMN_DEFAULT: null,
        IS_NULLABLE: 'NO',
        CHARACTER_MAXIMUM_LENGTH: null,
        NUMERIC_PRECISION: 10,
        NUMERIC_SCALE: 0,
        IS_PRIMARY_KEY: 1,
        IS_FOREIGN_KEY: 0,
      },
      {
        TABLE_NAME: 'beta',
        COLUMN_NAME: 'alpha_id',
        DATA_TYPE: 'int',
        COLUMN_DEFAULT: null,
        IS_NULLABLE: 'NO',
        CHARACTER_MAXIMUM_LENGTH: null,
        NUMERIC_PRECISION: 10,
        NUMERIC_SCALE: 0,
        IS_PRIMARY_KEY: 0,
        IS_FOREIGN_KEY: 1,
      },
      {
        TABLE_NAME: 'gamma',
        COLUMN_NAME: 'note',
        DATA_TYPE: 'nvarchar',
        COLUMN_DEFAULT: null,
        IS_NULLABLE: 'YES',
        CHARACTER_MAXIMUM_LENGTH: -1,
        NUMERIC_PRECISION: null,
        NUMERIC_SCALE: null,
        IS_PRIMARY_KEY: 0,
        IS_FOREIGN_KEY: 0,
      },
    ];
  }
  if (sql.includes('FROM sys.indexes')) {
    return [
      { table_name: 'alpha', index_name: 'idx_alpha_name', column_name: 'name', is_unique: false },
      { table_name: 'beta', index_name: 'uq_beta_id', column_name: 'id', is_unique: true },
    ];
  }
  if (sql.includes('FROM sys.foreign_keys')) {
    return [
      {
        table_name: 'beta',
        fk_name: 'fk_beta_alpha',
        column_name: 'alpha_id',
        referenced_table: 'alpha',
        referenced_column: 'id',
      },
    ];
  }
  throw new Error('unexpected query: ' + sql.slice(0, 80));
}

// ── shared structural assertions ─────────────────────────────────────────────

function expectGroupedSchema(schema: Schema): void {
  expect(schema.tables.map((t) => t.name)).toEqual(['alpha', 'beta', 'gamma']);

  const alpha = schema.tables[0];
  expect(alpha.columns.map((c) => c.name)).toEqual(['id', 'name']);
  expect(alpha.columns[0].isPrimaryKey).toBe(true);
  expect(alpha.columns[0].isForeignKey).toBe(false);
  expect(alpha.columns[1].length).toBe(50);
  expect(alpha.columns[1].nullable).toBe(true);
  expect(alpha.indexes).toEqual([{ name: 'idx_alpha_name', columns: ['name'], isUnique: false }]);
  expect(alpha.foreignKeys).toEqual([]);

  const beta = schema.tables[1];
  expect(beta.columns[1].name).toBe('alpha_id');
  expect(beta.columns[1].isForeignKey).toBe(true);
  expect(beta.indexes).toEqual([{ name: 'uq_beta_id', columns: ['id'], isUnique: true }]);
  expect(beta.foreignKeys).toEqual([
    {
      name: 'fk_beta_alpha',
      columns: ['alpha_id'],
      referencedTable: 'alpha',
      referencedColumns: ['id'],
    },
  ]);

  const gamma = schema.tables[2];
  expect(gamma.columns).toHaveLength(1);
  expect(gamma.indexes).toEqual([]);
  expect(gamma.foreignKeys).toEqual([]);
}

// ── fake driver pools ────────────────────────────────────────────────────────

interface QueryLog {
  sql: string;
  params?: unknown[];
}

function pgPool(log: QueryLog[]) {
  return {
    query: async (sql: string, params?: unknown[]) => {
      log.push({ sql, params });
      return { rows: pgRows(sql) };
    },
  };
}

function myPool(log: QueryLog[]) {
  return {
    query: async (sql: string, params?: unknown[]) => {
      log.push({ sql, params });
      return [myRows(sql)];
    },
  };
}

interface MsPoolHandle {
  inputs: Record<string, unknown>;
}
function msPool(log: QueryLog[], handle: MsPoolHandle) {
  return {
    // ConnectionPool also exposes .query() directly (used by getTableNames)
    query: async (sql: string) => {
      log.push({ sql });
      return { recordset: msRows(sql) };
    },
    request: () => {
      const req = {
        input: (key: string, _type: unknown, value: unknown) => {
          handle.inputs[key] = value;
          return req;
        },
        query: async (sql: string) => {
          log.push({ sql });
          return { recordset: msRows(sql) };
        },
      };
      return req;
    },
  };
}

// ── tests ────────────────────────────────────────────────────────────────────

describe('PostgreSQLAdapter batch queries (T3.2)', () => {
  it('extracts 3 tables with a constant 4 queries and groups rows per table', async () => {
    const log: QueryLog[] = [];
    const adapter = new PostgreSQLAdapter({ type: 'postgresql', database: 'db' });
    (adapter as unknown as { pool: unknown }).pool = pgPool(log);

    const schema = await adapter.extractSchema();

    // 1 table-list + 1 columns + 1 indexes + 1 FKs — independent of table count
    expect(log).toHaveLength(4);
    expectGroupedSchema(schema);
    expect(schema.type).toBe('postgresql');
    // tables were requested as ONE array parameter (ANY($1)), not one query each
    expect(log[1].params).toEqual([TABLE_NAMES]);
    expect(log[2].params).toEqual([TABLE_NAMES]);
    expect(log[3].params).toEqual([TABLE_NAMES]);
  });

  it('extractSchemaForTables skips the table-list query (3 queries)', async () => {
    const log: QueryLog[] = [];
    const adapter = new PostgreSQLAdapter({ type: 'postgresql', database: 'db' });
    (adapter as unknown as { pool: unknown }).pool = pgPool(log);

    const schema = await adapter.extractSchemaForTables(['beta']);

    expect(log).toHaveLength(3);
    expect(schema.tables.map((t) => t.name)).toEqual(['beta']);
    expect(schema.tables[0].foreignKeys).toHaveLength(1);
    expect(log.every((q) => JSON.stringify(q.params) === JSON.stringify([['beta']]))).toBe(true);
  });
});

describe('MySQLAdapter batch queries (T3.2)', () => {
  it('extracts 3 tables with a constant 4 queries and groups rows per table', async () => {
    const log: QueryLog[] = [];
    const adapter = new MySQLAdapter({ type: 'mysql', database: 'db' });
    (adapter as unknown as { pool: unknown }).pool = myPool(log);

    const schema = await adapter.extractSchema();

    expect(log).toHaveLength(4);
    expectGroupedSchema(schema);
    expect(schema.type).toBe('mysql');
    // schema name + table array params; IN (?) expansion is done by mysql2
    expect(log[1].params).toEqual(['db', TABLE_NAMES]);
    expect(log[2].params).toEqual(['db', TABLE_NAMES]);
    expect(log[3].params).toEqual(['db', TABLE_NAMES]);
  });

  it('extractSchemaForTables skips the table-list query (3 queries)', async () => {
    const log: QueryLog[] = [];
    const adapter = new MySQLAdapter({ type: 'mysql', database: 'db' });
    (adapter as unknown as { pool: unknown }).pool = myPool(log);

    const schema = await adapter.extractSchemaForTables(['beta']);

    expect(log).toHaveLength(3);
    expect(schema.tables.map((t) => t.name)).toEqual(['beta']);
  });
});

describe('SQLServerAdapter batch queries (T3.2)', () => {
  it('extracts 3 tables with a constant 4 queries and groups rows per table', async () => {
    const log: QueryLog[] = [];
    const handle: MsPoolHandle = { inputs: {} };
    const adapter = new SQLServerAdapter({ type: 'sqlserver', database: 'db' });
    (adapter as unknown as { pool: unknown }).pool = msPool(log, handle);

    const schema = await adapter.extractSchema();

    expect(log).toHaveLength(4);
    expectGroupedSchema(schema);
    expect(schema.type).toBe('sqlserver');
    // table names passed as parameters @t0..@t2, referenced in an IN list
    expect(handle.inputs).toEqual({ t0: 'alpha', t1: 'beta', t2: 'gamma' });
    expect(log[1].sql).toContain('IN (@t0, @t1, @t2)');
    // nvarchar(MAX) reports CHARACTER_MAXIMUM_LENGTH = -1: no length is kept
    expect(schema.tables[2].columns[0].length).toBeUndefined();
  });

  it('extractSchemaForTables skips the table-list query (3 queries)', async () => {
    const log: QueryLog[] = [];
    const handle: MsPoolHandle = { inputs: {} };
    const adapter = new SQLServerAdapter({ type: 'sqlserver', database: 'db' });
    (adapter as unknown as { pool: unknown }).pool = msPool(log, handle);

    const schema = await adapter.extractSchemaForTables(['beta']);

    expect(log).toHaveLength(3);
    expect(schema.tables.map((t) => t.name)).toEqual(['beta']);
    expect(handle.inputs).toEqual({ t0: 'beta' });
  });
});

describe('query count stays constant as table count grows', () => {
  it('5 tables still cost 4 queries (PostgreSQL)', async () => {
    const five = ['a', 'b', 'c', 'd', 'e'];
    const log: QueryLog[] = [];
    const adapter = new PostgreSQLAdapter({ type: 'postgresql', database: 'db' });
    (adapter as unknown as { pool: unknown }).pool = {
      query: async (sql: string, params?: unknown[]) => {
        log.push({ sql, params });
        if (sql.includes('FROM information_schema.tables')) {
          return { rows: five.map((n) => ({ table_name: n })) };
        }
        return { rows: [] }; // no columns/indexes/FKs: count is what matters
      },
    };
    const schema = await adapter.extractSchema();
    expect(schema.tables).toHaveLength(5);
    expect(log).toHaveLength(4);
    expect(log[1].params).toEqual([five]);
  });
});
