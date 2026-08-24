import * as fs from 'fs';
import * as path from 'path';
import { DatabaseConfig } from '../types';

// ─── Connection History ───────────────────────────────────────────────────────

/** Connection form payload; the password is never persisted (T2.3). */
export type StoredConnectionConfig = Partial<DatabaseConfig> & {
  savePassword?: boolean;
  _encodedPassword?: string;
};

export interface ConnectionEntry {
  label: string;
  config: StoredConnectionConfig;
  lastUsed: string;
}

function getConnectionsFilePath(): string {
  const dir = process.env.SCHEMAVIZ_DATA_DIR
    ? path.resolve(process.env.SCHEMAVIZ_DATA_DIR)
    : path.join(process.cwd(), '.schemaviz');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, 'connections.json');
}

/** Writes connections.json with owner-only permissions (best effort on Windows). */
function writeConnections(conns: ConnectionEntry[]): void {
  const fp = getConnectionsFilePath();
  fs.writeFileSync(fp, JSON.stringify(conns, null, 2), 'utf-8');
  try {
    fs.chmodSync(fp, 0o600);
  } catch {
    /* best effort — Windows ACLs ignore POSIX modes */
  }
}

export function loadConnections(): ConnectionEntry[] {
  const fp = getConnectionsFilePath();
  if (!fs.existsSync(fp)) return [];
  try {
    const conns: ConnectionEntry[] = JSON.parse(fs.readFileSync(fp, 'utf-8'));
    // T2.3: passwords are never persisted. Strip base64-encoded passwords written
    // by older versions and purge them from disk.
    let purged = false;
    for (const c of conns) {
      if (c.config && c.config._encodedPassword !== undefined) {
        delete c.config._encodedPassword;
        purged = true;
      }
    }
    if (purged) {
      try {
        writeConnections(conns);
      } catch {
        /* ignore */
      }
    }
    return conns;
  } catch {
    return [];
  }
}

export function saveConnection(config: StoredConnectionConfig): void {
  const conns = loadConnections();
  // Build a label for display
  let label = '';
  if (config.type === 'sqlite') {
    label = `SQLite: ${config.filename || ''}`;
  } else {
    const host = config.host || 'localhost';
    const inst = config.instanceName ? `\\${config.instanceName}` : '';
    const port = config.instanceName ? '' : `:${config.port || ''}`;
    const db = config.database ? `/${config.database}` : '';
    label = `${config.type}: ${host}${inst}${port}${db}`;
    if (config.user) label += ` (${config.user})`;
  }

  // T2.3: credentials are never persisted — stored connections contain no password.
  const safeConfig = { ...config };
  delete safeConfig.password;
  delete safeConfig.savePassword;
  delete safeConfig._encodedPassword;
  delete safeConfig.connectionTimeout;

  // Check for duplicate by label
  const idx = conns.findIndex((c) => c.label === label);
  const entry: ConnectionEntry = { label, config: safeConfig, lastUsed: new Date().toISOString() };
  if (idx >= 0) {
    conns[idx] = entry;
  } else {
    conns.unshift(entry);
  }
  // Keep max 20 entries
  const trimmed = conns.slice(0, 20);
  writeConnections(trimmed);
}

export function deleteConnection(index: number): boolean {
  const conns = loadConnections();
  if (index < 0 || index >= conns.length) return false;
  conns.splice(index, 1);
  writeConnections(conns);
  return true;
}
