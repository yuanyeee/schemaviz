import * as fs from 'fs';
import * as path from 'path';
import { Schema } from '../types';

export interface Snapshot {
  id: string;           // short hash
  tag: string;          // user-provided label or auto-generated
  savedAt: string;      // ISO timestamp
  schemaFile: string;   // original source path
  schema: Schema;
}

export interface HistoryIndex {
  snapshots: Array<Omit<Snapshot, 'schema'>>;
}

const HISTORY_DIR = '.schemaviz';
const INDEX_FILE = 'index.json';
const SNAP_DIR = 'snapshots';

function historyDir(baseDir: string): string {
  return path.join(baseDir, HISTORY_DIR);
}

function indexPath(baseDir: string): string {
  return path.join(historyDir(baseDir), INDEX_FILE);
}

function snapshotPath(baseDir: string, id: string): string {
  return path.join(historyDir(baseDir), SNAP_DIR, `${id}.json`);
}

function generateId(): string {
  // 8-char hex id based on timestamp + random
  const ts = Date.now().toString(16);
  const rnd = Math.floor(Math.random() * 0xffff).toString(16).padStart(4, '0');
  return (ts + rnd).slice(-8);
}

function ensureDirs(baseDir: string): void {
  const hd = historyDir(baseDir);
  const sd = path.join(hd, SNAP_DIR);
  if (!fs.existsSync(hd)) fs.mkdirSync(hd, { recursive: true });
  if (!fs.existsSync(sd)) fs.mkdirSync(sd, { recursive: true });
  // .gitignore for snapshot data (large blobs)
  const gi = path.join(hd, '.gitignore');
  if (!fs.existsSync(gi)) fs.writeFileSync(gi, `snapshots/\n`);
}

export function loadIndex(baseDir: string): HistoryIndex {
  const ip = indexPath(baseDir);
  if (!fs.existsSync(ip)) return { snapshots: [] };
  return JSON.parse(fs.readFileSync(ip, 'utf-8'));
}

function saveIndex(baseDir: string, index: HistoryIndex): void {
  fs.writeFileSync(indexPath(baseDir), JSON.stringify(index, null, 2), 'utf-8');
}

export function saveSnapshot(
  baseDir: string,
  schemaFile: string,
  tag: string,
): Snapshot {
  ensureDirs(baseDir);

  const schema: Schema = JSON.parse(fs.readFileSync(schemaFile, 'utf-8'));
  const id = generateId();
  const savedAt = new Date().toISOString();

  const snapshot: Snapshot = {
    id,
    tag,
    savedAt,
    schemaFile: path.resolve(schemaFile),
    schema,
  };

  // Save full snapshot
  fs.writeFileSync(snapshotPath(baseDir, id), JSON.stringify(snapshot, null, 2), 'utf-8');

  // Update index
  const index = loadIndex(baseDir);
  index.snapshots.push({ id, tag, savedAt, schemaFile: path.resolve(schemaFile) });
  saveIndex(baseDir, index);

  return snapshot;
}

export function saveSnapshotFromData(baseDir: string, schema: Schema, tag: string): Snapshot {
  ensureDirs(baseDir);

  const id = generateId();
  const savedAt = new Date().toISOString();

  const snapshot: Snapshot = {
    id,
    tag,
    savedAt,
    schemaFile: '<live>',
    schema,
  };

  fs.writeFileSync(snapshotPath(baseDir, id), JSON.stringify(snapshot, null, 2), 'utf-8');

  const index = loadIndex(baseDir);
  index.snapshots.push({ id, tag, savedAt, schemaFile: '<live>' });
  saveIndex(baseDir, index);

  return snapshot;
}

export function loadSnapshot(baseDir: string, idOrTag: string): Snapshot | null {
  const index = loadIndex(baseDir);

  // Find by id prefix or exact tag
  const meta =
    index.snapshots.find(s => s.id.startsWith(idOrTag)) ??
    index.snapshots.find(s => s.tag === idOrTag);

  if (!meta) return null;

  const sp = snapshotPath(baseDir, meta.id);
  if (!fs.existsSync(sp)) return null;

  return JSON.parse(fs.readFileSync(sp, 'utf-8'));
}

export function deleteSnapshot(baseDir: string, idOrTag: string): boolean {
  const index = loadIndex(baseDir);
  const idx = index.snapshots.findIndex(
    s => s.id.startsWith(idOrTag) || s.tag === idOrTag,
  );
  if (idx === -1) return false;

  const [meta] = index.snapshots.splice(idx, 1);
  saveIndex(baseDir, index);

  const sp = snapshotPath(baseDir, meta.id);
  if (fs.existsSync(sp)) fs.unlinkSync(sp);
  return true;
}
