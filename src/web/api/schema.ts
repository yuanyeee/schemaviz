import { Route, ServerContext } from '../router';

export function schemaRoutes(ctx: ServerContext): Route[] {
  return [
    // GET /api/schema
    {
      method: '*',
      match: (url) => url === '/api/schema',
      handler: (req, res) => {
        if (!ctx.state.schema) {
          res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'No schema loaded' }));
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(ctx.state.schema));
      },
    },

    // GET /api/reload
    {
      method: '*',
      match: (url) => url === '/api/reload',
      handler: (req, res) => {
        if (!ctx.options.schema) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'No schema file configured' }));
          return;
        }
        try {
          ctx.state.schema = ctx.loadSchemaFromFile();
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ ok: true }));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
        }
      },
    },
  ];
}
