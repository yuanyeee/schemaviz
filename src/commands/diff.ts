import * as fs from 'fs';
import { Schema, SchemaDiff, TableDiff, ColumnDiff } from '../types';

interface DiffOptions {
  schema1: string;
  schema2: string;
  output?: string;
  migration?: string;
}

export async function diff(options: DiffOptions) {
  console.log('Comparing schemas...');
  console.log(`Schema 1: ${options.schema1}`);
  console.log(`Schema 2: ${options.schema2}`);

  const schema1: Schema = JSON.parse(fs.readFileSync(options.schema1, 'utf-8'));
  const schema2: Schema = JSON.parse(fs.readFileSync(options.schema2, 'utf-8'));

  const diffResult = computeDiff(schema1, schema2);

  // Generate migration SQL
  const migrationSQL = generateMigrationSQL(schema1.database, diffResult);

  // Combine output
  const output = {
    diff: diffResult,
    migration: migrationSQL,
  };

  if (options.output) {
    fs.writeFileSync(options.output, JSON.stringify(output.diff, null, 2));
    console.log(`Diff saved to ${options.output}`);
  }

  if (options.migration) {
    fs.writeFileSync(options.migration, migrationSQL);
    console.log(`Migration SQL saved to ${options.migration}`);
  } else {
    console.log('\n--- Migration SQL ---\n');
    console.log(migrationSQL);
  }
}

function computeDiff(schema1: Schema, schema2: Schema): SchemaDiff {
  const tables1 = new Map(schema1.tables.map(t => [t.name, t]));
  const tables2 = new Map(schema2.tables.map(t => [t.name, t]));

  const result: SchemaDiff = {
    added: [],
    removed: [],
    modified: [],
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
          columns: columnDiffs,
        });
      }
    }
  }

  return result;
}

function computeColumnDiffs(columns1: any[], columns2: any[]) {
  const cols1 = new Map(columns1.map(c => [c.name, c]));
  const cols2 = new Map(columns2.map(c => [c.name, c]));
  const diffs: ColumnDiff[] = [];

  // Find added columns
  for (const [name, col2] of cols2) {
    if (!cols1.has(name)) {
      diffs.push({ name, type: 'added' });
    }
  }

  // Find removed columns
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

function generateMigrationSQL(database: string, diff: SchemaDiff): string {
  let sql = `-- Migration Script\n`;
  sql += `-- Database: ${database}\n`;
  sql += `-- Generated: ${new Date().toISOString()}\n\n`;
  sql += 'BEGIN TRANSACTION;\n\n';

  // Drop removed tables
  for (const table of diff.removed) {
    sql += `-- Drop table: ${table.name}\n`;
    sql += `DROP TABLE IF EXISTS ${table.name};\n\n`;
  }

  // Add new tables
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

  // Modify existing tables
  for (const mod of diff.modified) {
    if (!mod.columns) continue;
    
    sql += `-- Modify table: ${mod.name}\n`;
    
    for (const colDiff of mod.columns) {
      if (colDiff.type === 'added') {
        // Find the column in added
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

  // Reverse the changes for rollback
  // (Simplified - just inverse the operations)
  for (const mod of diff.modified) {
    if (!mod.columns) continue;
    
    for (const colDiff of mod.columns) {
      if (colDiff.type === 'added') {
        sql += `ALTER TABLE ${mod.name} DROP COLUMN ${colDiff.name};\n`;
      } else if (colDiff.type === 'removed') {
        // Would need original column definition to restore
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

  // Drop added tables (in reverse order)
  for (const table of diff.added.reverse()) {
    sql += `DROP TABLE IF EXISTS ${table.name};\n`;
  }

  // Restore removed tables (simplified)
  for (const table of diff.removed) {
    sql += `-- TODO: Recreate table ${table.name}\n`;
  }

  sql += '\nCOMMIT;\n';

  return sql;
}
