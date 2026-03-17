import { describe, it, expect } from 'vitest';
import { computeDiff, generateMigrationSQL } from '../../src/core/diff';
import { Schema } from '../../src/types';

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
    { name: 'email', type: 'VARCHAR(255)', nullable: false, isPrimaryKey: false, isForeignKey: false },
  ],
};

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
    const postsTable = { ...baseTable, name: 'posts', columns: [{ name: 'id', type: 'INTEGER', nullable: false, isPrimaryKey: true, isForeignKey: false }] };
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
        { name: 'name', type: 'VARCHAR(100)', nullable: true, isPrimaryKey: false, isForeignKey: false },
      ],
    };
    const s1 = makeSchema('db', [usersTable]);
    const s2 = makeSchema('db', [usersV2]);
    const diff = computeDiff(s1, s2);
    expect(diff.modified).toHaveLength(1);
    const mod = diff.modified[0];
    expect(mod.name).toBe('users');
    const addedCol = mod.columns?.find(c => c.name === 'name');
    expect(addedCol?.type).toBe('added');
  });

  it('detects removed column in existing table', () => {
    const usersV2 = { ...usersTable, columns: [usersTable.columns[0]] }; // remove email
    const s1 = makeSchema('db', [usersTable]);
    const s2 = makeSchema('db', [usersV2]);
    const diff = computeDiff(s1, s2);
    expect(diff.modified).toHaveLength(1);
    const removedCol = diff.modified[0].columns?.find(c => c.name === 'email');
    expect(removedCol?.type).toBe('removed');
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
    const modCol = diff.modified[0].columns?.find(c => c.name === 'email');
    expect(modCol?.type).toBe('modified');
    expect(modCol?.oldType).toBe('VARCHAR(255)');
    expect(modCol?.newType).toBe('TEXT');
  });
});

describe('generateMigrationSQL', () => {
  it('generates CREATE TABLE for added tables', () => {
    const newTable = { ...baseTable, name: 'orders', columns: [{ name: 'id', type: 'INTEGER', nullable: false, isPrimaryKey: true, isForeignKey: false }] };
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

  it('generates ALTER TABLE ADD for added columns', () => {
    const diff = {
      added: [],
      removed: [],
      modified: [{ name: 'users', type: 'modified' as const, columns: [{ name: 'avatar', type: 'added' as const }] }],
    };
    const sql = generateMigrationSQL('mydb', diff);
    expect(sql).toContain('ALTER TABLE users');
  });

  it('generates ALTER TABLE DROP for removed columns', () => {
    const diff = {
      added: [],
      removed: [],
      modified: [{ name: 'users', type: 'modified' as const, columns: [{ name: 'email', type: 'removed' as const }] }],
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
