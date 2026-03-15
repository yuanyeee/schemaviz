import { Schema } from '../types';

export type DiagramFormat = 'mermaid' | 'plantuml';

export function generateDiagram(schema: Schema, format: DiagramFormat): string {
  switch (format) {
    case 'mermaid':
      return generateMermaid(schema);
    case 'plantuml':
      return generatePlantUML(schema);
    default:
      throw new Error(`Unsupported format: ${format}`);
  }
}

/**
 * Returns the raw Mermaid ER diagram code (no Markdown wrapper).
 * Suitable for embedding in HTML or other contexts.
 */
export function generateMermaidCode(schema: Schema): string {
  const lines: string[] = ['erDiagram'];

  for (const table of schema.tables) {
    lines.push(`  ${table.name} {`);
    for (const column of table.columns) {
      const modifiers: string[] = [];
      if (column.isPrimaryKey) modifiers.push('PK');
      if (column.isForeignKey) modifiers.push('FK');
      if (!column.nullable) modifiers.push('NOT NULL');
      const mod = modifiers.length > 0 ? ` "${modifiers.join(', ')}"` : '';
      lines.push(`    ${column.type} ${column.name}${mod}`);
    }
    lines.push('  }');
  }

  lines.push('');

  for (const table of schema.tables) {
    for (const fk of table.foreignKeys) {
      lines.push(`  ${fk.referencedTable} ||--o{ ${table.name} : "${fk.name}"`);
    }
  }

  return lines.join('\n');
}

/**
 * Returns Mermaid ER diagram wrapped in a Markdown code fence with a summary.
 * Suitable for writing to .md files.
 */
export function generateMermaid(schema: Schema): string {
  let md = '# ER Diagram\n\n';
  md += '```mermaid\n';
  md += generateMermaidCode(schema);
  md += '\n```\n';

  md += `\n## Summary\n\n`;
  md += `- **Database**: ${schema.database}\n`;
  md += `- **Tables**: ${schema.tables.length}\n`;
  md += `- **Generated**: ${schema.generatedAt}\n`;

  return md;
}

/**
 * Returns a PlantUML ER diagram using proper entity notation:
 * - Primary keys with <<PK>> stereotype above the -- separator
 * - Foreign keys with <<FK>> stereotype
 * - NOT NULL indicated by * prefix on required fields
 * - Crow's foot relationship notation
 */
export function generatePlantUML(schema: Schema): string {
  const lines: string[] = ['@startuml', '', '!theme plain', 'hide empty methods', ''];

  for (const table of schema.tables) {
    lines.push(`entity "${table.name}" as ${table.name} {`);

    // Primary key section (above the -- separator)
    const pkCols = table.columns.filter(c => c.isPrimaryKey);
    for (const col of pkCols) {
      const fkStereotype = col.isForeignKey ? ' <<FK>>' : '';
      lines.push(`  *${col.name} : ${col.type} <<PK>>${fkStereotype}`);
    }

    // Separator between PKs and regular columns
    lines.push('  --');

    // Non-PK columns
    const otherCols = table.columns.filter(c => !c.isPrimaryKey);
    for (const col of otherCols) {
      const required = col.nullable ? '' : '*';
      const fkStereotype = col.isForeignKey ? ' <<FK>>' : '';
      lines.push(`  ${required}${col.name} : ${col.type}${fkStereotype}`);
    }

    lines.push('}');
    lines.push('');
  }

  // Relationships using Crow's foot notation
  for (const table of schema.tables) {
    for (const fk of table.foreignKeys) {
      lines.push(`${fk.referencedTable} ||--o{ ${table.name} : "${fk.name}"`);
    }
  }

  lines.push('');
  lines.push('@enduml');

  return lines.join('\n');
}
