import { Command } from 'commander';
import { extract } from './commands/extract';
import { diagram } from './commands/diagram';
import { diff } from './commands/diff';

const program = new Command();

program
  .name('schemaviz')
  .description('Database ER diagram generator and schema diff tool')
  .version('0.1.0');

program
  .command('extract')
  .description('Extract schema from database')
  .requiredOption('-c, --config <path>', 'Database config file')
  .requiredOption('-o, --output <path>', 'Output file path')
  .action(extract);

program
  .command('diagram')
  .description('Generate ER diagram from schema')
  .requiredOption('-s, --schema <path>', 'Schema file path')
  .option('-f, --format <format>', 'Output format (mermaid)', 'mermaid')
  .option('-o, --output <path>', 'Output file path')
  .action(diagram);

program
  .command('diff')
  .description('Compare two schemas')
  .requiredOption('-s1, --schema1 <path>', 'First schema file')
  .requiredOption('-s2, --schema2 <path>', 'Second schema file')
  .option('-o, --output <path>', 'Output file path')
  .action(diff);

program.parse();
