import { Route, ServerContext, readBody } from '../router';
import { saveSnapshotFromData, loadIndex, loadSnapshot, deleteSnapshot } from '../../core/history';

export function snapshotRoutes(ctx: ServerContext): Route[] {
  return [
    // POST /api/snapshots
    {
      method: 'POST',
      match: (url) => url === '/api/snapshots',
      handler: (req, res) => {
        if (!ctx.state.schema) {
          res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'No schema loaded' }));
          return;
        }
        const currentSchema = ctx.state.schema;
        readBody(req).then((body) => {
          try {
            const { tag } = JSON.parse(body || '{}');
            const snapshot = saveSnapshotFromData(
              ctx.snapBaseDir,
              currentSchema,
              tag || new Date().toISOString().slice(0, 10),
            );
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(
              JSON.stringify({ id: snapshot.id, tag: snapshot.tag, savedAt: snapshot.savedAt }),
            );
          } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
          }
        });
      },
    },

    // GET /api/snapshots
    {
      method: 'GET',
      match: (url) => url === '/api/snapshots',
      handler: (req, res) => {
        try {
          const index = loadIndex(ctx.snapBaseDir);
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ snapshots: index.snapshots }));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
        }
      },
    },

    // GET /api/snapshots/:id/tables — list table names in a snapshot
    {
      method: 'GET',
      match: (url) => /^\/api\/snapshots\/[^/]+\/tables$/.test(url),
      handler: (req, res, url) => {
        const ref = url.slice('/api/snapshots/'.length, url.length - '/tables'.length);
        try {
          const snap = loadSnapshot(ctx.snapBaseDir, ref);
          if (!snap) {
            res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: 'Snapshot not found: ' + ref }));
            return;
          }
          const tables = snap.schema.tables.map((t) => t.name);
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ ok: true, tables }));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
        }
      },
    },

    // DELETE /api/snapshots/:id
    {
      method: 'DELETE',
      match: (url) => url.startsWith('/api/snapshots/'),
      handler: (req, res, url) => {
        const ref = url.slice('/api/snapshots/'.length);
        try {
          const ok = deleteSnapshot(ctx.snapBaseDir, ref);
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ ok }));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
        }
      },
    },
  ];
}
