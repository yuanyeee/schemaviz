import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { saveConnection, loadConnections } from '../../src/core/webServer';

describe('connection persistence (T2.3)', () => {
  let tmpDir: string;
  let prevDataDir: string | undefined;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'schemaviz-conns-'));
    prevDataDir = process.env.SCHEMAVIZ_DATA_DIR;
    process.env.SCHEMAVIZ_DATA_DIR = tmpDir;
  });

  afterEach(() => {
    if (prevDataDir === undefined) delete process.env.SCHEMAVIZ_DATA_DIR;
    else process.env.SCHEMAVIZ_DATA_DIR = prevDataDir;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  const filePath = () => path.join(tmpDir, 'connections.json');

  it('never persists passwords even when savePassword is requested', () => {
    saveConnection({
      type: 'postgresql',
      host: 'db.local',
      database: 'app',
      user: 'u',
      password: 's3cret',
      savePassword: true,
    });
    const raw = fs.readFileSync(filePath(), 'utf-8');
    expect(raw).not.toContain('s3cret');
    expect(raw).not.toContain('_encodedPassword');
    expect(raw).not.toContain('savePassword');
    const conns = loadConnections();
    expect(conns[0].config.password).toBeUndefined();
    expect(conns[0].config._encodedPassword).toBeUndefined();
    expect(conns[0].config.host).toBe('db.local');
  });

  it('purges legacy base64-encoded passwords from existing files', () => {
    const legacy = Buffer.from('pw', 'utf-8').toString('base64');
    fs.writeFileSync(
      filePath(),
      JSON.stringify([
        {
          label: 'postgresql: h/app',
          config: { type: 'postgresql', host: 'h', _encodedPassword: legacy },
          lastUsed: '2026-01-01T00:00:00.000Z',
        },
      ]),
      'utf-8',
    );
    const conns = loadConnections();
    expect(conns[0].config._encodedPassword).toBeUndefined();
    // the file itself is rewritten without the password
    const raw = fs.readFileSync(filePath(), 'utf-8');
    expect(raw).not.toContain('_encodedPassword');
    expect(raw).not.toContain(legacy);
  });

  it('writes connections.json with owner-only permissions (POSIX)', () => {
    if (process.platform === 'win32') return; // POSIX modes are not modeled on Windows
    saveConnection({ type: 'sqlite', filename: 'x.db' });
    const mode = fs.statSync(filePath()).mode & 0o777;
    expect(mode).toBe(0o600);
  });
});
