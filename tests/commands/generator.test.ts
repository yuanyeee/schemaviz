import { describe, it, expect } from 'vitest';
import { Schema } from '../../src/types';
import { generateDiagram, generateMermaid, generateMermaidCode, generatePlantUML } from '../../src/core/generator';

const schema: Schema = {
  database: 'test_db',
  tables: [
    {
      name: 'users',
      columns: [
        { name: 'id', type: 'INTEGER', nullable: false, isPrimaryKey: true, isForeignKey: false },
        { name: 'email', type: 'VARCHAR(255)', nullable: false, isPrimaryKey: false, isForeignKey: false },
        { name: 'name', type: 'VARCHAR(100)', nullable: true, isPrimaryKey: false, isForeignKey: false },
      ],
      indexes: [],
      foreignKeys: [],
    },
    {
      name: 'posts',
      columns: [
        { name: 'id', type: 'INTEGER', nullable: false, isPrimaryKey: true, isForeignKey: false },
        { name: 'user_id', type: 'INTEGER', nullable: false, isPrimaryKey: false, isForeignKey: true },
        { name: 'title', type: 'VARCHAR(255)', nullable: false, isPrimaryKey: false, isForeignKey: false },
        { name: 'body', type: 'TEXT', nullable: true, isPrimaryKey: false, isForeignKey: false },
      ],
      indexes: [],
      foreignKeys: [
        { name: 'posts_user_fk', columns: ['user_id'], referencedTable: 'users', referencedColumns: ['id'] },
      ],
    },
  ],
  generatedAt: '2026-03-14T10:00:00.000Z',
};

// ─── Mermaid (raw code) ───────────────────────────────────────────────────────

describe('generateMermaidCode (raw ER)', () => {
  it('starts with erDiagram', () => {
    const code = generateMermaidCode(schema);
    expect(code.trimStart()).toMatch(/^erDiagram/);
  });

  it('includes all table names', () => {
    const code = generateMermaidCode(schema);
    expect(code).toContain('users');
    expect(code).toContain('posts');
  });

  it('marks primary key columns with PK', () => {
    const code = generateMermaidCode(schema);
    expect(code).toContain('"PK');
  });

  it('marks foreign key columns with FK', () => {
    const code = generateMermaidCode(schema);
    expect(code).toContain('FK');
  });

  it('marks non-nullable columns with NOT NULL', () => {
    const code = generateMermaidCode(schema);
    expect(code).toContain('NOT NULL');
  });

  it('generates relationship arrows with ||--o{', () => {
    const code = generateMermaidCode(schema);
    expect(code).toContain('users ||--o{ posts');
  });

  it('includes FK constraint name as relationship label', () => {
    const code = generateMermaidCode(schema);
    expect(code).toContain('"posts_user_fk"');
  });

  it('does NOT contain markdown code fences', () => {
    const code = generateMermaidCode(schema);
    expect(code).not.toContain('```');
  });
});

// ─── Mermaid (markdown file) ──────────────────────────────────────────────────

describe('generateMermaid (markdown wrapper)', () => {
  it('wraps code in markdown mermaid fence', () => {
    const md = generateMermaid(schema);
    expect(md).toContain('```mermaid');
    expect(md).toContain('```\n');
  });

  it('includes the raw ER code inside the fence', () => {
    const md = generateMermaid(schema);
    expect(md).toContain('erDiagram');
    expect(md).toContain('users ||--o{ posts');
  });

  it('includes summary section with database name and table count', () => {
    const md = generateMermaid(schema);
    expect(md).toContain('## Summary');
    expect(md).toContain('test_db');
    expect(md).toContain('2');
  });
});

// ─── PlantUML ─────────────────────────────────────────────────────────────────

describe('generatePlantUML', () => {
  it('starts with @startuml and ends with @enduml', () => {
    const puml = generatePlantUML(schema);
    expect(puml.trimStart()).toMatch(/^@startuml/);
    expect(puml.trimEnd()).toMatch(/@enduml$/);
  });

  it('uses entity keyword for each table', () => {
    const puml = generatePlantUML(schema);
    expect(puml).toContain('entity "users"');
    expect(puml).toContain('entity "posts"');
  });

  it('marks primary key with <<PK>> stereotype', () => {
    const puml = generatePlantUML(schema);
    expect(puml).toContain('<<PK>>');
  });

  it('marks foreign key with <<FK>> stereotype', () => {
    const puml = generatePlantUML(schema);
    expect(puml).toContain('<<FK>>');
  });

  it('separates PKs and regular columns with --', () => {
    const puml = generatePlantUML(schema);
    // Each entity block must have a -- separator
    const entityBlocks = puml.split(/entity "[^"]*"/g).slice(1);
    for (const block of entityBlocks) {
      const closing = block.indexOf('}');
      const body = block.substring(0, closing);
      expect(body).toContain('--');
    }
  });

  it('prefixes required (non-nullable) non-PK columns with *', () => {
    const puml = generatePlantUML(schema);
    // user_id is non-nullable FK — should have * prefix
    expect(puml).toMatch(/\*user_id/);
    // title is non-nullable — should have * prefix
    expect(puml).toMatch(/\*title/);
  });

  it('does NOT prefix nullable columns with *', () => {
    const puml = generatePlantUML(schema);
    // name and body are nullable — should not have * prefix
    const lines = puml.split('\n');
    const nameLine = lines.find(l => l.includes(' name '));
    const bodyLine = lines.find(l => l.includes(' body '));
    expect(nameLine).toBeDefined();
    expect(nameLine).not.toMatch(/\*name/);
    expect(bodyLine).toBeDefined();
    expect(bodyLine).not.toMatch(/\*body/);
  });

  it('generates Crow foot relationships', () => {
    const puml = generatePlantUML(schema);
    expect(puml).toContain('users ||--o{ posts');
  });

  it('includes FK constraint name as relationship label', () => {
    const puml = generatePlantUML(schema);
    expect(puml).toContain('"posts_user_fk"');
  });

  it('includes !theme plain directive', () => {
    const puml = generatePlantUML(schema);
    expect(puml).toContain('!theme plain');
  });

  it('includes hide empty methods directive', () => {
    const puml = generatePlantUML(schema);
    expect(puml).toContain('hide empty methods');
  });

  it('produces a table with no FK columns correctly (no <<FK>> for users)', () => {
    const puml = generatePlantUML(schema);
    // users table has no FK columns, so no <<FK>> should appear inside it
    // (posts_user_fk relationship line is separate from entity block)
    const usersBlock = puml.split('entity "posts"')[0];
    // users.id should be PK but not FK
    expect(usersBlock).toContain('<<PK>>');
    // The FK stereotype should not appear in the users entity block
    expect(usersBlock.split('entity "users"')[1]).not.toContain('<<FK>>');
  });
});

// ─── generateDiagram dispatcher ──────────────────────────────────────────────

describe('generateDiagram', () => {
  it('dispatches to mermaid generator', () => {
    const output = generateDiagram(schema, 'mermaid');
    expect(output).toContain('```mermaid');
  });

  it('dispatches to plantuml generator', () => {
    const output = generateDiagram(schema, 'plantuml');
    expect(output).toContain('@startuml');
  });

  it('throws on unsupported format', () => {
    expect(() => generateDiagram(schema, 'unknown' as any)).toThrow('Unsupported format');
  });
});
