import { Schema, SchemaDiff, ColumnDiff } from '../types';

export function computeDiff(schema1: Schema, schema2: Schema): SchemaDiff {
  const tables1 = new Map(schema1.tables.map(t => [t.name, t]));
  const tables2 = new Map(schema2.tables.map(t => [t.name, t]));

  const result: SchemaDiff = {
    added: [],
    removed: [],
    modified: [],
  };

  for (const [name, table] of tables2) {
    if (!tables1.has(name)) result.added.push(table);
  }

  for (const [name, table] of tables1) {
    if (!tables2.has(name)) result.removed.push(table);
  }

  for (const [name, table1] of tables1) {
    const table2 = tables2.get(name);
    if (table2) {
      const columnDiffs = computeColumnDiffs(table1.columns, table2.columns);
      if (columnDiffs.length > 0) {
        result.modified.push({ name, type: 'modified', columns: columnDiffs });
      }
    }
  }

  return result;
}

function computeColumnDiffs(columns1: any[], columns2: any[]): ColumnDiff[] {
  const cols1 = new Map(columns1.map(c => [c.name, c]));
  const cols2 = new Map(columns2.map(c => [c.name, c]));
  const diffs: ColumnDiff[] = [];

  for (const [name] of cols2) {
    if (!cols1.has(name)) diffs.push({ name, type: 'added' });
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
        newNullable: col2.nullable,
      });
    }
  }

  return diffs;
}

export function generateMigrationSQL(database: string, diff: SchemaDiff): string {
  let sql = `-- Migration Script\n`;
  sql += `-- Database: ${database}\n`;
  sql += `-- Generated: ${new Date().toISOString()}\n\n`;
  sql += 'BEGIN TRANSACTION;\n\n';

  for (const table of diff.removed) {
    sql += `-- Drop table: ${table.name}\n`;
    sql += `DROP TABLE IF EXISTS ${table.name};\n\n`;
  }

  for (const table of diff.added) {
    sql += `-- Create table: ${table.name}\n`;
    sql += `CREATE TABLE ${table.name} (\n`;
    const colDefs = table.columns.map(col => {
      let def = `  ${col.name} ${col.type}`;
      if (!col.nullable) def += ' NOT NULL';
      if (col.defaultValue) def += ` DEFAULT ${col.defaultValue}`;
      if (col.isPrimaryKey) def += ' PRIMARY KEY';
      return def;
    });
    sql += colDefs.join(',\n');
    sql += '\n);\n\n';
  }

  for (const mod of diff.modified) {
    if (!mod.columns) continue;
    sql += `-- Modify table: ${mod.name}\n`;
    for (const colDiff of mod.columns) {
      if (colDiff.type === 'added') {
        const addedTable = diff.added.find(t => t.name === mod.name);
        const col = addedTable?.columns.find(c => c.name === colDiff.name);
        if (col) {
          sql += `ALTER TABLE ${mod.name} ADD ${col.name} ${col.type}`;
          if (!col.nullable) sql += ' NOT NULL';
          if (col.defaultValue) sql += ` DEFAULT ${col.defaultValue}`;
          sql += ';\n';
        }
      } else if (colDiff.type === 'removed') {
        sql += `ALTER TABLE ${mod.name} DROP COLUMN ${colDiff.name};\n`;
      } else if (colDiff.type === 'modified') {
        if (colDiff.oldType !== colDiff.newType) {
          sql += `ALTER TABLE ${mod.name} ALTER COLUMN ${colDiff.name} TYPE ${colDiff.newType};\n`;
        }
        if (colDiff.oldNullable !== colDiff.newNullable) {
          sql += `ALTER TABLE ${mod.name} ALTER COLUMN ${colDiff.name}`;
          sql += colDiff.newNullable ? ' DROP NOT NULL' : ' SET NOT NULL';
          sql += ';\n';
        }
      }
    }
    sql += '\n';
  }

  sql += 'COMMIT;\n\n';
  sql += '-- Rollback Script\n';
  sql += 'BEGIN TRANSACTION;\n\n';

  for (const mod of diff.modified) {
    if (!mod.columns) continue;
    for (const colDiff of mod.columns) {
      if (colDiff.type === 'added') {
        sql += `ALTER TABLE ${mod.name} DROP COLUMN ${colDiff.name};\n`;
      } else if (colDiff.type === 'removed') {
        sql += `-- TODO: Restore column ${colDiff.name} (requires original definition)\n`;
      } else if (colDiff.type === 'modified') {
        if (colDiff.oldType !== colDiff.newType) {
          sql += `ALTER TABLE ${mod.name} ALTER COLUMN ${colDiff.name} TYPE ${colDiff.oldType};\n`;
        }
        if (colDiff.oldNullable !== colDiff.newNullable) {
          sql += `ALTER TABLE ${mod.name} ALTER COLUMN ${colDiff.name}`;
          sql += colDiff.oldNullable ? ' DROP NOT NULL' : ' SET NOT NULL';
          sql += ';\n';
        }
      }
    }
  }

  for (const table of diff.added.slice().reverse()) {
    sql += `DROP TABLE IF EXISTS ${table.name};\n`;
  }

  for (const table of diff.removed) {
    sql += `-- TODO: Recreate table ${table.name}\n`;
  }

  sql += '\nCOMMIT;\n';
  return sql;
}
