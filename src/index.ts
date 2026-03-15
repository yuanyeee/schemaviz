import { Command } from 'commander';
import { extract } from './commands/extract';
import { diagram } from './commands/diagram';
import { diff } from './commands/diff';
import { validate } from './commands/validate';

const program = new Command();

program
  .name('schemaviz')
  .description('Database ER diagram generator and schema diff tool')
  .version('0.1.0');

program
  .command('extract')
  .description('Extract schema from database')
  .requiredOption('-c, --config <path>', 'Database config file (YAML or JSON)')
  .requiredOption('-o, --output <path>', 'Output file path (JSON)')
  .action(extract);

program
  .command('diagram')
  .description('Generate ER diagram from schema')
  .requiredOption('-s, --schema <path>', 'Schema file path (JSON)')
  .option('-f, --format <format>', 'Output format (mermaid, plantuml)', 'mermaid')
  .option('-o, --output <path>', 'Output file path')
  .action(diagram);

program
  .command('diff')
  .description('Compare two schemas')
  .requiredOption('-s1, --schema1 <path>', 'First schema file')
  .requiredOption('-s2, --schema2 <path>', 'Second schema file')
  .option('-o, --output <path>', 'Output diff JSON file path')
  .option('-m, --migration <path>', 'Output migration SQL file path')
  .action(diff);

program
  .command('validate')
  .description('Validate schema against best practices')
  .requiredOption('-s, --schema <path>', 'Schema file path (JSON)')
  .option('-o, --output <path>', 'Output report file path')
  .option('-f, --format <format>', 'Output format (text, json)', 'text')
  .option('--fail-on-warning', 'Exit with non-zero code if warnings are found', false)
  .action(validate);

program.parse();
