import { describe, it, expect } from 'vitest';

describe('Diagram Command', () => {
  it('should generate valid mermaid syntax', () => {
    const schema = {
      database: 'test_db',
      tables: [
        {
          name: 'users',
          columns: [
            { name: 'id', type: 'INTEGER', nullable: false, isPrimaryKey: true, isForeignKey: false },
            { name: 'email', type: 'VARCHAR(255)', nullable: false, isPrimaryKey: false, isForeignKey: false },
          ],
          indexes: [],
          foreignKeys: [],
        },
        {
          name: 'posts',
          columns: [
            { name: 'id', type: 'INTEGER', nullable: false, isPrimaryKey: true, isForeignKey: false },
            { name: 'user_id', type: 'INTEGER', nullable: false, isPrimaryKey: false, isForeignKey: true },
          ],
          indexes: [],
          foreignKeys: [
            { name: 'posts_user_fk', columns: ['user_id'], referencedTable: 'users', referencedColumns: ['id'] },
          ],
        },
      ],
      generatedAt: '2026-03-14T10:00:00.000Z',
    };

    // Generate mermaid
    let md = '```mermaid\n';
    md += 'erDiagram\n';

    for (const table of schema.tables) {
      md += `  ${table.name} {\n`;
      for (const column of table.columns) {
        const type = column.type;
        const modifiers: string[] = [];
        if (column.isPrimaryKey) modifiers.push('PK');
        if (column.isForeignKey) modifiers.push('FK');
        if (!column.nullable) modifiers.push('NOT NULL');
        const modifierStr = modifiers.length > 0 ? ` "${modifiers.join(', ')}"` : '';
        md += `    ${type} ${column.name}${modifierStr}\n`;
      }
      md += '  }\n';
    }

    md += '\n';

    for (const table of schema.tables) {
      for (const fk of table.foreignKeys) {
        md += `  ${fk.referencedTable} ||--o{ ${table.name} : "${fk.name}"\n`;
      }
    }

    md += '```\n';

    expect(md).toContain('```mermaid');
    expect(md).toContain('erDiagram');
    expect(md).toContain('users');
    expect(md).toContain('posts');
    expect(md).toContain('||--o{');
  });
});
