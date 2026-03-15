import { Command } from 'commander';
import { extract } from './commands/extract';
import { diagram } from './commands/diagram';
import { diff } from './commands/diff';
import { validate } from './commands/validate';
import { serve } from './commands/serve';
import { generate } from './commands/generate';
import { snapshotSave, historyList, historyShow, historyDelete } from './commands/snapshot';

const program = new Command();

program
  .name('schemaviz')
  .description('Database ER diagram generator and schema diff tool')
  .version('0.2.0');

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

program
  .command('serve')
  .description('Serve interactive ER diagram in browser')
  .requiredOption('-s, --schema <path>', 'Schema file path (JSON)')
  .option('-p, --port <port>', 'Port to listen on', '3000')
  .option('-H, --host <host>', 'Host to bind to', 'localhost')
  .option('-w, --watch', 'Reload schema on every request', false)
  .action(serve);

program
  .command('generate')
  .description('Generate ORM/API code from schema')
  .requiredOption('-s, --schema <path>', 'Schema file path (JSON)')
  .requiredOption('-f, --format <format>', 'Output format: prisma | typeorm | graphql')
  .option('-o, --output <path>', 'Output file or directory path')
  .action(generate);

// Snapshot / history subcommands
const snapshotCmd = program.command('snapshot').description('Save a schema snapshot');
snapshotCmd
  .requiredOption('-s, --schema <path>', 'Schema file path (JSON)')
  .option('-t, --tag <tag>', 'Human-readable label for this snapshot')
  .option('-d, --dir <dir>', 'History directory', '.')
  .action(snapshotSave);

const historyCmd = program.command('history').description('Manage schema history');
historyCmd
  .command('list')
  .description('List all snapshots')
  .option('-d, --dir <dir>', 'History directory', '.')
  .option('--json', 'Output as JSON', false)
  .action(historyList);

historyCmd
  .command('show <ref>')
  .description('Show a snapshot (by id prefix or tag)')
  .option('-d, --dir <dir>', 'History directory', '.')
  .option('--json', 'Output schema JSON', false)
  .action((ref, opts) => historyShow({ ref, ...opts }));

historyCmd
  .command('delete <ref>')
  .description('Delete a snapshot (by id prefix or tag)')
  .option('-d, --dir <dir>', 'History directory', '.')
  .action((ref, opts) => historyDelete({ ref, ...opts }));

program.parse();
