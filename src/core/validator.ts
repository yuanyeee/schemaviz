import { Schema, Table, Column, Index, ForeignKey } from '../types';

export type IssueLevel = 'error' | 'warning' | 'info';

export interface ValidationIssue {
  level: IssueLevel;
  table: string;
  column?: string;
  rule: string;
  message: string;
  suggestion: string;
}

export interface ValidationResult {
  schema: string;
  issues: ValidationIssue[];
  errorCount: number;
  warningCount: number;
  infoCount: number;
  passed: boolean;
}

// Columns that typically indicate audit/timestamp fields
const TIMESTAMP_COLUMNS = ['created_at', 'updated_at', 'created_on', 'updated_on'];

export function validateSchema(schema: Schema): ValidationResult {
  const issues: ValidationIssue[] = [];

  for (const table of schema.tables) {
    issues.push(...validateTable(table));
  }

  const errorCount = issues.filter(i => i.level === 'error').length;
  const warningCount = issues.filter(i => i.level === 'warning').length;
  const infoCount = issues.filter(i => i.level === 'info').length;

  return {
    schema: schema.database,
    issues,
    errorCount,
    warningCount,
    infoCount,
    passed: errorCount === 0,
  };
}

function validateTable(table: Table): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  issues.push(...checkNoPrimaryKey(table));
  issues.push(...checkNoColumns(table));
  issues.push(...checkForeignKeysMissingIndex(table));
  issues.push(...checkEmailWithoutUniqueIndex(table));
  issues.push(...checkIdColumnsWithoutForeignKey(table));
  issues.push(...checkMissingTimestamps(table));
  issues.push(...checkDuplicateIndexes(table));
  issues.push(...checkNullableIdColumns(table));

  return issues;
}

function checkNoPrimaryKey(table: Table): ValidationIssue[] {
  const hasPK =
    table.columns.some(c => c.isPrimaryKey) ||
    table.indexes.some(i => i.isUnique && i.columns.length > 0 && i.name.includes('pkey'));

  if (!hasPK) {
    return [
      {
        level: 'error',
        table: table.name,
        rule: 'no-primary-key',
        message: `テーブル "${table.name}" に主キーがありません`,
        suggestion: 'id 列を INTEGER PRIMARY KEY として追加するか、既存の列に主キー制約を設定してください',
      },
    ];
  }
  return [];
}

function checkNoColumns(table: Table): ValidationIssue[] {
  if (table.columns.length === 0) {
    return [
      {
        level: 'error',
        table: table.name,
        rule: 'no-columns',
        message: `テーブル "${table.name}" に列がありません`,
        suggestion: '最低1つの列を定義してください',
      },
    ];
  }
  return [];
}

function checkForeignKeysMissingIndex(table: Table): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const indexedColumns = new Set(table.indexes.flatMap(i => i.columns));

  for (const fk of table.foreignKeys) {
    for (const col of fk.columns) {
      if (!indexedColumns.has(col)) {
        issues.push({
          level: 'warning',
          table: table.name,
          column: col,
          rule: 'fk-missing-index',
          message: `外部キー列 "${table.name}.${col}" にインデックスがありません`,
          suggestion: `CREATE INDEX idx_${table.name}_${col} ON ${table.name}(${col}); を追加するとJOINパフォーマンスが改善されます`,
        });
      }
    }
  }
  return issues;
}

function checkEmailWithoutUniqueIndex(table: Table): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const col of table.columns) {
    if (col.name.toLowerCase() === 'email' || col.name.toLowerCase().endsWith('_email')) {
      const hasUniqueIndex = table.indexes.some(
        i => i.isUnique && i.columns.includes(col.name)
      );
      if (!hasUniqueIndex) {
        issues.push({
          level: 'warning',
          table: table.name,
          column: col.name,
          rule: 'email-not-unique',
          message: `列 "${table.name}.${col.name}" にユニークインデックスがありません`,
          suggestion: `CREATE UNIQUE INDEX idx_${table.name}_${col.name} ON ${table.name}(${col.name}); を追加して重複メールアドレスを防いでください`,
        });
      }
    }
  }
  return issues;
}

function checkIdColumnsWithoutForeignKey(table: Table): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const fkColumns = new Set(table.foreignKeys.flatMap(fk => fk.columns));

  for (const col of table.columns) {
    if (
      col.isForeignKey === false &&
      col.name.endsWith('_id') &&
      col.name !== 'id' &&
      !fkColumns.has(col.name)
    ) {
      issues.push({
        level: 'warning',
        table: table.name,
        column: col.name,
        rule: 'id-column-missing-fk',
        message: `列 "${table.name}.${col.name}" は外部キーのように見えますが、FK制約が定義されていません`,
        suggestion: '参照先テーブルへの FOREIGN KEY 制約を追加して参照整合性を保証してください',
      });
    }
  }
  return issues;
}

function checkMissingTimestamps(table: Table): ValidationIssue[] {
  const columnNames = new Set(table.columns.map(c => c.name.toLowerCase()));
  const hasTimestamp = TIMESTAMP_COLUMNS.some(ts => columnNames.has(ts));

  if (!hasTimestamp) {
    return [
      {
        level: 'info',
        table: table.name,
        rule: 'missing-timestamps',
        message: `テーブル "${table.name}" に監査タイムスタンプ列 (created_at / updated_at) がありません`,
        suggestion: 'created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP と updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP の追加を検討してください',
      },
    ];
  }
  return [];
}

function checkDuplicateIndexes(table: Table): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const seen = new Map<string, string>();

  for (const index of table.indexes) {
    const key = [...index.columns].sort().join(',');
    if (seen.has(key)) {
      issues.push({
        level: 'warning',
        table: table.name,
        rule: 'duplicate-index',
        message: `テーブル "${table.name}" に同じ列セット [${index.columns.join(', ')}] を持つ重複インデックスがあります: "${seen.get(key)}" と "${index.name}"`,
        suggestion: `重複するインデックスを削除して、ストレージと書き込みオーバーヘッドを削減してください`,
      });
    } else {
      seen.set(key, index.name);
    }
  }
  return issues;
}

function checkNullableIdColumns(table: Table): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const col of table.columns) {
    if ((col.name === 'id' || col.name.endsWith('_id')) && col.nullable) {
      issues.push({
        level: 'warning',
        table: table.name,
        column: col.name,
        rule: 'nullable-id-column',
        message: `ID列 "${table.name}.${col.name}" が NULL 許容になっています`,
        suggestion: 'ID列は通常 NOT NULL にすべきです。意図的でない場合は NOT NULL 制約を追加してください',
      });
    }
  }
  return issues;
}
