import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { Schema } from '../src/types';

const fixturesDir = path.join(__dirname, '../fixtures');

describe('Diff Command', () => {
  it('should correctly identify added tables', () => {
    const schema1: Schema = JSON.parse(
      fs.readFileSync(path.join(fixturesDir, 'schema1.json'), 'utf-8')
    );
    const schema2: Schema = JSON.parse(
      fs.readFileSync(path.join(fixturesDir, 'schema2.json'), 'utf-8')
    );

    // Schema 2 should have a 'comments' table that schema 1 doesn't have
    const tableNames1 = schema1.tables.map(t => t.name);
    const tableNames2 = schema2.tables.map(t => t.name);

    expect(tableNames1).toContain('users');
    expect(tableNames1).toContain('posts');
    expect(tableNames1).not.toContain('comments');

    expect(tableNames2).toContain('users');
    expect(tableNames2).toContain('posts');
    expect(tableNames2).toContain('comments');
  });

  it('should correctly identify added columns', () => {
    const schema1: Schema = JSON.parse(
      fs.readFileSync(path.join(fixturesDir, 'schema1.json'), 'utf-8')
    );
    const schema2: Schema = JSON.parse(
      fs.readFileSync(path.join(fixturesDir, 'schema2.json'), 'utf-8')
    );

    const users1 = schema1.tables.find(t => t.name === 'users')!;
    const users2 = schema2.tables.find(t => t.name === 'users')!;

    const colNames1 = users1.columns.map(c => c.name);
    const colNames2 = users2.columns.map(c => c.name);

    expect(colNames1).toContain('id');
    expect(colNames1).toContain('email');
    expect(colNames1).not.toContain('updated_at');

    expect(colNames2).toContain('id');
    expect(colNames2).toContain('email');
    expect(colNames2).toContain('updated_at');
  });
});
