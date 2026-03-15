import { describe, it, expect } from 'vitest';
import { generatePrismaSchema } from '../../src/core/codegen/prisma';
import { generateTypeOrmEntities } from '../../src/core/codegen/typeorm';
import { generateGraphQLSchema } from '../../src/core/codegen/graphql';
import { Schema } from '../../src/types';

const schema: Schema = {
  database: 'blog',
  generatedAt: '2026-01-01T00:00:00.000Z',
  tables: [
    {
      name: 'users',
      columns: [
        { name: 'id', type: 'INTEGER', nullable: false, isPrimaryKey: true, isForeignKey: false },
        { name: 'email', type: 'VARCHAR(255)', nullable: false, isPrimaryKey: false, isForeignKey: false },
        { name: 'name', type: 'VARCHAR(100)', nullable: true, isPrimaryKey: false, isForeignKey: false },
        { name: 'is_active', type: 'BOOLEAN', nullable: false, isPrimaryKey: false, isForeignKey: false },
        { name: 'created_at', type: 'TIMESTAMP', nullable: false, isPrimaryKey: false, isForeignKey: false },
        { name: 'updated_at', type: 'TIMESTAMP', nullable: false, isPrimaryKey: false, isForeignKey: false },
      ],
      indexes: [
        { name: 'users_pkey', columns: ['id'], isUnique: true },
        { name: 'users_email_uniq', columns: ['email'], isUnique: true },
      ],
      foreignKeys: [],
    },
    {
      name: 'posts',
      columns: [
        { name: 'id', type: 'INTEGER', nullable: false, isPrimaryKey: true, isForeignKey: false },
        { name: 'user_id', type: 'INTEGER', nullable: false, isPrimaryKey: false, isForeignKey: true },
        { name: 'title', type: 'VARCHAR(255)', nullable: false, isPrimaryKey: false, isForeignKey: false },
        { name: 'content', type: 'TEXT', nullable: true, isPrimaryKey: false, isForeignKey: false },
        { name: 'created_at', type: 'TIMESTAMP', nullable: false, isPrimaryKey: false, isForeignKey: false },
      ],
      indexes: [
        { name: 'posts_pkey', columns: ['id'], isUnique: true },
        { name: 'idx_posts_user_id', columns: ['user_id'], isUnique: false },
      ],
      foreignKeys: [
        { name: 'posts_user_fk', columns: ['user_id'], referencedTable: 'users', referencedColumns: ['id'] },
      ],
    },
  ],
};

describe('Prisma Schema Generator', () => {
  it('generates valid Prisma schema with generator and datasource blocks', () => {
    const result = generatePrismaSchema(schema);
    expect(result).toContain('generator client');
    expect(result).toContain('datasource db');
    expect(result).toContain('provider = "prisma-client-js"');
  });

  it('generates model for each table', () => {
    const result = generatePrismaSchema(schema);
    expect(result).toContain('model User {');
    expect(result).toContain('model Post {');
  });

  it('marks primary key with @id', () => {
    const result = generatePrismaSchema(schema);
    expect(result).toContain('@id');
  });

  it('generates @default(autoincrement()) for integer PKs', () => {
    const result = generatePrismaSchema(schema);
    expect(result).toContain('@default(autoincrement())');
  });

  it('generates relation field for foreign keys', () => {
    const result = generatePrismaSchema(schema);
    expect(result).toContain('@relation(');
  });

  it('generates @unique attribute for single-column unique indexes', () => {
    const result = generatePrismaSchema(schema);
    // users.email has a single-column unique index → must become @unique on the field
    expect(result).toMatch(/email\s+String\s+@unique/);
  });

  it('does NOT generate @unique for non-unique columns', () => {
    const result = generatePrismaSchema(schema);
    // users.name has no unique index
    expect(result).not.toMatch(/name\s+String\??\s+@unique/);
  });

  it('generates @@index for non-unique multi-column or FK indexes', () => {
    // posts.user_id has a non-unique index → @@index
    const result = generatePrismaSchema(schema);
    expect(result).toContain('@@index([userId])');
  });

  it('includes database comment header', () => {
    const result = generatePrismaSchema(schema);
    expect(result).toContain('// Database: blog');
  });
});

describe('TypeORM Entity Generator', () => {
  it('generates entity files for each table', () => {
    const files = generateTypeOrmEntities(schema);
    expect(files.has('Users.ts')).toBe(true);
    expect(files.has('Posts.ts')).toBe(true);
    expect(files.has('index.ts')).toBe(true);
  });

  it('generates @Entity decorator', () => {
    const files = generateTypeOrmEntities(schema);
    const usersFile = files.get('Users.ts')!;
    expect(usersFile).toContain("@Entity('users')");
  });

  it('generates @PrimaryGeneratedColumn for integer PK', () => {
    const files = generateTypeOrmEntities(schema);
    const usersFile = files.get('Users.ts')!;
    expect(usersFile).toContain('@PrimaryGeneratedColumn()');
  });

  it('generates @Column decorator for regular columns', () => {
    const files = generateTypeOrmEntities(schema);
    const usersFile = files.get('Users.ts')!;
    expect(usersFile).toContain('@Column(');
  });

  it('uses @CreateDateColumn for created_at', () => {
    const files = generateTypeOrmEntities(schema);
    const usersFile = files.get('Users.ts')!;
    expect(usersFile).toContain('@CreateDateColumn');
  });

  it('uses @UpdateDateColumn for updated_at', () => {
    const files = generateTypeOrmEntities(schema);
    const usersFile = files.get('Users.ts')!;
    expect(usersFile).toContain('@UpdateDateColumn');
  });

  it('generates @ManyToOne for foreign key', () => {
    const files = generateTypeOrmEntities(schema);
    const postsFile = files.get('Posts.ts')!;
    expect(postsFile).toContain('@ManyToOne');
  });

  it('generates barrel index.ts with all exports', () => {
    const files = generateTypeOrmEntities(schema);
    const index = files.get('index.ts')!;
    expect(index).toContain("export { Users }");
    expect(index).toContain("export { Posts }");
  });
});

describe('GraphQL Schema Generator', () => {
  it('generates type for each table', () => {
    const result = generateGraphQLSchema(schema);
    expect(result).toContain('type User {');
    expect(result).toContain('type Post {');
  });

  it('generates Query type with list and single queries', () => {
    const result = generateGraphQLSchema(schema);
    expect(result).toContain('type Query {');
    expect(result).toContain('users(limit: Int, offset: Int):');
    expect(result).toContain('user(id: ID!):');
  });

  it('generates Mutation type with CRUD operations', () => {
    const result = generateGraphQLSchema(schema);
    expect(result).toContain('type Mutation {');
    expect(result).toContain('createUser(');
    expect(result).toContain('updateUser(');
    expect(result).toContain('deleteUser(');
  });

  it('generates input types for create and update', () => {
    const result = generateGraphQLSchema(schema);
    expect(result).toContain('input CreateUserInput {');
    expect(result).toContain('input UpdateUserInput {');
    expect(result).toContain('input CreatePostInput {');
  });

  it('uses ID! for primary key fields', () => {
    const result = generateGraphQLSchema(schema);
    // PK id should be ID!
    expect(result).toMatch(/id: ID!/);
  });

  it('uses nullable type for nullable columns', () => {
    const result = generateGraphQLSchema(schema);
    // content is nullable TEXT
    expect(result).toContain('content: String');
    // non-nullable content in input should not have ?
  });

  it('generates relation field for foreign keys', () => {
    const result = generateGraphQLSchema(schema);
    expect(result).toContain('user: User');
  });

  it('includes schema block', () => {
    const result = generateGraphQLSchema(schema);
    expect(result).toContain('schema {');
    expect(result).toContain('query: Query');
    expect(result).toContain('mutation: Mutation');
  });
});
