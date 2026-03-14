import * as fs from 'fs';
import { Schema } from '../types';

export async function diagram(options: { schema: string; format?: string; output?: string }) {
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
  let md = '```mermaid\n';
  md += 'erDiagram\n';

  // Add tables
  for (const table of schema.tables) {
    md += `  ${table.name} {\n`;
    for (const column of table.columns) {
      const pk = column.isPrimaryKey ? 'PK' : '';
      const fk = column.isForeignKey ? 'FK' : '';
      const type = column.type;
      md += `    ${type} ${column.name} ${pk} ${fk}\n`;
    }
    md += '  }\n';
  }

  // Add relationships
  for (const table of schema.tables) {
    for (const fk of table.foreignKeys) {
      md += `  ${fk.referencedTable} ||--o{ ${table.name} : "${fk.name}"\n`;
    }
  }

  md += '```\n';
  return md;
}
