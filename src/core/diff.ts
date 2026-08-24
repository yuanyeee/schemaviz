import {
  Schema,
  SchemaDiff,
  TableDiff,
  ColumnDiff,
  IndexDiff,
  ForeignKeyDiff,
  Column,
  Index,
  ForeignKey,
  DatabaseType,
} from '../types';
import { formatColumnType } from './columnType';

export function computeDiff(schema1: Schema, schema2: Schema): SchemaDiff {
  const tables1 = new Map(schema1.tables.map((t) => [t.name, t]));
  const tables2 = new Map(schema2.tables.map((t) => [t.name, t]));

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
      const indexDiffs = computeIndexDiffs(table1.indexes, table2.indexes);
      const fkDiffs = computeForeignKeyDiffs(table1.foreignKeys, table2.foreignKeys);
      if (columnDiffs.length > 0 || indexDiffs.length > 0 || fkDiffs.length > 0) {
        const mod: TableDiff = { name, type: 'modified' };
        if (columnDiffs.length > 0) mod.columns = columnDiffs;
        if (indexDiffs.length > 0) mod.indexes = indexDiffs;
        if (fkDiffs.length > 0) mod.foreignKeys = fkDiffs;
        result.modified.push(mod);
      }
    }
  }

  return result;
}

function computeColumnDiffs(columns1: Column[], columns2: Column[]): ColumnDiff[] {
  const cols1 = new Map(columns1.map((c) => [c.name, c]));
  const cols2 = new Map(columns2.map((c) => [c.name, c]));
  const diffs: ColumnDiff[] = [];

  for (const [name, col2] of cols2) {
    if (!cols1.has(name)) {
      // Carry the new column definition so migration SQL can emit ALTER TABLE ... ADD
      diffs.push({
        name,
        type: 'added',
        newType: col2.type,
        newNullable: col2.nullable,
        newDefault: col2.defaultValue,
        newLength: col2.length,
        newPrecision: col2.precision,
        newScale: col2.scale,
      });
    }
  }

  for (const [name, col1] of cols1) {
    const col2 = cols2.get(name);
    if (!col2) {
      // Carry the old column definition so the removed column is fully described
      diffs.push({
        name,
        type: 'removed',
        oldType: col1.type,
        oldNullable: col1.nullable,
        oldDefault: col1.defaultValue,
        oldLength: col1.length,
        oldPrecision: col1.precision,
        oldScale: col1.scale,
      });
    } else if (
      col1.type !== col2.type ||
      col1.nullable !== col2.nullable ||
      col1.length !== col2.length ||
      col1.precision !== col2.precision ||
      col1.scale !== col2.scale ||
      col1.defaultValue !== col2.defaultValue
    ) {
      diffs.push({
        name,
        type: 'modified',
        oldType: col1.type,
        newType: col2.type,
        oldNullable: col1.nullable,
        newNullable: col2.nullable,
        oldLength: col1.length,
        newLength: col2.length,
        oldPrecision: col1.precision,
        newPrecision: col2.precision,
        oldScale: col1.scale,
        newScale: col2.scale,
        oldDefault: col1.defaultValue,
        newDefault: col2.defaultValue,
      });
    }
  }

  return diffs;
}

function arraysEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function computeIndexDiffs(indexes1: Index[], indexes2: Index[]): IndexDiff[] {
  const map1 = new Map(indexes1.map((i) => [i.name, i]));
  const map2 = new Map(indexes2.map((i) => [i.name, i]));
  const diffs: IndexDiff[] = [];

  for (const [name, idx2] of map2) {
    if (!map1.has(name)) {
      diffs.push({ name, type: 'added', columns: idx2.columns, isUnique: idx2.isUnique });
    }
  }

  for (const [name, idx1] of map1) {
    const idx2 = map2.get(name);
    if (!idx2) {
      diffs.push({ name, type: 'removed', columns: idx1.columns, isUnique: idx1.isUnique });
    } else if (!arraysEqual(idx1.columns, idx2.columns) || idx1.isUnique !== idx2.isUnique) {
      diffs.push({
        name,
        type: 'modified',
        columns: idx2.columns,
        isUnique: idx2.isUnique,
        oldColumns: idx1.columns,
        oldIsUnique: idx1.isUnique,
      });
    }
  }

  return diffs;
}

function computeForeignKeyDiffs(fks1: ForeignKey[], fks2: ForeignKey[]): ForeignKeyDiff[] {
  const map1 = new Map(fks1.map((f) => [f.name, f]));
  const map2 = new Map(fks2.map((f) => [f.name, f]));
  const diffs: ForeignKeyDiff[] = [];

  for (const [name, fk2] of map2) {
    if (!map1.has(name)) {
      diffs.push({
        name,
        type: 'added',
        columns: fk2.columns,
        referencedTable: fk2.referencedTable,
        referencedColumns: fk2.referencedColumns,
      });
    }
  }

  for (const [name, fk1] of map1) {
    const fk2 = map2.get(name);
    if (!fk2) {
      diffs.push({
        name,
        type: 'removed',
        columns: fk1.columns,
        referencedTable: fk1.referencedTable,
        referencedColumns: fk1.referencedColumns,
      });
    } else if (
      !arraysEqual(fk1.columns, fk2.columns) ||
      fk1.referencedTable !== fk2.referencedTable ||
      !arraysEqual(fk1.referencedColumns, fk2.referencedColumns)
    ) {
      diffs.push({
        name,
        type: 'modified',
        columns: fk2.columns,
        referencedTable: fk2.referencedTable,
        referencedColumns: fk2.referencedColumns,
        oldColumns: fk1.columns,
        oldReferencedTable: fk1.referencedTable,
        oldReferencedColumns: fk1.referencedColumns,
      });
    }
  }

  return diffs;
}
/** Whether the dialect wraps the script in an explicit transaction. */
function usesTransaction(dialect: DatabaseType): boolean {
  // MySQL auto-commits DDL; SQLite DDL is transactional per statement but the
  // emitted subset does not need an explicit wrapper.
  return dialect === 'postgresql' || dialect === 'sqlserver';
}

/** Builds a column definition fragment: "name TYPE [NOT NULL] [DEFAULT x]". */
function columnDef(name: string, type: string, nullable: boolean, defaultValue?: string): string {
  let def = `${name} ${type}`;
  if (!nullable) def += ' NOT NULL';
  if (defaultValue) def += ` DEFAULT ${defaultValue}`;
  return def;
}

function addColumnSQL(dialect: DatabaseType, table: string, colDiff: ColumnDiff): string {
  if (!colDiff.newType) {
    return `-- TODO: Add column ${table}.${colDiff.name} (column definition missing)\n`;
  }
  const nullable = colDiff.newNullable !== false;
  if (dialect === 'sqlite' && !nullable && !colDiff.newDefault) {
    return `-- TODO: manual migration required: SQLite cannot ADD COLUMN ${table}.${colDiff.name} with NOT NULL unless a non-null DEFAULT is provided\n`;
  }
  const targetType = formatColumnType(
    colDiff.newType,
    colDiff.newLength,
    colDiff.newPrecision,
    colDiff.newScale,
  );
  const def = columnDef(colDiff.name, targetType, nullable, colDiff.newDefault);
  // MySQL/SQLite use the explicit ADD COLUMN keyword; PostgreSQL/SQL Server accept ADD.
  const keyword = dialect === 'mysql' || dialect === 'sqlite' ? 'ADD COLUMN' : 'ADD';
  return `ALTER TABLE ${table} ${keyword} ${def};\n`;
}

function dropColumnSQL(dialect: DatabaseType, table: string, name: string): string {
  if (dialect === 'sqlite') {
    // DROP COLUMN requires SQLite >= 3.35.0; flag it so older targets are migrated manually.
    return `-- Note: DROP COLUMN requires SQLite 3.35.0 or later\nALTER TABLE ${table} DROP COLUMN ${name};\n`;
  }
  return `ALTER TABLE ${table} DROP COLUMN ${name};\n`;
}

/**
 * Emits the dialect-specific statement(s) that change a column's type and/or
 * nullability toward the given direction ('forward' → new*, 'rollback' → old*).
 */
function modifyColumnSQL(
  dialect: DatabaseType,
  table: string,
  colDiff: ColumnDiff,
  direction: 'forward' | 'rollback',
): string {
  const typeChanged =
    colDiff.oldType !== colDiff.newType ||
    colDiff.oldLength !== colDiff.newLength ||
    colDiff.oldPrecision !== colDiff.newPrecision ||
    colDiff.oldScale !== colDiff.newScale;
  const nullableChanged = colDiff.oldNullable !== colDiff.newNullable;
  if (!typeChanged && !nullableChanged) return '';

  const rawTarget = direction === 'forward' ? colDiff.newType : colDiff.oldType;
  const targetType =
    rawTarget == null
      ? undefined
      : formatColumnType(
          rawTarget,
          direction === 'forward' ? colDiff.newLength : colDiff.oldLength,
          direction === 'forward' ? colDiff.newPrecision : colDiff.oldPrecision,
          direction === 'forward' ? colDiff.newScale : colDiff.oldScale,
        );
  const targetNullable = direction === 'forward' ? colDiff.newNullable : colDiff.oldNullable;

  switch (dialect) {
    case 'mysql':
      // MySQL redefines the whole column with MODIFY COLUMN (type incl. length/precision).
      if (!targetType) {
        return `-- TODO: Modify column ${table}.${colDiff.name} (column definition missing)\n`;
      }
      return `ALTER TABLE ${table} MODIFY COLUMN ${columnDef(colDiff.name, targetType, targetNullable !== false)};\n`;
    case 'sqlserver':
      // SQL Server requires the nullability in ALTER COLUMN.
      if (!targetType) {
        return `-- TODO: Modify column ${table}.${colDiff.name} (column definition missing)\n`;
      }
      return `ALTER TABLE ${table} ALTER COLUMN ${colDiff.name} ${targetType}${targetNullable === false ? ' NOT NULL' : ' NULL'};\n`;
    case 'sqlite':
      return `-- TODO: manual migration required: SQLite does not support altering column ${table}.${colDiff.name} (recreate the table with the new definition)\n`;
    default: {
      // PostgreSQL
      let out = '';
      if (typeChanged && targetType) {
        out += `ALTER TABLE ${table} ALTER COLUMN ${colDiff.name} TYPE ${targetType};\n`;
      }
      if (nullableChanged) {
        out += `ALTER TABLE ${table} ALTER COLUMN ${colDiff.name}`;
        out += targetNullable ? ' DROP NOT NULL' : ' SET NOT NULL';
        out += ';\n';
      }
      return out;
    }
  }
}

/** Emits a TODO comment when a column's default value changed (direction-aware). */
function defaultChangeSQL(
  table: string,
  colDiff: ColumnDiff,
  direction: 'forward' | 'rollback',
): string {
  const from = direction === 'forward' ? colDiff.oldDefault : colDiff.newDefault;
  const to = direction === 'forward' ? colDiff.newDefault : colDiff.oldDefault;
  if (from === to) return '';
  return `-- TODO: Change default of ${table}.${colDiff.name} from ${from ?? 'NULL'} to ${to ?? 'NULL'}\n`;
}

/** Emits TODO comments for index/FK changes (dialect-specific DDL is intentionally not generated yet). */
function indexAndFkTodoSQL(mod: TableDiff, direction: 'forward' | 'rollback'): string {
  let out = '';
  const fwd = direction === 'forward';

  for (const idx of mod.indexes ?? []) {
    const added = fwd ? idx.type === 'added' : idx.type === 'removed';
    const removed = fwd ? idx.type === 'removed' : idx.type === 'added';
    if (added) {
      out += `-- TODO: Create ${idx.isUnique ? 'unique ' : ''}index ${idx.name} on ${mod.name} (${(idx.columns ?? []).join(', ')})\n`;
    } else if (removed) {
      out += `-- TODO: Drop index ${idx.name} on ${mod.name}\n`;
    } else {
      out += `-- TODO: Recreate index ${idx.name} on ${mod.name} (definition changed)\n`;
    }
  }

  for (const fk of mod.foreignKeys ?? []) {
    const added = fwd ? fk.type === 'added' : fk.type === 'removed';
    const removed = fwd ? fk.type === 'removed' : fk.type === 'added';
    if (added) {
      out += `-- TODO: Add foreign key ${fk.name} on ${mod.name} (${(fk.columns ?? []).join(', ')}) -> ${fk.referencedTable ?? '?'}\n`;
    } else if (removed) {
      out += `-- TODO: Drop foreign key ${fk.name} on ${mod.name}\n`;
    } else {
      out += `-- TODO: Recreate foreign key ${fk.name} on ${mod.name} (definition changed)\n`;
    }
  }

  return out;
}
export function generateMigrationSQL(
  database: string,
  diff: SchemaDiff,
  dialect: DatabaseType = 'postgresql',
): string {
  const transactional = usesTransaction(dialect);

  let sql = `-- Migration Script\n`;
  sql += `-- Database: ${database}\n`;
  sql += `-- Dialect: ${dialect}\n`;
  sql += `-- Generated: ${new Date().toISOString()}\n\n`;
  if (transactional) {
    sql += 'BEGIN TRANSACTION;\n\n';
  } else if (dialect === 'mysql') {
    sql += '-- Note: MySQL auto-commits DDL statements; no transaction wrapper is emitted.\n\n';
  } else {
    sql +=
      '-- Note: SQLite has limited ALTER TABLE support; unsupported changes are marked TODO.\n\n';
  }

  for (const table of diff.removed) {
    sql += `-- Drop table: ${table.name}\n`;
    sql += `DROP TABLE IF EXISTS ${table.name};\n\n`;
  }

  for (const table of diff.added) {
    sql += `-- Create table: ${table.name}\n`;
    sql += `CREATE TABLE ${table.name} (\n`;
    const colDefs = table.columns.map((col) => {
      let def = `  ${col.name} ${formatColumnType(col.type, col.length, col.precision, col.scale)}`;
      if (!col.nullable) def += ' NOT NULL';
      if (col.defaultValue) def += ` DEFAULT ${col.defaultValue}`;
      if (col.isPrimaryKey) def += ' PRIMARY KEY';
      return def;
    });
    sql += colDefs.join(',\n');
    sql += '\n);\n\n';
  }

  for (const mod of diff.modified) {
    sql += `-- Modify table: ${mod.name}\n`;
    if (mod.columns) {
      for (const colDiff of mod.columns) {
        if (colDiff.type === 'added') {
          sql += addColumnSQL(dialect, mod.name, colDiff);
        } else if (colDiff.type === 'removed') {
          sql += dropColumnSQL(dialect, mod.name, colDiff.name);
        } else if (colDiff.type === 'modified') {
          sql += modifyColumnSQL(dialect, mod.name, colDiff, 'forward');
          sql += defaultChangeSQL(mod.name, colDiff, 'forward');
        }
      }
    }
    sql += indexAndFkTodoSQL(mod, 'forward');
    sql += '\n';
  }

  if (transactional) sql += 'COMMIT;\n\n';
  sql += '-- Rollback Script\n';
  if (transactional) sql += 'BEGIN TRANSACTION;\n\n';

  for (const mod of diff.modified) {
    if (mod.columns) {
      for (const colDiff of mod.columns) {
        if (colDiff.type === 'added') {
          sql += dropColumnSQL(dialect, mod.name, colDiff.name);
        } else if (colDiff.type === 'removed') {
          sql += `-- TODO: Restore column ${colDiff.name} (requires original definition)\n`;
        } else if (colDiff.type === 'modified') {
          sql += modifyColumnSQL(dialect, mod.name, colDiff, 'rollback');
          sql += defaultChangeSQL(mod.name, colDiff, 'rollback');
        }
      }
    }
    sql += indexAndFkTodoSQL(mod, 'rollback');
  }

  for (const table of diff.added.slice().reverse()) {
    sql += `DROP TABLE IF EXISTS ${table.name};\n`;
  }

  for (const table of diff.removed) {
    sql += `-- TODO: Recreate table ${table.name}\n`;
  }

  if (transactional) sql += '\nCOMMIT;\n';
  return sql;
}
