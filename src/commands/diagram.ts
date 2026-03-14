import * as fs from 'fs';
import { Schema, DiagramFormat } from '../types';
import { generateDiagram } from '../core/generator';
import { generateImage, ImageFormat } from '../core/imageGenerator';

interface DiagramOptions {
  schema: string;
  format?: string;
  output?: string;
}

export async function diagram(options: DiagramOptions) {
  const format = (options.format as DiagramFormat) || 'mermaid';
  const outputFormat = options.output?.split('.').pop() as ImageFormat || format as any;
  
  console.log('Generating ER diagram...');
  console.log(`Schema: ${options.schema}`);
  console.log(`Format: ${format}`);

  const schema: Schema = JSON.parse(fs.readFileSync(options.schema, 'utf-8'));

  // Check if output format is an image format
  if (['png', 'svg', 'pdf'].includes(outputFormat)) {
    // Generate Mermaid code for image rendering
    const mermaidCode = generateDiagram(schema, 'mermaid');
    
    if (!options.output) {
      console.error('Error: Output path required for image export');
      process.exit(1);
    }
    
    await generateImage({
      mermaidCode,
      outputPath: options.output,
      format: outputFormat as ImageFormat,
    });
    
    return;
  }

  // Generate diagram in text format
  const output = generateDiagram(schema, format);

  if (options.output) {
    fs.writeFileSync(options.output, output);
    console.log(`Diagram saved to ${options.output}`);
  } else {
    console.log(output);
  }
}
