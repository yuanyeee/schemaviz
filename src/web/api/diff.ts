import { Route, ServerContext, readBody } from '../router';
import { loadSnapshot } from '../../core/history';
import { computeDiff, generateMigrationSQL } from '../../core/diff';
import { createAdapter, BaseAdapter } from '../../adapters/base';
import { Schema, DatabaseConfig } from '../../types';

export function diffRoutes(ctx: ServerContext): Route[] {
  return [
    // POST /api/diff
    {
      method: 'POST',
      match: (url) => url === '/api/diff',
      handler: (req, res) => {
        if (!ctx.state.schema) {
          res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'No schema loaded' }));
          return;
        }
        const currentSchema = ctx.state.schema;
        readBody(req).then((body) => {
          try {
            const { from, to, tables: filterTables } = JSON.parse(body);
            const resolveRef = (ref: string): Schema | null => {
              if (ref === 'current') return currentSchema;
              const snap = loadSnapshot(ctx.snapBaseDir, ref);
              return snap ? snap.schema : null;
            };
            let s1 = resolveRef(from);
            let s2 = resolveRef(to);
            if (!s1) {
              res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
              res.end(JSON.stringify({ error: `Snapshot not found: ${from}` }));
              return;
            }
            if (!s2) {
              res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
              res.end(JSON.stringify({ error: `Snapshot not found: ${to}` }));
              return;
            }
            // Filter schemas to selected tables if specified
            if (filterTables && Array.isArray(filterTables) && filterTables.length > 0) {
              const tableSet = new Set(filterTables as string[]);
              s1 = { ...s1, tables: s1.tables.filter((t) => tableSet.has(t.name)) };
              s2 = { ...s2, tables: s2.tables.filter((t) => tableSet.has(t.name)) };
            }
            const diffResult = computeDiff(s1, s2);
            const migration = generateMigrationSQL(s1.database, diffResult, s1.type ?? s2.type);
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ diff: diffResult, migration }));
          } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
          }
        });
      },
    },

    // POST /api/diff-advanced — compare two schemas with table mapping
    {
      method: 'POST',
      match: (url) => url === '/api/diff-advanced',
      handler: (req, res) => {
        readBody(req).then(async (body) => {
          try {
            const params = JSON.parse(body);
            // params.left:  { source: 'current'|'snapshot'|'connection', snapshotId?, config?, tables? }
            // params.right: same
            // params.tableMapping?: [{left: 'tblA', right: 'tblB'}, ...]

            // Track adapters created during resolveSchema so we can clean up on error
            const adaptersToCleanup: BaseAdapter[] = [];

            interface DiffSide {
              source: 'current' | 'snapshot' | 'connection';
              snapshotId?: string;
              config?: DatabaseConfig;
              tables?: string[];
            }
            const resolveSchema = async (side: DiffSide): Promise<Schema> => {
              if (side.source === 'current') {
                if (!ctx.state.schema) throw new Error('No current schema loaded');
                let s = ctx.state.schema;
                if (side.tables && side.tables.length > 0) {
                  const set = new Set(side.tables);
                  s = { ...s, tables: s.tables.filter((t) => set.has(t.name)) };
                }
                return s;
              } else if (side.source === 'snapshot') {
                if (!side.snapshotId) throw new Error('Snapshot source requires snapshotId');
                const snap = loadSnapshot(ctx.snapBaseDir, side.snapshotId);
                if (!snap) throw new Error('Snapshot not found: ' + side.snapshotId);
                let s = snap.schema;
                if (side.tables && side.tables.length > 0) {
                  const set = new Set(side.tables);
                  s = { ...s, tables: s.tables.filter((t) => set.has(t.name)) };
                }
                return s;
              } else if (side.source === 'connection') {
                if (!side.config) throw new Error('Connection source requires config');
                const adapter = createAdapter(side.config);
                adaptersToCleanup.push(adapter);
                await adapter.connect();
                let s: Schema;
                if (side.tables && side.tables.length > 0) {
                  s = await adapter.extractSchemaForTables(side.tables);
                } else {
                  s = await adapter.extractSchema();
                }
                await adapter.disconnect();
                return s;
              }
              throw new Error('Invalid source: ' + side.source);
            };

            let s1: Schema;
            let s2: Schema;
            try {
              s1 = await resolveSchema(params.left);
              s2 = await resolveSchema(params.right);
            } catch (resolveErr) {
              // Ensure all adapters are disconnected on error
              for (const a of adaptersToCleanup) {
                try {
                  await a.disconnect();
                } catch {}
              }
              throw resolveErr;
            }

            // Apply table mapping: rename right-side tables to match left-side names for comparison
            if (params.tableMapping && params.tableMapping.length > 0) {
              const mapping = params.tableMapping as { left: string; right: string }[];
              // Only keep mapped tables
              const leftNames = new Set(mapping.map((m) => m.left));
              const rightNameMap = new Map(mapping.map((m) => [m.right, m.left]));
              s1 = { ...s1, tables: s1.tables.filter((t) => leftNames.has(t.name)) };
              s2 = {
                ...s2,
                tables: s2.tables
                  .filter((t) => rightNameMap.has(t.name))
                  .map((t) => ({ ...t, name: rightNameMap.get(t.name)! })),
              };
            }

            const diffResult = computeDiff(s1, s2);
            const migration = generateMigrationSQL(
              s1.database || s2.database,
              diffResult,
              s1.type ?? s2.type,
            );
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ diff: diffResult, migration }));
          } catch (err) {
            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
          }
        });
      },
    },
  ];
}
