import * as fs from 'fs';
import { Schema, Table, Column } from '../types';

interface DiagramOptions {
  schema: string;
  format?: string;
  output?: string;
}

export async function diagram(options: DiagramOptions) {
  console.log('Generating ER diagram...');
  console.log(`Schema: ${options.schema}`);
  console.log(`Format: ${options.format || 'mermaid'}`);

  const schema: Schema = JSON.parse(fs.readFileSync(options.schema, 'utf-8'));

  // Generate Mermaid diagram
  const mermaid = generateMermaid(schema);

  if (options.output) {
    fs.writeFileSync(options.output, mermaid);
    console.log(`Diagram saved to ${options.output}`);
  } else {
    console.log(mermaid);
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
      // Determine relationship type based on cardinality
      // Simplified: assume many-to-one by default
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
