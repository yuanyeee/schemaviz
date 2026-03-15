import * as path from 'path';
import { saveSnapshot, loadIndex, loadSnapshot, deleteSnapshot } from '../core/history';
import { Schema } from '../types';

interface SnapshotOptions {
  schema: string;
  tag?: string;
  dir: string;
}

interface HistoryListOptions {
  dir: string;
  json: boolean;
}

interface HistoryShowOptions {
  ref: string;
  dir: string;
  json: boolean;
}

interface HistoryDeleteOptions {
  ref: string;
  dir: string;
}

export async function snapshotSave(options: SnapshotOptions) {
  const baseDir = path.resolve(options.dir);
  const tag = options.tag ?? new Date().toISOString().replace(/[:.]/g, '-');

  const snap = saveSnapshot(baseDir, options.schema, tag);

  console.log(`Snapshot saved:`);
  console.log(`  id:   ${snap.id}`);
  console.log(`  tag:  ${snap.tag}`);
  console.log(`  time: ${snap.savedAt}`);
  console.log(`  tables: ${snap.schema.tables.length}`);
}

export async function historyList(options: HistoryListOptions) {
  const baseDir = path.resolve(options.dir);
  const index = loadIndex(baseDir);

  if (options.json) {
    console.log(JSON.stringify(index, null, 2));
    return;
  }

  if (index.snapshots.length === 0) {
    console.log('No snapshots found. Run `schemaviz snapshot -s schema.json` to create one.');
    return;
  }

  console.log('Snapshots:');
  console.log('');
  const pad = (s: string, n: number) => s.padEnd(n);
  console.log(`  ${pad('ID', 10)} ${pad('Tag', 30)} ${pad('Saved At', 25)}`);
  console.log(`  ${'─'.repeat(10)} ${'─'.repeat(30)} ${'─'.repeat(25)}`);

  for (const s of index.snapshots) {
    const date = new Date(s.savedAt).toLocaleString();
    console.log(`  ${pad(s.id, 10)} ${pad(s.tag, 30)} ${date}`);
  }
  console.log('');
  console.log(`Total: ${index.snapshots.length} snapshot(s)`);
}

export async function historyShow(options: HistoryShowOptions) {
  const baseDir = path.resolve(options.dir);
  const snap = loadSnapshot(baseDir, options.ref);

  if (!snap) {
    console.error(`Snapshot not found: ${options.ref}`);
    process.exit(1);
  }

  if (options.json) {
    console.log(JSON.stringify(snap.schema, null, 2));
    return;
  }

  console.log(`Snapshot: ${snap.id}`);
  console.log(`  Tag:       ${snap.tag}`);
  console.log(`  Saved at:  ${snap.savedAt}`);
  console.log(`  Database:  ${snap.schema.database}`);
  console.log(`  Tables:    ${snap.schema.tables.length}`);
  console.log('');

  for (const table of snap.schema.tables) {
    console.log(`  ▦ ${table.name} (${table.columns.length} columns)`);
    for (const col of table.columns) {
      const flags = [
        col.isPrimaryKey ? 'PK' : '',
        col.isForeignKey ? 'FK' : '',
        col.nullable ? 'null' : '',
      ].filter(Boolean).join(' ');
      console.log(`      ${col.name.padEnd(20)} ${col.type.padEnd(20)} ${flags}`);
    }
  }
}

export async function historyDelete(options: HistoryDeleteOptions) {
  const baseDir = path.resolve(options.dir);
  const ok = deleteSnapshot(baseDir, options.ref);

  if (ok) {
    console.log(`Snapshot deleted: ${options.ref}`);
  } else {
    console.error(`Snapshot not found: ${options.ref}`);
    process.exit(1);
  }
}
