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

function generateMermaid(schema: Schema): string {
  let md = '# ER Diagram\n\n';
  md += '```mermaid\n';
  md += 'erDiagram\n';

  // Add tables with columns
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

  // Add relationships
  for (const table of schema.tables) {
    for (const fk of table.foreignKeys) {
      md += `  ${fk.referencedTable} ||--o{ ${table.name} : "${fk.name}"\n`;
    }
  }

  md += '```\n';
  
  // Add summary
  md += `\n## Summary\n\n`;
  md += `- **Database**: ${schema.database}\n`;
  md += `- **Tables**: ${schema.tables.length}\n`;
  md += `- **Generated**: ${schema.generatedAt}\n`;
  
  return md;
}

function generatePlantUML(schema: Schema): string {
  let puml = '@startuml\n\n';
  puml += '!theme plain\n\n';
  
  // Define tables
  for (const table of schema.tables) {
    puml += `entity "${table.name}" as ${table.name} {\n`;
    
    // Primary key first
    for (const column of table.columns) {
      if (column.isPrimaryKey) {
        const pk = 'PK';
        const fk = column.isForeignKey ? ' FK' : '';
        puml += `  ${column.name} : ${column.type} ${pk}${fk}\n`;
      }
    }
    
    // Other columns
    for (const column of table.columns) {
      if (!column.isPrimaryKey) {
        const fk = column.isForeignKey ? ' FK' : '';
        const nullable = column.nullable ? '?' : '';
        puml += `  ${column.name} : ${column.type}${nullable}${fk}\n`;
      }
    }
    
    puml += '}\n\n';
  }
  
  // Define relationships
  for (const table of schema.tables) {
    for (const fk of table.foreignKeys) {
      // PlantUML relationship syntax
      puml += `${fk.referencedTable} ||--o{ ${table.name} : "${fk.name}"\n`;
    }
  }
  
  puml += '\n@enduml\n';
  
  return puml;
}
