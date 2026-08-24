import { Route, ServerContext, readBody } from '../router';
import { createAdapter, BaseAdapter } from '../../adapters/base';
import { Schema } from '../../types';

export function fetchRoutes(_ctx: ServerContext): Route[] {
  return [
    // POST /api/fetch-schema — connect to a DB and return schema/table list
    {
      method: 'POST',
      match: (url) => url === '/api/fetch-schema',
      handler: (req, res) => {
        readBody(req).then(async (body) => {
          let adapter: BaseAdapter | null = null;
          try {
            const { config, tables: selectedTables } = JSON.parse(body);
            adapter = createAdapter(config);
            await adapter.connect();
            let s: Schema;
            if (selectedTables && selectedTables.length > 0) {
              s = await adapter.extractSchemaForTables(selectedTables);
            } else {
              s = await adapter.extractSchema();
            }
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ ok: true, schema: s }));
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

    // POST /api/fetch-tables — connect and return table name list
    {
      method: 'POST',
      match: (url) => url === '/api/fetch-tables',
      handler: (req, res) => {
        readBody(req).then(async (body) => {
          let adapter: BaseAdapter | null = null;
          try {
            const config = JSON.parse(body);
            adapter = createAdapter(config);
            await adapter.connect();
            const tableNames = await adapter.getTableNames();
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ ok: true, tables: tableNames }));
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
  ];
}
