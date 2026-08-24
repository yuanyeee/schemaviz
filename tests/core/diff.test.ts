import { describe, it, expect } from 'vitest';
import { computeDiff, generateMigrationSQL } from '../../src/core/diff';
import { Schema, DatabaseType, Column, Index, ForeignKey } from '../../src/types';

function makeSchema(database: string, tables: Schema['tables']): Schema {
  return { database, generatedAt: new Date().toISOString(), tables };
}

const baseTable = {
  indexes: [],
  foreignKeys: [],
};

const usersTable = {
  ...baseTable,
  name: 'users',
  columns: [
    { name: 'id', type: 'INTEGER', nullable: false, isPrimaryKey: true, isForeignKey: false },
    {
      name: 'email',
      type: 'VARCHAR(255)',
      nullable: false,
      isPrimaryKey: false,
      isForeignKey: false,
    },
  ],
};

/**
 * Splits migration SQL into the forward section (before `-- Rollback Script`)
 * and the rollback section (from the marker onward). Used to verify that each
 * statement lands in the right section — a bare toContain on the full script
 * previously let the ADD-column bug pass by matching the rollback side.
 */
function splitSections(sql: string): { forward: string; rollback: string } {
  const marker = '-- Rollback Script';
  const idx = sql.indexOf(marker);
  return { forward: sql.slice(0, idx), rollback: sql.slice(idx) };
}

describe('computeDiff', () => {
  it('returns empty diff for identical schemas', () => {
    const s1 = makeSchema('db', [usersTable]);
    const s2 = makeSchema('db', [usersTable]);
    const diff = computeDiff(s1, s2);
    expect(diff.added).toHaveLength(0);
    expect(diff.removed).toHaveLength(0);
    expect(diff.modified).toHaveLength(0);
  });

  it('detects added tables', () => {
    const postsTable = {
      ...baseTable,
      name: 'posts',
      columns: [
        { name: 'id', type: 'INTEGER', nullable: false, isPrimaryKey: true, isForeignKey: false },
      ],
    };
    const s1 = makeSchema('db', [usersTable]);
    const s2 = makeSchema('db', [usersTable, postsTable]);
    const diff = computeDiff(s1, s2);
    expect(diff.added).toHaveLength(1);
    expect(diff.added[0].name).toBe('posts');
  });

  it('detects removed tables', () => {
    const s1 = makeSchema('db', [usersTable, { ...baseTable, name: 'old_table', columns: [] }]);
    const s2 = makeSchema('db', [usersTable]);
    const diff = computeDiff(s1, s2);
    expect(diff.removed).toHaveLength(1);
    expect(diff.removed[0].name).toBe('old_table');
  });

  it('detects added column in existing table', () => {
    const usersV2 = {
      ...usersTable,
      columns: [
        ...usersTable.columns,
        {
          name: 'name',
          type: 'VARCHAR(100)',
          nullable: true,
          isPrimaryKey: false,
          isForeignKey: false,
        },
      ],
    };
    const s1 = makeSchema('db', [usersTable]);
    const s2 = makeSchema('db', [usersV2]);
    const diff = computeDiff(s1, s2);
    expect(diff.modified).toHaveLength(1);
    const mod = diff.modified[0];
    expect(mod.name).toBe('users');
    const addedCol = mod.columns?.find((c) => c.name === 'name');
    expect(addedCol?.type).toBe('added');
  });

  it('detects removed column in existing table', () => {
    const usersV2 = { ...usersTable, columns: [usersTable.columns[0]] }; // remove email
    const s1 = makeSchema('db', [usersTable]);
    const s2 = makeSchema('db', [usersV2]);
    const diff = computeDiff(s1, s2);
    expect(diff.modified).toHaveLength(1);
    const removedCol = diff.modified[0].columns?.find((c) => c.name === 'email');
    expect(removedCol?.type).toBe('removed');
  });

  it('carries the new column definition for added columns', () => {
    const usersV2 = {
      ...usersTable,
      columns: [
        ...usersTable.columns,
        {
          name: 'avatar',
          type: 'VARCHAR(100)',
          nullable: true,
          isPrimaryKey: false,
          isForeignKey: false,
        },
      ],
    };
    const diff = computeDiff(makeSchema('db', [usersTable]), makeSchema('db', [usersV2]));
    const addedCol = diff.modified[0].columns?.find((c) => c.name === 'avatar');
    expect(addedCol?.newType).toBe('VARCHAR(100)');
    expect(addedCol?.newNullable).toBe(true);
  });

  it('carries the old column definition for removed columns', () => {
    const usersV2 = { ...usersTable, columns: [usersTable.columns[0]] }; // remove email
    const diff = computeDiff(makeSchema('db', [usersTable]), makeSchema('db', [usersV2]));
    const removedCol = diff.modified[0].columns?.find((c) => c.name === 'email');
    expect(removedCol?.oldType).toBe('VARCHAR(255)');
    expect(removedCol?.oldNullable).toBe(false);
  });

  it('detects type change in column', () => {
    const usersV2 = {
      ...usersTable,
      columns: [
        usersTable.columns[0],
        { ...usersTable.columns[1], type: 'TEXT' }, // email: VARCHAR → TEXT
      ],
    };
    const s1 = makeSchema('db', [usersTable]);
    const s2 = makeSchema('db', [usersV2]);
    const diff = computeDiff(s1, s2);
    expect(diff.modified).toHaveLength(1);
    const modCol = diff.modified[0].columns?.find((c) => c.name === 'email');
    expect(modCol?.type).toBe('modified');
    expect(modCol?.oldType).toBe('VARCHAR(255)');
    expect(modCol?.newType).toBe('TEXT');
  });
});

describe('generateMigrationSQL', () => {
  it('generates CREATE TABLE for added tables', () => {
    const newTable = {
      ...baseTable,
      name: 'orders',
      columns: [
        { name: 'id', type: 'INTEGER', nullable: false, isPrimaryKey: true, isForeignKey: false },
      ],
    };
    const diff = { added: [newTable], removed: [], modified: [] };
    const sql = generateMigrationSQL('mydb', diff);
    expect(sql).toContain('CREATE TABLE orders');
    expect(sql).toContain('id INTEGER');
  });

  it('generates DROP TABLE for removed tables', () => {
    const diff = { added: [], removed: [usersTable], modified: [] };
    const sql = generateMigrationSQL('mydb', diff);
    expect(sql).toContain('DROP TABLE IF EXISTS users');
  });

  it('generates ALTER TABLE ADD in the forward section for added columns (via computeDiff)', () => {
    const usersV2 = {
      ...usersTable,
      columns: [
        ...usersTable.columns,
        {
          name: 'avatar',
          type: 'VARCHAR(100)',
          nullable: true,
          isPrimaryKey: false,
          isForeignKey: false,
        },
      ],
    };
    const s1 = makeSchema('db', [usersTable]);
    const s2 = makeSchema('db', [usersV2]);
    const sql = generateMigrationSQL(s1.database, computeDiff(s1, s2));
    const { forward, rollback } = splitSections(sql);

    // Forward section must contain the ADD statement for the new column
    expect(forward).toContain('ALTER TABLE users ADD avatar VARCHAR(100)');
    // Forward section must not drop the new column
    expect(forward).not.toContain('DROP COLUMN avatar');
    // Rollback section must drop the added column
    expect(rollback).toContain('ALTER TABLE users DROP COLUMN avatar;');
  });

  it('generates ALTER TABLE ADD with NOT NULL and DEFAULT for constrained added columns', () => {
    const usersV2 = {
      ...usersTable,
      columns: [
        ...usersTable.columns,
        {
          name: 'role',
          type: 'VARCHAR(20)',
          nullable: false,
          isPrimaryKey: false,
          isForeignKey: false,
          defaultValue: "'user'",
        },
      ],
    };
    const s1 = makeSchema('db', [usersTable]);
    const s2 = makeSchema('db', [usersV2]);
    const sql = generateMigrationSQL(s1.database, computeDiff(s1, s2));
    const { forward } = splitSections(sql);

    expect(forward).toContain("ALTER TABLE users ADD role VARCHAR(20) NOT NULL DEFAULT 'user';");
  });

  it('emits a TODO comment instead of a broken ADD when the definition is missing', () => {
    const diff = {
      added: [],
      removed: [],
      modified: [
        {
          name: 'users',
          type: 'modified' as const,
          columns: [{ name: 'avatar', type: 'added' as const }],
        },
      ],
    };
    const sql = generateMigrationSQL('mydb', diff);
    const { forward } = splitSections(sql);

    expect(forward).toContain('-- TODO: Add column users.avatar (column definition missing)');
    expect(forward).not.toContain('ALTER TABLE users ADD');
  });

  it('generates ALTER TABLE DROP for removed columns', () => {
    const diff = {
      added: [],
      removed: [],
      modified: [
        {
          name: 'users',
          type: 'modified' as const,
          columns: [{ name: 'email', type: 'removed' as const }],
        },
      ],
    };
    const sql = generateMigrationSQL('mydb', diff);
    expect(sql).toContain('ALTER TABLE users DROP COLUMN email');
  });

  it('wraps migration in BEGIN/COMMIT transaction', () => {
    const diff = { added: [], removed: [], modified: [] };
    const sql = generateMigrationSQL('mydb', diff);
    expect(sql).toContain('BEGIN TRANSACTION');
    expect(sql).toContain('COMMIT');
  });

  it('includes database name in header comment', () => {
    const diff = { added: [], removed: [], modified: [] };
    const sql = generateMigrationSQL('production_db', diff);
    expect(sql).toContain('Database: production_db');
  });
});

describe('generateMigrationSQL dialects', () => {
  // A modified table exercising all three column-change kinds.
  const makeDiff = () => ({
    added: [],
    removed: [],
    modified: [
      {
        name: 'users',
        type: 'modified' as const,
        columns: [
          { name: 'avatar', type: 'added' as const, newType: 'VARCHAR(100)', newNullable: true },
          { name: 'legacy_flag', type: 'removed' as const, oldType: 'INTEGER', oldNullable: true },
          {
            name: 'email',
            type: 'modified' as const,
            oldType: 'VARCHAR(255)',
            newType: 'TEXT',
            oldNullable: false,
            newNullable: false,
          },
          {
            name: 'nickname',
            type: 'modified' as const,
            oldType: 'VARCHAR(50)',
            newType: 'VARCHAR(50)',
            oldNullable: false,
            newNullable: true,
          },
        ],
      },
    ],
  });

  const cases: {
    dialect: DatabaseType;
    expected: string[];
    unexpected: string[];
    transactional: boolean;
  }[] = [
    {
      dialect: 'postgresql',
      expected: [
        'ALTER TABLE users ADD avatar VARCHAR(100);',
        'ALTER TABLE users DROP COLUMN legacy_flag;',
        'ALTER TABLE users ALTER COLUMN email TYPE TEXT;',
        'ALTER TABLE users ALTER COLUMN nickname DROP NOT NULL;',
      ],
      unexpected: ['MODIFY COLUMN', '-- TODO: manual migration required'],
      transactional: true,
    },
    {
      dialect: 'mysql',
      expected: [
        'ALTER TABLE users ADD COLUMN avatar VARCHAR(100);',
        'ALTER TABLE users DROP COLUMN legacy_flag;',
        'ALTER TABLE users MODIFY COLUMN email TEXT NOT NULL;',
        'ALTER TABLE users MODIFY COLUMN nickname VARCHAR(50);',
      ],
      unexpected: ['ALTER COLUMN', 'BEGIN TRANSACTION', 'COMMIT'],
      transactional: false,
    },
    {
      dialect: 'sqlserver',
      expected: [
        'ALTER TABLE users ADD avatar VARCHAR(100);',
        'ALTER TABLE users DROP COLUMN legacy_flag;',
        'ALTER TABLE users ALTER COLUMN email TEXT NOT NULL;',
        'ALTER TABLE users ALTER COLUMN nickname VARCHAR(50) NULL;',
      ],
      unexpected: ['MODIFY COLUMN', ' TYPE TEXT'],
      transactional: true,
    },
    {
      dialect: 'sqlite',
      expected: [
        'ALTER TABLE users ADD COLUMN avatar VARCHAR(100);',
        'ALTER TABLE users DROP COLUMN legacy_flag;',
        '-- TODO: manual migration required: SQLite does not support altering column users.email',
        '-- TODO: manual migration required: SQLite does not support altering column users.nickname',
      ],
      unexpected: ['ALTER COLUMN', 'MODIFY COLUMN', 'BEGIN TRANSACTION', 'COMMIT'],
      transactional: false,
    },
  ];

  for (const { dialect, expected, unexpected, transactional } of cases) {
    it(`generates ${dialect}-specific statements`, () => {
      const sql = generateMigrationSQL('mydb', makeDiff(), dialect);
      const { forward, rollback } = splitSections(sql);

      expect(sql).toContain(`-- Dialect: ${dialect}`);
      for (const stmt of expected) {
        expect(forward).toContain(stmt);
      }
      for (const stmt of unexpected) {
        expect(sql).not.toContain(stmt);
      }
      if (transactional) {
        expect(sql).toContain('BEGIN TRANSACTION');
        expect(sql).toContain('COMMIT');
      }
      // Rollback reverses the same changes with the same dialect rules
      expect(rollback).toContain('ALTER TABLE users DROP COLUMN avatar');
    });
  }

  it('marks a NOT NULL column without DEFAULT as TODO on SQLite', () => {
    const diff = {
      added: [],
      removed: [],
      modified: [
        {
          name: 'users',
          type: 'modified' as const,
          columns: [
            { name: 'role', type: 'added' as const, newType: 'VARCHAR(20)', newNullable: false },
          ],
        },
      ],
    };
    const { forward } = splitSections(generateMigrationSQL('mydb', diff, 'sqlite'));
    expect(forward).toContain('-- TODO: manual migration required');
    expect(forward).not.toContain('ADD COLUMN role');
  });

  it('emits dialect-specific rollback for modified columns', () => {
    const { rollback: mysqlRollback } = splitSections(
      generateMigrationSQL('mydb', makeDiff(), 'mysql'),
    );
    expect(mysqlRollback).toContain('ALTER TABLE users MODIFY COLUMN email VARCHAR(255) NOT NULL;');
    expect(mysqlRollback).toContain(
      'ALTER TABLE users MODIFY COLUMN nickname VARCHAR(50) NOT NULL;',
    );

    const { rollback: pgRollback } = splitSections(
      generateMigrationSQL('mydb', makeDiff(), 'postgresql'),
    );
    expect(pgRollback).toContain('ALTER TABLE users ALTER COLUMN email TYPE VARCHAR(255);');
    expect(pgRollback).toContain('ALTER TABLE users ALTER COLUMN nickname SET NOT NULL;');

    const { rollback: sqliteRollback } = splitSections(
      generateMigrationSQL('mydb', makeDiff(), 'sqlite'),
    );
    expect(sqliteRollback).toContain('-- TODO: manual migration required');
    expect(sqliteRollback).not.toContain('ALTER COLUMN');
  });
});

describe('type parameters (length/precision/scale)', () => {
  const paramCol = (name: string, type: string, extra: Record<string, unknown> = {}) => ({
    name,
    type,
    nullable: false,
    isPrimaryKey: false,
    isForeignKey: false,
    ...extra,
  });

  it('detects length-only changes as modified', () => {
    const v1 = {
      ...baseTable,
      name: 'users',
      columns: [
        paramCol('id', 'INTEGER', { isPrimaryKey: true }),
        paramCol('email', 'VARCHAR', { length: 100 }),
      ],
    };
    const v2 = {
      ...baseTable,
      name: 'users',
      columns: [
        paramCol('id', 'INTEGER', { isPrimaryKey: true }),
        paramCol('email', 'VARCHAR', { length: 255 }),
      ],
    };
    const diff = computeDiff(makeSchema('db', [v1]), makeSchema('db', [v2]));
    expect(diff.modified).toHaveLength(1);
    const col = diff.modified[0].columns?.find((c) => c.name === 'email');
    expect(col?.type).toBe('modified');
    expect(col?.oldLength).toBe(100);
    expect(col?.newLength).toBe(255);
  });

  it('detects precision/scale changes as modified', () => {
    const v1 = {
      ...baseTable,
      name: 'orders',
      columns: [paramCol('price', 'DECIMAL', { precision: 10, scale: 2 })],
    };
    const v2 = {
      ...baseTable,
      name: 'orders',
      columns: [paramCol('price', 'DECIMAL', { precision: 12, scale: 3 })],
    };
    const diff = computeDiff(makeSchema('db', [v1]), makeSchema('db', [v2]));
    const col = diff.modified[0].columns?.find((c) => c.name === 'price');
    expect(col?.oldPrecision).toBe(10);
    expect(col?.newPrecision).toBe(12);
    expect(col?.newScale).toBe(3);
  });

  it('does not flag columns whose type and parameters are identical', () => {
    const v1 = {
      ...baseTable,
      name: 'users',
      columns: [paramCol('email', 'VARCHAR', { length: 255 })],
    };
    const v2 = {
      ...baseTable,
      name: 'users',
      columns: [paramCol('email', 'VARCHAR', { length: 255 })],
    };
    const diff = computeDiff(makeSchema('db', [v1]), makeSchema('db', [v2]));
    expect(diff.modified).toHaveLength(0);
  });

  it('emits the length in migration ADD statements', () => {
    const usersV2 = {
      ...usersTable,
      columns: [
        ...usersTable.columns,
        paramCol('avatar', 'VARCHAR', { length: 100, nullable: true }),
      ],
    };
    const s1 = makeSchema('db', [usersTable]);
    const s2 = makeSchema('db', [usersV2]);
    const { forward } = splitSections(generateMigrationSQL(s1.database, computeDiff(s1, s2)));
    expect(forward).toContain('ALTER TABLE users ADD avatar VARCHAR(100);');
  });

  it('emits the parameterized type in PostgreSQL ALTER statements, forward and rollback', () => {
    const v1 = {
      ...baseTable,
      name: 'users',
      columns: [paramCol('email', 'VARCHAR', { length: 100 })],
    };
    const v2 = {
      ...baseTable,
      name: 'users',
      columns: [paramCol('email', 'VARCHAR', { length: 255 })],
    };
    const { forward, rollback } = splitSections(
      generateMigrationSQL('mydb', computeDiff(makeSchema('db', [v1]), makeSchema('db', [v2]))),
    );
    expect(forward).toContain('ALTER TABLE users ALTER COLUMN email TYPE VARCHAR(255);');
    expect(rollback).toContain('ALTER TABLE users ALTER COLUMN email TYPE VARCHAR(100);');
  });

  it('emits the parameterized type in MySQL MODIFY COLUMN statements', () => {
    const v1 = {
      ...baseTable,
      name: 'users',
      columns: [paramCol('email', 'VARCHAR', { length: 100 })],
    };
    const v2 = {
      ...baseTable,
      name: 'users',
      columns: [paramCol('email', 'VARCHAR', { length: 255 })],
    };
    const { forward } = splitSections(
      generateMigrationSQL(
        'mydb',
        computeDiff(makeSchema('db', [v1]), makeSchema('db', [v2])),
        'mysql',
      ),
    );
    expect(forward).toContain('ALTER TABLE users MODIFY COLUMN email VARCHAR(255) NOT NULL;');
  });
});

describe('index/FK/default detection (T1.4)', () => {
  const c = (name: string, extra: Record<string, unknown> = {}) => ({
    name,
    type: 'INTEGER',
    nullable: false,
    isPrimaryKey: false,
    isForeignKey: false,
    ...extra,
  });
  const tbl = (
    name: string,
    columns: Column[],
    indexes: Index[] = [],
    foreignKeys: ForeignKey[] = [],
  ) => ({ name, columns, indexes, foreignKeys });

  it('detects added and removed indexes', () => {
    const t1 = tbl(
      'users',
      [c('id', { isPrimaryKey: true })],
      [{ name: 'idx_old', columns: ['id'], isUnique: false }],
    );
    const t2 = tbl(
      'users',
      [c('id', { isPrimaryKey: true })],
      [{ name: 'idx_new', columns: ['id'], isUnique: true }],
    );
    const diff = computeDiff(makeSchema('db', [t1]), makeSchema('db', [t2]));
    expect(diff.modified).toHaveLength(1);
    const idxs = diff.modified[0].indexes!;
    expect(idxs.find((i) => i.name === 'idx_new')?.type).toBe('added');
    expect(idxs.find((i) => i.name === 'idx_old')?.type).toBe('removed');
  });

  it('detects modified index (columns or uniqueness changed)', () => {
    const t1 = tbl(
      'users',
      [c('id'), c('email')],
      [{ name: 'idx_e', columns: ['email'], isUnique: false }],
    );
    const t2 = tbl(
      'users',
      [c('id'), c('email')],
      [{ name: 'idx_e', columns: ['email'], isUnique: true }],
    );
    const diff = computeDiff(makeSchema('db', [t1]), makeSchema('db', [t2]));
    const idx = diff.modified[0].indexes!.find((i) => i.name === 'idx_e')!;
    expect(idx.type).toBe('modified');
    expect(idx.isUnique).toBe(true);
    expect(idx.oldIsUnique).toBe(false);
  });

  it('detects added and removed foreign keys', () => {
    const t1 = tbl('posts', [c('user_id')], [], []);
    const t2 = tbl(
      'posts',
      [c('user_id')],
      [],
      [
        {
          name: 'posts_user_fk',
          columns: ['user_id'],
          referencedTable: 'users',
          referencedColumns: ['id'],
        },
      ],
    );
    const diff = computeDiff(makeSchema('db', [t1]), makeSchema('db', [t2]));
    const fks = diff.modified[0].foreignKeys!;
    expect(fks[0].type).toBe('added');
    expect(fks[0].referencedTable).toBe('users');

    const diffBack = computeDiff(makeSchema('db', [t2]), makeSchema('db', [t1]));
    expect(diffBack.modified[0].foreignKeys![0].type).toBe('removed');
  });

  it('detects modified foreign key (referenced table changed)', () => {
    const fk1 = [
      {
        name: 'posts_fk',
        columns: ['author_id'],
        referencedTable: 'users',
        referencedColumns: ['id'],
      },
    ];
    const fk2 = [
      {
        name: 'posts_fk',
        columns: ['author_id'],
        referencedTable: 'accounts',
        referencedColumns: ['id'],
      },
    ];
    const diff = computeDiff(
      makeSchema('db', [tbl('posts', [c('author_id')], [], fk1)]),
      makeSchema('db', [tbl('posts', [c('author_id')], [], fk2)]),
    );
    const fk = diff.modified[0].foreignKeys![0];
    expect(fk.type).toBe('modified');
    expect(fk.referencedTable).toBe('accounts');
    expect(fk.oldReferencedTable).toBe('users');
  });

  it('detects default value changes with old/new defaults', () => {
    const t1 = tbl('users', [c('role', { type: 'VARCHAR', defaultValue: "'user'" })]);
    const t2 = tbl('users', [c('role', { type: 'VARCHAR', defaultValue: "'member'" })]);
    const diff = computeDiff(makeSchema('db', [t1]), makeSchema('db', [t2]));
    const col = diff.modified[0].columns!.find((x) => x.name === 'role')!;
    expect(col.type).toBe('modified');
    expect(col.oldDefault).toBe("'user'");
    expect(col.newDefault).toBe("'member'");
  });

  it('marks a table modified when only an index changed (columns omitted)', () => {
    const t1 = tbl('users', [c('id')], []);
    const t2 = tbl('users', [c('id')], [{ name: 'idx_id', columns: ['id'], isUnique: false }]);
    const diff = computeDiff(makeSchema('db', [t1]), makeSchema('db', [t2]));
    expect(diff.modified).toHaveLength(1);
    expect(diff.modified[0].columns).toBeUndefined();
    expect(diff.modified[0].indexes).toHaveLength(1);
  });

  it('emits TODO comments in migration SQL for index/FK/default changes', () => {
    const t1 = tbl(
      'users',
      [c('id'), c('role', { type: 'VARCHAR', defaultValue: "'user'" })],
      [{ name: 'idx_old', columns: ['id'], isUnique: false }],
    );
    const t2 = tbl(
      'users',
      [c('id'), c('role', { type: 'VARCHAR', defaultValue: "'member'" })],
      [{ name: 'idx_role', columns: ['role'], isUnique: true }],
      [
        {
          name: 'users_role_fk',
          columns: ['role'],
          referencedTable: 'roles',
          referencedColumns: ['name'],
        },
      ],
    );
    const sql = generateMigrationSQL(
      'mydb',
      computeDiff(makeSchema('db', [t1]), makeSchema('db', [t2])),
    );
    const { forward, rollback } = splitSections(sql);

    expect(forward).toContain('-- TODO: Create unique index idx_role on users (role)');
    expect(forward).toContain('-- TODO: Drop index idx_old on users');
    expect(forward).toContain('-- TODO: Add foreign key users_role_fk on users (role) -> roles');
    expect(forward).toContain("-- TODO: Change default of users.role from 'user' to 'member'");

    expect(rollback).toContain('-- TODO: Drop index idx_role on users');
    expect(rollback).toContain('-- TODO: Drop foreign key users_role_fk on users');
    expect(rollback).toContain("-- TODO: Change default of users.role from 'member' to 'user'");
  });
});
