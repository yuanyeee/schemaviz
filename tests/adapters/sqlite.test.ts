import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import initSqlJs from 'sql.js';
import { SQLiteAdapter } from '../../src/adapters/sqlite';

// Real adapter test: build a SQLite database file with sql.js, then extract
// its schema through SQLiteAdapter (the only adapter testable without a live server).
describe('SQLiteAdapter', () => {
  let tmpDir: string;
  let tmpFile: string;

  beforeAll(async () => {
    const SQL = await initSqlJs();
    const db = new SQL.Database();
    db.run(`
      CREATE TABLE items (
        id INTEGER PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        price DECIMAL(10,2),
        note TEXT
      );
    `);
    // Additional tables exercising PK/FK/index/default/nullable paths
    db.run(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        created_at TEXT DEFAULT 'now'
      );
    `);
    db.run(`
      CREATE TABLE posts (
        id INTEGER PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        title TEXT NOT NULL,
        score REAL DEFAULT 0
      );
    `);
    db.run('CREATE INDEX idx_posts_user ON posts(user_id);');
    db.run('CREATE UNIQUE INDEX idx_users_email ON users(email);');
    db.run('CREATE INDEX idx_posts_title_score ON posts(title, score);');
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'schemaviz-'));
    tmpFile = path.join(tmpDir, 'test.db');
    fs.writeFileSync(tmpFile, Buffer.from(db.export()));
    db.close();
  });

  afterAll(() => {
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('extracts length/precision/scale from declared types', async () => {
    const adapter = new SQLiteAdapter({ type: 'sqlite', filename: tmpFile });
    await adapter.connect();
    try {
      const schema = await adapter.extractSchema();
      const items = schema.tables.find((t) => t.name === 'items')!;

      const name = items.columns.find((c) => c.name === 'name')!;
      expect(name.type).toBe('VARCHAR');
      expect(name.length).toBe(100);
      expect(name.nullable).toBe(false);

      const price = items.columns.find((c) => c.name === 'price')!;
      expect(price.type).toBe('DECIMAL');
      expect(price.precision).toBe(10);
      expect(price.scale).toBe(2);

      const id = items.columns.find((c) => c.name === 'id')!;
      expect(id.type).toBe('INTEGER');
      expect(id.length).toBeUndefined();
      expect(id.precision).toBeUndefined();

      const note = items.columns.find((c) => c.name === 'note')!;
      expect(note.type).toBe('TEXT');
      expect(note.length).toBeUndefined();
    } finally {
      await adapter.disconnect();
    }
  });

  // Regression baseline for the T3.2 batch-query refactor: the exact Table
  // structures produced for a multi-table DB must not change.
  it('extracts full multi-table structure (T3.2 regression baseline)', async () => {
    const adapter = new SQLiteAdapter({ type: 'sqlite', filename: tmpFile });
    await adapter.connect();
    try {
      const schema = await adapter.extractSchema();
      expect(schema.tables.map((t) => t.name)).toEqual(['items', 'posts', 'users']);

      const users = schema.tables.find((t) => t.name === 'users')!;
      const email = users.columns.find((c) => c.name === 'email')!;
      expect(email.nullable).toBe(false);
      expect(email.isForeignKey).toBe(false);
      expect(email.length).toBe(255);
      const createdAt = users.columns.find((c) => c.name === 'created_at')!;
      // PRAGMA reports the DEFAULT expression verbatim (quotes included)
      expect(createdAt.defaultValue).toBe("'now'");
      // INTEGER PRIMARY KEY is a rowid alias: PRAGMA leaves notnull=0
      expect(users.columns.find((c) => c.name === 'id')!.isPrimaryKey).toBe(true);

      const posts = schema.tables.find((t) => t.name === 'posts')!;
      const userId = posts.columns.find((c) => c.name === 'user_id')!;
      expect(userId.isForeignKey).toBe(true);
      expect(userId.nullable).toBe(false);
      // PRAGMA reports the DEFAULT expression verbatim as text
      expect(posts.columns.find((c) => c.name === 'score')!.defaultValue).toBe('0');

      expect(posts.foreignKeys).toEqual([
        {
          name: 'fk_posts_user_id_users',
          columns: ['user_id'],
          referencedTable: 'users',
          referencedColumns: ['id'],
        },
      ]);

      const postIdx = posts.indexes;
      expect(postIdx.find((i) => i.name === 'idx_posts_user')).toEqual({
        name: 'idx_posts_user',
        columns: ['user_id'],
        isUnique: false,
      });
      expect(postIdx.find((i) => i.name === 'idx_posts_title_score')).toEqual({
        name: 'idx_posts_title_score',
        columns: ['title', 'score'],
        isUnique: false,
      });
      expect(users.indexes.find((i) => i.name === 'idx_users_email')).toEqual({
        name: 'idx_users_email',
        columns: ['email'],
        isUnique: true,
      });
    } finally {
      await adapter.disconnect();
    }
  });

  it('extracts a table subset via extractSchemaForTables', async () => {
    const adapter = new SQLiteAdapter({ type: 'sqlite', filename: tmpFile });
    await adapter.connect();
    try {
      const schema = await adapter.extractSchemaForTables(['users']);
      expect(schema.tables.map((t) => t.name)).toEqual(['users']);
      expect(schema.tables[0].columns.length).toBe(3);
    } finally {
      await adapter.disconnect();
    }
  });

  it('throws when used before connect()', async () => {
    const adapter = new SQLiteAdapter({ type: 'sqlite', filename: tmpFile });
    await expect(adapter.extractSchema()).rejects.toThrow('Not connected');
    await expect(adapter.getTableNames()).rejects.toThrow('Not connected');
  });

  it('supports connect -> disconnect -> reconnect', async () => {
    const adapter = new SQLiteAdapter({ type: 'sqlite', filename: tmpFile });
    await adapter.connect();
    const first = await adapter.getTableNames();
    await adapter.disconnect();
    // after disconnect the adapter must refuse to serve
    await expect(adapter.getTableNames()).rejects.toThrow('Not connected');
    await adapter.connect();
    const second = await adapter.getTableNames();
    expect(second).toEqual(first);
    expect(second).toContain('items');
    await adapter.disconnect();
  });

  it('throws a clear error when filename is missing', async () => {
    const adapter = new SQLiteAdapter({ type: 'sqlite' });
    await expect(adapter.connect()).rejects.toThrow('filename');
  });

  it('stamps the schema type as sqlite', async () => {
    const adapter = new SQLiteAdapter({ type: 'sqlite', filename: tmpFile });
    await adapter.connect();
    try {
      const schema = await adapter.extractSchema();
      expect(schema.type).toBe('sqlite');
    } finally {
      await adapter.disconnect();
    }
  });
});
