import * as http from 'http';
import { Schema, DatabaseConfig } from '../types';
import { BaseAdapter } from '../adapters/base';
import { getMermaidScriptSource } from '../core/vendorAssets';
import { buildHtml } from './pages/diagram';
import { buildLoginHtml } from './pages/login';
import { buildTableSelectHtml } from './pages/tableSelect';
import { connectionRoutes } from './api/connections';
import { schemaRoutes } from './api/schema';
import { validateRoutes } from './api/validate';
import { generateRoutes } from './api/generate';
import { snapshotRoutes } from './api/snapshot';
import { diffRoutes } from './api/diff';
import { fetchRoutes } from './api/fetch';
import type { ServeOptions } from '../core/webServer';

/** Mutable server state shared by all route handlers. */
export interface ServerState {
  schema: Schema | null;
  currentAdapter: BaseAdapter | null;
  currentConfig: DatabaseConfig | null;
  availableTableNames: string[];
}

export interface ServerContext {
  options: ServeOptions;
  snapBaseDir: string;
  state: ServerState;
  loadSchemaFromFile(): Schema;
}

export interface Route {
  /** HTTP method, or '*' for any method. */
  method: 'GET' | 'POST' | 'DELETE' | '*';
  match(url: string): boolean;
  handler(req: http.IncomingMessage, res: http.ServerResponse, url: string): void;
}

const MAX_BODY_SIZE = 10 * 1024 * 1024; // 10 MB

export function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_SIZE) {
        req.destroy(new Error('Request body too large'));
        reject(new Error('Request body too large'));
        return;
      }
      body += chunk.toString();
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

export function createRoutes(ctx: ServerContext): Route[] {
  return [
    // GET /vendor/mermaid.min.js — locally bundled mermaid (no CDN, T2.4)
    {
      method: 'GET',
      match: (url) => url === '/vendor/mermaid.min.js',
      handler: (req, res) => {
        try {
          res.writeHead(200, {
            'Content-Type': 'application/javascript; charset=utf-8',
            'Cache-Control': 'public, max-age=86400',
          });
          res.end(getMermaidScriptSource());
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end(`Failed to load mermaid bundle: ${err}`);
        }
      },
    },
    ...connectionRoutes(ctx),
    ...schemaRoutes(ctx),
    ...validateRoutes(ctx),
    ...generateRoutes(ctx),
    ...snapshotRoutes(ctx),
    ...diffRoutes(ctx),
    ...fetchRoutes(ctx),
    // GET /select-tables — table selection page
    {
      method: '*',
      match: (url) => url === '/select-tables',
      handler: (req, res) => {
        try {
          if (ctx.state.availableTableNames.length > 0) {
            const dbName = ctx.state.currentConfig?.database || '(database)';
            const html = buildTableSelectHtml(ctx.state.availableTableNames, dbName);
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(html);
          } else {
            // No table list available, redirect to login
            res.writeHead(302, { Location: '/' });
            res.end();
          }
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end(`Error: ${err}`);
        }
      },
    },
    // GET /diagram — ER diagram page
    {
      method: '*',
      match: (url) => url === '/diagram',
      handler: (req, res) => {
        try {
          if (ctx.state.schema) {
            const html = buildHtml(ctx.state.schema);
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(html);
          } else {
            res.writeHead(302, { Location: '/' });
            res.end();
          }
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end(`Error: ${err}`);
        }
      },
    },
    // GET / — main page
    {
      method: '*',
      match: () => true,
      handler: (req, res) => {
        try {
          if (ctx.options.watch && ctx.options.schema) {
            ctx.state.schema = ctx.loadSchemaFromFile();
          }
          if (ctx.options.schema && ctx.state.schema) {
            // If schema loaded from file, show diagram directly (original flow)
            const html = buildHtml(ctx.state.schema);
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(html);
          } else if (ctx.state.schema) {
            // If schema is from live connection, redirect to diagram
            res.writeHead(302, { Location: '/diagram' });
            res.end();
          } else {
            const html = buildLoginHtml();
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(html);
          }
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end(`Error: ${err}`);
        }
      },
    },
  ];
}
