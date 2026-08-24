import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { createRoutes, ServerContext } from '../web/router';

export interface ServeOptions {
  schema?: string; // Optional — omit to show login page on startup
  port: number;
  host: string;
  watch: boolean;
  /** Access token for the UI/APIs. When omitted and the host is non-localhost, a random token is generated. */
  token?: string;
}

// ── Split modules (T3.1): re-exports keep the public API stable for tests/consumers ──
export { buildHtml } from '../web/pages/diagram';
export { buildLoginHtml } from '../web/pages/login';
export { buildTableSelectHtml } from '../web/pages/tableSelect';
export { loadConnections, saveConnection, deleteConnection } from '../web/connectionStore';
export {
  escapeJsonForHtmlScript,
  escapeForInlineTemplateLiteral,
  escapeHtmlText,
} from '../web/escape';
export type { StoredConnectionConfig, ConnectionEntry } from '../web/connectionStore';

// ─── HTTP Server ──────────────────────────────────────────────────────────────

/**
 * Checks whether a request carries the access token, either as an
 * `Authorization: Bearer <token>` header or as the `schemaviz_token` cookie
 * (set by the ?token= handshake in startServer).
 */
export function isAuthorizedRequest(
  req: { headers: http.IncomingMessage['headers'] },
  token: string,
): boolean {
  if (req.headers.authorization === `Bearer ${token}`) return true;
  const cookie = req.headers.cookie ?? '';
  return cookie
    .split(';')
    .map((c) => c.trim())
    .includes(`schemaviz_token=${token}`);
}

export async function startServer(options: ServeOptions): Promise<void> {
  const ctx: ServerContext = {
    options,
    snapBaseDir: process.cwd(),
    state: {
      // Pre-load schema from file if provided
      schema: options.schema ? JSON.parse(fs.readFileSync(options.schema, 'utf-8')) : null,
      // Adapter kept alive for the table selection flow
      currentAdapter: null,
      currentConfig: null,
      availableTableNames: [],
    },
    loadSchemaFromFile: () => JSON.parse(fs.readFileSync(options.schema!, 'utf-8')),
  };
  // Access token handling (T2.1): explicit --token wins. Non-localhost binds
  // without one get a random token so the UI is never exposed to the network
  // unauthenticated; localhost without a token stays open (with a warning).
  const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);
  const isLocalhostBind = LOCAL_HOSTS.has(options.host);
  const accessToken: string | undefined =
    options.token ?? (isLocalhostBind ? undefined : crypto.randomBytes(16).toString('hex'));

  const routes = createRoutes(ctx);

  const server = http.createServer((req, res) => {
    const url = req.url ?? '/';
    // ── Access token gate (active only when a token is configured) ──
    if (accessToken) {
      // Token handshake: ?token=<token> on any path sets an HttpOnly cookie and
      // redirects to the clean URL; subsequent requests authenticate via cookie.
      const parsedUrl = new URL(url, 'http://localhost');
      if (parsedUrl.searchParams.get('token') === accessToken) {
        res.writeHead(302, {
          'Set-Cookie': `schemaviz_token=${accessToken}; HttpOnly; SameSite=Strict; Path=/`,
          Location: parsedUrl.pathname,
        });
        res.end();
        return;
      }
      if (!isAuthorizedRequest(req, accessToken)) {
        res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'Unauthorized: access token required' }));
        return;
      }
    }

    // ── Route dispatch (routing table lives in src/web/router.ts) ──
    for (const route of routes) {
      if ((route.method === '*' || route.method === req.method) && route.match(url)) {
        route.handler(req, res, url);
        return;
      }
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.listen(options.port, options.host, () => resolve());
    server.once('error', reject);
  });

  const url = `http://${options.host}:${options.port}${accessToken ? `?token=${accessToken}` : ''}`;
  console.log(`SchemaViz server running at ${url}`);
  if (options.schema) {
    console.log(`Schema: ${path.resolve(options.schema)}`);
  } else {
    console.log('No schema file specified — login page will be shown.');
  }
  if (options.watch) {
    console.log('Watch mode enabled — page reloads on every request');
  }
  if (!isLocalhostBind) {
    console.log(
      `\nWarning: binding to ${options.host} exposes this UI (including the database connection form) to the network.`,
    );
    if (!options.token) {
      console.log(
        'Warning: no --token was given, so a random access token was generated. Open the URL above (it includes ?token=...).',
      );
    }
  }
  if (!accessToken) {
    console.log(
      '\nWarning: no access token is set — any process that can reach this server can connect to arbitrary databases. Use --token to require authentication.',
    );
  }
  console.log('\nPress Ctrl+C to stop');

  // Open browser if possible (SCHEMAVIZ_NO_OPEN=1 disables this, e.g. in tests/headless)
  if (!process.env.SCHEMAVIZ_NO_OPEN) {
    try {
      const { execSync } = require('child_process');
      const open =
        process.platform === 'darwin'
          ? 'open'
          : process.platform === 'win32'
            ? 'start'
            : 'xdg-open';
      execSync(`${open} "${url}"`, { stdio: 'ignore' });
    } catch {
      // ignore if can't open browser
    }
  }

  // Graceful shutdown handler
  const shutdown = async () => {
    console.log('\nShutting down...');
    if (ctx.state.currentAdapter) {
      try {
        await ctx.state.currentAdapter.disconnect();
      } catch {}
      ctx.state.currentAdapter = null;
    }
    server.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Keep running
  await new Promise<void>(() => {});
}
