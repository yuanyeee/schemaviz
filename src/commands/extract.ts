import * as fs from 'fs';
import * as yaml from 'yaml';
import { Schema, DatabaseConfig } from '../types';
import { createAdapter } from '../adapters';

interface ExtractOptions {
  config: string;
  output: string;
}

export async function extract(options: ExtractOptions) {
  console.log('Extracting schema...');
  console.log(`Config: ${options.config}`);
  console.log(`Output: ${options.output}`);

  // Load config (support YAML and JSON)
  let config: DatabaseConfig;
  const configContent = fs.readFileSync(options.config, 'utf-8');
  
  if (options.config.endsWith('.yaml') || options.config.endsWith('.yml')) {
    config = yaml.parse(configContent);
  } else {
    config = JSON.parse(configContent);
  }

  console.log(`Connecting to ${config.type} database: ${config.database}...`);

  const adapter = createAdapter(config);
  
  try {
    await adapter.connect();
    console.log('Connected successfully!');
    
    const schema = await adapter.extractSchema();
    
    fs.writeFileSync(options.output, JSON.stringify(schema, null, 2));
    console.log(`Schema extracted successfully!`);
    console.log(`- Database: ${schema.database}`);
    console.log(`- Tables: ${schema.tables.length}`);
    console.log(`- Output: ${options.output}`);
    
  } catch (error) {
    console.error('Error extracting schema:', error);
    throw error;
  } finally {
    await adapter.disconnect();
    console.log('Disconnected.');
  }
}
