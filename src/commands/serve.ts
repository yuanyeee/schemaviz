import * as fs from 'fs';
import { startServer } from '../core/webServer';

interface ServeOptions {
  schema?: string;
  port: string;
  host: string;
  watch: boolean;
  token?: string;
}

export async function serve(options: ServeOptions) {
  const port = parseInt(options.port, 10);
  if (isNaN(port) || port < 1 || port > 65535) {
    console.error(`Invalid port: ${options.port}`);
    process.exit(1);
  }

  // If a schema file is specified, verify it exists before starting
  if (options.schema && !fs.existsSync(options.schema)) {
    console.error(`Schema file not found: ${options.schema}`);
    process.exit(1);
  }

  try {
    await startServer({
      schema: options.schema,
      port,
      host: options.host,
      watch: options.watch,
      token: options.token,
    });
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === 'EADDRINUSE') {
      console.error(`Port ${port} is already in use. Try --port <other-port>`);
    } else {
      console.error(`Failed to start server: ${e.message}`);
    }
    process.exit(1);
  }
}
