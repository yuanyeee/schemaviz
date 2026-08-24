import { Route, ServerContext } from '../router';
import { validateSchema } from '../../core/validator';

export function validateRoutes(ctx: ServerContext): Route[] {
  return [
    // POST /api/validate
    {
      method: 'POST',
      match: (url) => url === '/api/validate',
      handler: (req, res) => {
        if (!ctx.state.schema) {
          res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'No schema loaded' }));
          return;
        }
        try {
          const result = validateSchema(ctx.state.schema);
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify(result));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
        }
      },
    },
  ];
}
