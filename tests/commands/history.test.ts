import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { saveSnapshot, loadSnapshot, loadIndex, deleteSnapshot } from '../../src/core/history';

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'schemaviz-test-'));
}

function writeSchemaFile(dir: string, filename = 'schema.json') {
  const schema = {
    database: 'test_db',
    tables: [
      {
        name: 'users',
        columns: [
          { name: 'id', type: 'INTEGER', nullable: false, isPrimaryKey: true, isForeignKey: false },
          { name: 'email', type: 'VARCHAR(255)', nullable: false, isPrimaryKey: false, isForeignKey: false },
        ],
        indexes: [],
        foreignKeys: [],
      },
    ],
    generatedAt: new Date().toISOString(),
  };
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, JSON.stringify(schema, null, 2));
  return filePath;
}

describe('Schema History', () => {
  let tmpDir: string;
  let schemaFile: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    schemaFile = writeSchemaFile(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('saves a snapshot and returns its metadata', () => {
    const snap = saveSnapshot(tmpDir, schemaFile, 'v1.0');
    expect(snap.id).toHaveLength(8);
    expect(snap.tag).toBe('v1.0');
    expect(snap.schema.database).toBe('test_db');
    expect(snap.schema.tables).toHaveLength(1);
  });

  it('creates .schemaviz directory structure', () => {
    saveSnapshot(tmpDir, schemaFile, 'initial');
    expect(fs.existsSync(path.join(tmpDir, '.schemaviz'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, '.schemaviz', 'index.json'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, '.schemaviz', 'snapshots'))).toBe(true);
  });

  it('creates .gitignore in .schemaviz to exclude snapshot blobs', () => {
    saveSnapshot(tmpDir, schemaFile, 'initial');
    const gi = path.join(tmpDir, '.schemaviz', '.gitignore');
    expect(fs.existsSync(gi)).toBe(true);
    const content = fs.readFileSync(gi, 'utf-8');
    expect(content).toContain('snapshots/');
  });

  it('updates index.json with snapshot entry', () => {
    saveSnapshot(tmpDir, schemaFile, 'release-1');
    const index = loadIndex(tmpDir);
    expect(index.snapshots).toHaveLength(1);
    expect(index.snapshots[0].tag).toBe('release-1');
  });

  it('can save multiple snapshots', () => {
    saveSnapshot(tmpDir, schemaFile, 'v1');
    saveSnapshot(tmpDir, schemaFile, 'v2');
    saveSnapshot(tmpDir, schemaFile, 'v3');
    const index = loadIndex(tmpDir);
    expect(index.snapshots).toHaveLength(3);
  });

  it('loads snapshot by id prefix', () => {
    const snap = saveSnapshot(tmpDir, schemaFile, 'test');
    const loaded = loadSnapshot(tmpDir, snap.id.slice(0, 4));
    expect(loaded).not.toBeNull();
    expect(loaded!.id).toBe(snap.id);
  });

  it('loads snapshot by exact tag', () => {
    saveSnapshot(tmpDir, schemaFile, 'my-tag');
    const loaded = loadSnapshot(tmpDir, 'my-tag');
    expect(loaded).not.toBeNull();
    expect(loaded!.tag).toBe('my-tag');
  });

  it('returns null for non-existent ref', () => {
    const result = loadSnapshot(tmpDir, 'nonexistent');
    expect(result).toBeNull();
  });

  it('deletes a snapshot by tag', () => {
    saveSnapshot(tmpDir, schemaFile, 'to-delete');
    const ok = deleteSnapshot(tmpDir, 'to-delete');
    expect(ok).toBe(true);
    const index = loadIndex(tmpDir);
    expect(index.snapshots).toHaveLength(0);
  });

  it('deletes a snapshot by id prefix', () => {
    const snap = saveSnapshot(tmpDir, schemaFile, 'temp');
    const ok = deleteSnapshot(tmpDir, snap.id.slice(0, 5));
    expect(ok).toBe(true);
    expect(loadSnapshot(tmpDir, snap.id)).toBeNull();
  });

  it('returns false when deleting non-existent snapshot', () => {
    const ok = deleteSnapshot(tmpDir, 'ghost');
    expect(ok).toBe(false);
  });

  it('returns empty index when no history exists', () => {
    const index = loadIndex(tmpDir);
    expect(index.snapshots).toEqual([]);
  });
});
