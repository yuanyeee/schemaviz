import { describe, it, expect } from 'vitest';
import { Schema } from '../../src/types';
import { generateDiagram } from '../../src/core/generator';

describe('Diagram Generator', () => {
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
        ],
        indexes: [],
        foreignKeys: [
          { name: 'posts_user_fk', columns: ['user_id'], referencedTable: 'users', referencedColumns: ['id'] },
        ],
      },
    ],
    generatedAt: '2026-03-14T10:00:00.000Z',
  };

  it('should generate valid Mermaid syntax', () => {
    const output = generateDiagram(schema, 'mermaid');
    
    expect(output).toContain('```mermaid');
    expect(output).toContain('erDiagram');
    expect(output).toContain('users');
    expect(output).toContain('posts');
    expect(output).toContain('||--o{');
  });

  it('should generate valid PlantUML syntax', () => {
    const output = generateDiagram(schema, 'plantuml');
    
    expect(output).toContain('@startuml');
    expect(output).toContain('entity');
    expect(output).toContain('users');
    expect(output).toContain('posts');
    expect(output).toContain('@enduml');
  });
});
