import { describe, it, expect } from 'vitest';
import { validateSchema } from '../../src/core/validator';
import { Schema, Table } from '../../src/types';

function makeSchema(tables: Table[]): Schema {
  return { database: 'test_db', tables, generatedAt: new Date().toISOString() };
}

function makeTable(overrides: Partial<Table> & { name: string }): Table {
  return {
    columns: [],
    indexes: [],
    foreignKeys: [],
    ...overrides,
  };
}

describe('validateSchema', () => {
  it('passes a clean schema with no issues', () => {
    const schema = makeSchema([
      makeTable({
        name: 'users',
        columns: [
          { name: 'id', type: 'INTEGER', nullable: false, isPrimaryKey: true, isForeignKey: false },
          { name: 'email', type: 'VARCHAR(255)', nullable: false, isPrimaryKey: false, isForeignKey: false },
          { name: 'created_at', type: 'TIMESTAMP', nullable: false, isPrimaryKey: false, isForeignKey: false },
        ],
        indexes: [
          { name: 'users_pkey', columns: ['id'], isUnique: true },
          { name: 'users_email_uniq', columns: ['email'], isUnique: true },
        ],
      }),
    ]);

    const result = validateSchema(schema);
    // Should only have info about missing updated_at, no errors or warnings
    expect(result.errorCount).toBe(0);
    expect(result.passed).toBe(true);
  });

  it('detects missing primary key (error)', () => {
    const schema = makeSchema([
      makeTable({
        name: 'no_pk',
        columns: [
          { name: 'name', type: 'VARCHAR(100)', nullable: true, isPrimaryKey: false, isForeignKey: false },
          { name: 'created_at', type: 'TIMESTAMP', nullable: false, isPrimaryKey: false, isForeignKey: false },
        ],
      }),
    ]);

    const result = validateSchema(schema);
    expect(result.errorCount).toBeGreaterThan(0);
    expect(result.passed).toBe(false);
    const issue = result.issues.find(i => i.rule === 'no-primary-key');
    expect(issue).toBeDefined();
    expect(issue?.level).toBe('error');
    expect(issue?.table).toBe('no_pk');
  });

  it('detects table with no columns (error)', () => {
    const schema = makeSchema([
      makeTable({ name: 'empty_table' }),
    ]);

    const result = validateSchema(schema);
    const issue = result.issues.find(i => i.rule === 'no-columns');
    expect(issue).toBeDefined();
    expect(issue?.level).toBe('error');
  });

  it('detects foreign key column missing index (warning)', () => {
    const schema = makeSchema([
      makeTable({
        name: 'posts',
        columns: [
          { name: 'id', type: 'INTEGER', nullable: false, isPrimaryKey: true, isForeignKey: false },
          { name: 'user_id', type: 'INTEGER', nullable: false, isPrimaryKey: false, isForeignKey: true },
          { name: 'created_at', type: 'TIMESTAMP', nullable: false, isPrimaryKey: false, isForeignKey: false },
        ],
        indexes: [
          { name: 'posts_pkey', columns: ['id'], isUnique: true },
          // No index on user_id
        ],
        foreignKeys: [
          { name: 'posts_user_fk', columns: ['user_id'], referencedTable: 'users', referencedColumns: ['id'] },
        ],
      }),
    ]);

    const result = validateSchema(schema);
    const issue = result.issues.find(i => i.rule === 'fk-missing-index');
    expect(issue).toBeDefined();
    expect(issue?.level).toBe('warning');
    expect(issue?.column).toBe('user_id');
  });

  it('does not warn about FK column that has an index', () => {
    const schema = makeSchema([
      makeTable({
        name: 'posts',
        columns: [
          { name: 'id', type: 'INTEGER', nullable: false, isPrimaryKey: true, isForeignKey: false },
          { name: 'user_id', type: 'INTEGER', nullable: false, isPrimaryKey: false, isForeignKey: true },
          { name: 'created_at', type: 'TIMESTAMP', nullable: false, isPrimaryKey: false, isForeignKey: false },
        ],
        indexes: [
          { name: 'posts_pkey', columns: ['id'], isUnique: true },
          { name: 'idx_posts_user_id', columns: ['user_id'], isUnique: false },
        ],
        foreignKeys: [
          { name: 'posts_user_fk', columns: ['user_id'], referencedTable: 'users', referencedColumns: ['id'] },
        ],
      }),
    ]);

    const result = validateSchema(schema);
    const issue = result.issues.find(i => i.rule === 'fk-missing-index');
    expect(issue).toBeUndefined();
  });

  it('detects email column without unique index (warning)', () => {
    const schema = makeSchema([
      makeTable({
        name: 'users',
        columns: [
          { name: 'id', type: 'INTEGER', nullable: false, isPrimaryKey: true, isForeignKey: false },
          { name: 'email', type: 'VARCHAR(255)', nullable: false, isPrimaryKey: false, isForeignKey: false },
          { name: 'created_at', type: 'TIMESTAMP', nullable: false, isPrimaryKey: false, isForeignKey: false },
        ],
        indexes: [
          { name: 'users_pkey', columns: ['id'], isUnique: true },
          // No unique index on email
        ],
      }),
    ]);

    const result = validateSchema(schema);
    const issue = result.issues.find(i => i.rule === 'email-not-unique');
    expect(issue).toBeDefined();
    expect(issue?.level).toBe('warning');
  });

  it('detects _id column without foreign key constraint (warning)', () => {
    const schema = makeSchema([
      makeTable({
        name: 'orders',
        columns: [
          { name: 'id', type: 'INTEGER', nullable: false, isPrimaryKey: true, isForeignKey: false },
          { name: 'customer_id', type: 'INTEGER', nullable: false, isPrimaryKey: false, isForeignKey: false },
          { name: 'created_at', type: 'TIMESTAMP', nullable: false, isPrimaryKey: false, isForeignKey: false },
        ],
        indexes: [
          { name: 'orders_pkey', columns: ['id'], isUnique: true },
        ],
        foreignKeys: [],
      }),
    ]);

    const result = validateSchema(schema);
    const issue = result.issues.find(i => i.rule === 'id-column-missing-fk');
    expect(issue).toBeDefined();
    expect(issue?.level).toBe('warning');
    expect(issue?.column).toBe('customer_id');
  });

  it('detects missing timestamp columns (info)', () => {
    const schema = makeSchema([
      makeTable({
        name: 'products',
        columns: [
          { name: 'id', type: 'INTEGER', nullable: false, isPrimaryKey: true, isForeignKey: false },
          { name: 'name', type: 'VARCHAR(255)', nullable: false, isPrimaryKey: false, isForeignKey: false },
        ],
        indexes: [
          { name: 'products_pkey', columns: ['id'], isUnique: true },
        ],
      }),
    ]);

    const result = validateSchema(schema);
    const issue = result.issues.find(i => i.rule === 'missing-timestamps');
    expect(issue).toBeDefined();
    expect(issue?.level).toBe('info');
  });

  it('detects duplicate indexes (warning)', () => {
    const schema = makeSchema([
      makeTable({
        name: 'items',
        columns: [
          { name: 'id', type: 'INTEGER', nullable: false, isPrimaryKey: true, isForeignKey: false },
          { name: 'code', type: 'VARCHAR(50)', nullable: false, isPrimaryKey: false, isForeignKey: false },
          { name: 'created_at', type: 'TIMESTAMP', nullable: false, isPrimaryKey: false, isForeignKey: false },
        ],
        indexes: [
          { name: 'items_pkey', columns: ['id'], isUnique: true },
          { name: 'idx_items_code_1', columns: ['code'], isUnique: false },
          { name: 'idx_items_code_2', columns: ['code'], isUnique: false },
        ],
      }),
    ]);

    const result = validateSchema(schema);
    const issue = result.issues.find(i => i.rule === 'duplicate-index');
    expect(issue).toBeDefined();
    expect(issue?.level).toBe('warning');
  });

  it('detects nullable ID columns (warning)', () => {
    const schema = makeSchema([
      makeTable({
        name: 'logs',
        columns: [
          { name: 'id', type: 'INTEGER', nullable: true, isPrimaryKey: true, isForeignKey: false },
          { name: 'created_at', type: 'TIMESTAMP', nullable: false, isPrimaryKey: false, isForeignKey: false },
        ],
        indexes: [
          { name: 'logs_pkey', columns: ['id'], isUnique: true },
        ],
      }),
    ]);

    const result = validateSchema(schema);
    const issue = result.issues.find(i => i.rule === 'nullable-id-column');
    expect(issue).toBeDefined();
    expect(issue?.level).toBe('warning');
  });

  it('returns correct counts', () => {
    const schema = makeSchema([
      makeTable({ name: 'bad_table' }), // no-columns error + no-primary-key error + missing-timestamps info
    ]);

    const result = validateSchema(schema);
    expect(result.errorCount).toBe(2);
    expect(result.infoCount).toBe(1);
    expect(result.passed).toBe(false);
  });
});
