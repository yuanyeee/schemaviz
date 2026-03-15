import * as fs from 'fs';
import { Schema } from '../types';
import { validateSchema, ValidationIssue, IssueLevel } from '../core/validator';

interface ValidateOptions {
  schema: string;
  output?: string;
  format: 'text' | 'json';
  failOnWarning: boolean;
}

const LEVEL_ICON: Record<IssueLevel, string> = {
  error: '✖ ERROR  ',
  warning: '⚠ WARNING',
  info: 'ℹ INFO   ',
};

export async function validate(options: ValidateOptions) {
  const schema: Schema = JSON.parse(fs.readFileSync(options.schema, 'utf-8'));

  console.log(`Validating schema: ${schema.database} (${schema.tables.length} tables)`);
  console.log('');

  const result = validateSchema(schema);

  if (options.format === 'json') {
    const json = JSON.stringify(result, null, 2);
    if (options.output) {
      fs.writeFileSync(options.output, json);
      console.log(`Validation result saved to ${options.output}`);
    } else {
      console.log(json);
    }
  } else {
    printTextReport(result);

    if (options.output) {
      fs.writeFileSync(options.output, buildTextReport(result));
      console.log(`\nValidation report saved to ${options.output}`);
    }
  }

  // Exit with non-zero code on failures
  const shouldFail = result.errorCount > 0 || (options.failOnWarning && result.warningCount > 0);
  if (shouldFail) {
    process.exit(1);
  }
}

function printTextReport(result: ReturnType<typeof validateSchema>) {
  if (result.issues.length === 0) {
    console.log('✔ All checks passed! No issues found.');
    return;
  }

  // Group by table
  const byTable = new Map<string, ValidationIssue[]>();
  for (const issue of result.issues) {
    if (!byTable.has(issue.table)) byTable.set(issue.table, []);
    byTable.get(issue.table)!.push(issue);
  }

  for (const [table, issues] of byTable) {
    console.log(`Table: ${table}`);
    console.log('─'.repeat(60));
    for (const issue of issues) {
      const col = issue.column ? `.${issue.column}` : '';
      console.log(`  ${LEVEL_ICON[issue.level]}  [${issue.rule}]`);
      console.log(`             ${issue.message}`);
      console.log(`             → ${issue.suggestion}`);
      console.log('');
    }
  }

  // Summary
  console.log('═'.repeat(60));
  console.log('Summary:');
  if (result.errorCount > 0) console.log(`  ✖ Errors:   ${result.errorCount}`);
  if (result.warningCount > 0) console.log(`  ⚠ Warnings: ${result.warningCount}`);
  if (result.infoCount > 0) console.log(`  ℹ Info:     ${result.infoCount}`);
  console.log('');
  if (result.passed) {
    console.log('✔ Passed (no errors)');
  } else {
    console.log('✖ Failed (errors found)');
  }
}

function buildTextReport(result: ReturnType<typeof validateSchema>): string {
  const lines: string[] = [];

  lines.push(`Schema Validation Report: ${result.schema}`);
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');

  if (result.issues.length === 0) {
    lines.push('All checks passed! No issues found.');
    return lines.join('\n');
  }

  const byTable = new Map<string, ValidationIssue[]>();
  for (const issue of result.issues) {
    if (!byTable.has(issue.table)) byTable.set(issue.table, []);
    byTable.get(issue.table)!.push(issue);
  }

  for (const [table, issues] of byTable) {
    lines.push(`Table: ${table}`);
    lines.push('─'.repeat(60));
    for (const issue of issues) {
      lines.push(`  ${LEVEL_ICON[issue.level]}  [${issue.rule}]`);
      lines.push(`             ${issue.message}`);
      lines.push(`             → ${issue.suggestion}`);
      lines.push('');
    }
  }

  lines.push('═'.repeat(60));
  lines.push(`Errors: ${result.errorCount}, Warnings: ${result.warningCount}, Info: ${result.infoCount}`);
  lines.push(result.passed ? 'Result: PASSED' : 'Result: FAILED');

  return lines.join('\n');
}
