import * as fs from 'fs';
import { Schema } from '../types';
import { computeDiff, generateMigrationSQL } from '../core/diff';

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


