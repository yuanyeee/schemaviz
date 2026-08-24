import { Route, ServerContext } from '../router';
import { loadConnections, saveConnection, deleteConnection } from '../connectionStore';
import { createAdapter, BaseAdapter } from '../../adapters/base';
import { Schema } from '../../types';

export function connectionRoutes(ctx: ServerContext): Route[] {
  return [
    // GET /api/connections — list saved connections
    {
      method: 'GET',
      match: (url) => url === '/api/connections',
      handler: (req, res) => {
        try {
          const conns = loadConnections();
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ connections: conns }));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
        }
      },
    },

    // DELETE /api/connections/:index — delete a saved connection
    {
      method: 'DELETE',
      match: (url) => url.startsWith('/api/connections/'),
      handler: (req, res, url) => {
        const idx = parseInt(url.slice('/api/connections/'.length), 10);
        try {
          const ok = deleteConnection(idx);
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ ok }));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
        }
      },
    },

    // POST /api/databases — list available databases
    {
      method: 'POST',
      match: (url) => url === '/api/databases',
      handler: (req, res) => {
        let body = '';
        req.on('data', (chunk) => {
          body += chunk;
        });
        req.on('end', async () => {
          let adapter: BaseAdapter | null = null;
          try {
            const config = JSON.parse(body);
            adapter = createAdapter(config);
            await adapter.connect();
            const databases = await adapter.getDatabases();
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ ok: true, databases }));
          } catch (err) {
            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
          } finally {
            if (adapter) {
              try {
                await adapter.disconnect();
              } catch {}
            }
          }
        });
      },
    },

    // POST /api/connect — connect to DB, keep adapter for table selection
    {
      method: 'POST',
      match: (url) => url === '/api/connect',
      handler: (req, res) => {
        let body = '';
        req.on('data', (chunk) => {
          body += chunk;
        });
        req.on('end', async () => {
          let newAdapter: BaseAdapter | null = null;
          try {
            const config = JSON.parse(body);
            newAdapter = createAdapter(config);
            await newAdapter.connect();
            // Get table names for selection
            const tableNames = await newAdapter.getTableNames();
            // Disconnect previous adapter before replacing
            if (ctx.state.currentAdapter) {
              try {
                await ctx.state.currentAdapter.disconnect();
              } catch {}
            }
            ctx.state.currentAdapter = newAdapter;
            newAdapter = null; // Ownership transferred
            ctx.state.currentConfig = config;
            ctx.state.availableTableNames = tableNames;
            // Save to connection history
            try {
              saveConnection(config);
            } catch {}
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(
              JSON.stringify({
                ok: true,
                database: config.database || '(default)',
                tables: tableNames.length,
              }),
            );
          } catch (err) {
            // Clean up new adapter if it was created but not stored
            if (newAdapter) {
              try {
                await newAdapter.disconnect();
              } catch {}
            }
            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
          }
        });
      },
    },

    // POST /api/extract-tables — extract schema for selected tables
    {
      method: 'POST',
      match: (url) => url === '/api/extract-tables',
      handler: (req, res) => {
        let body = '';
        req.on('data', (chunk) => {
          body += chunk;
        });
        req.on('end', async () => {
          try {
            const { tables: selectedTables } = JSON.parse(body);
            if (!ctx.state.currentAdapter) {
              res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
              res.end(JSON.stringify({ error: 'Not connected. Please connect first.' }));
              return;
            }
            const extracted: Schema =
              await ctx.state.currentAdapter.extractSchemaForTables(selectedTables);
            ctx.state.schema = extracted;
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(
              JSON.stringify({
                ok: true,
                database: extracted.database,
                tables: extracted.tables.length,
              }),
            );
          } catch (err) {
            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
          } finally {
            // Always disconnect and clean up after extraction (success or failure)
            if (ctx.state.currentAdapter) {
              try {
                await ctx.state.currentAdapter.disconnect();
              } catch {}
              ctx.state.currentAdapter = null;
            }
          }
        });
      },
    },

    // GET /api/disconnect — clear current schema
    {
      method: '*',
      match: (url) => url === '/api/disconnect',
      handler: (req, res) => {
        const adapterToClose = ctx.state.currentAdapter;
        ctx.state.schema = null;
        ctx.state.currentAdapter = null;
        ctx.state.currentConfig = null;
        ctx.state.availableTableNames = [];
        if (adapterToClose) {
          adapterToClose.disconnect().catch(() => {});
        }
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: true }));
      },
    },
  ];
}
