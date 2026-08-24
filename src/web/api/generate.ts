import { Route, ServerContext, readBody } from '../router';
import { generatePrismaSchema } from '../../core/codegen/prisma';
import { generateTypeOrmEntities } from '../../core/codegen/typeorm';
import { generateGraphQLSchema } from '../../core/codegen/graphql';

export function generateRoutes(ctx: ServerContext): Route[] {
  return [
    // POST /api/generate
    {
      method: 'POST',
      match: (url) => url === '/api/generate',
      handler: (req, res) => {
        if (!ctx.state.schema) {
          res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'No schema loaded' }));
          return;
        }
        const currentSchema = ctx.state.schema;
        readBody(req).then((body) => {
          try {
            const { format } = JSON.parse(body || '{}');
            let files: { name: string; content: string }[];
            if (format === 'prisma') {
              files = [{ name: 'schema.prisma', content: generatePrismaSchema(currentSchema) }];
            } else if (format === 'typeorm') {
              const map = generateTypeOrmEntities(currentSchema);
              files = Array.from(map.entries()).map(([name, content]) => ({ name, content }));
            } else if (format === 'graphql') {
              files = [{ name: 'schema.graphql', content: generateGraphQLSchema(currentSchema) }];
            } else {
              res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
              res.end(JSON.stringify({ error: `Unknown format: ${format}` }));
              return;
            }
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ format, files }));
          } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
          }
        });
      },
    },
  ];
}
