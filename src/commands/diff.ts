import * as fs from 'fs';
import { Schema, SchemaDiff } from '../types';

export async function diff(options: { schema1: string; schema2: string; output?: string }) {
  console.log('Comparing schemas...');
  console.log(`Schema 1: ${options.schema1}`);
  console.log(`Schema 2: ${options.schema2}`);

  const schema1: Schema = JSON.parse(fs.readFileSync(options.schema1, 'utf-8'));
  const schema2: Schema = JSON.parse(fs.readFileSync(options.schema2, 'utf-8'));

  const diffResult = computeDiff(schema1, schema2);

  const output = JSON.stringify(diffResult, null, 2);

  if (options.output) {
    fs.writeFileSync(options.output, output);
    console.log(`Diff saved to ${options.output}`);
  } else {
    console.log(output);
  }
}

function computeDiff(schema1: Schema, schema2: Schema): SchemaDiff {
  const tables1 = new Map(schema1.tables.map(t => [t.name, t]));
  const tables2 = new Map(schema2.tables.map(t => [t.name, t]));

  const result: SchemaDiff = {
    added: [],
    removed: [],
    modified: []
  };

  // Find added tables
  for (const [name, table] of tables2) {
    if (!tables1.has(name)) {
      result.added.push(table);
    }
  }

  // Find removed tables
  for (const [name, table] of tables1) {
    if (!tables2.has(name)) {
      result.removed.push(table);
    }
  }

  // Find modified tables
  for (const [name, table1] of tables1) {
    const table2 = tables2.get(name);
    if (table2) {
      const columnDiffs = computeColumnDiffs(table1.columns, table2.columns);
      if (columnDiffs.length > 0) {
        result.modified.push({
          name,
          type: 'modified',
          columns: columnDiffs
        });
      }
    }
  }

  return result;
}

function computeColumnDiffs(columns1: any[], columns2: any[]) {
  const cols1 = new Map(columns1.map(c => [c.name, c]));
  const cols2 = new Map(columns2.map(c => [c.name, c]));
  const diffs: any[] = [];

  for (const [name, col2] of cols2) {
    if (!cols1.has(name)) {
      diffs.push({ name, type: 'added' });
    }
  }

  for (const [name, col1] of cols1) {
    const col2 = cols2.get(name);
    if (!col2) {
      diffs.push({ name, type: 'removed' });
    } else if (col1.type !== col2.type || col1.nullable !== col2.nullable) {
      diffs.push({
        name,
        type: 'modified',
        oldType: col1.type,
        newType: col2.type,
        oldNullable: col1.nullable,
        newNullable: col2.nullable
      });
    }
  }

  return diffs;
}
