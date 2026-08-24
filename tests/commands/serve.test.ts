import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';

// CLI integration test for the serve access-token gate (T2.1).
// Requires `npm run build` first (spawns dist/index.js).
const PORT = 30000 + Math.floor(Math.random() * 20000);
const TOKEN = 'test-token-123';
const ROOT = path.resolve(__dirname, '..', '..');

let proc: ChildProcess | undefined;

async function waitForServer(url: string, timeoutMs = 15000): Promise<void> {
  const start = Date.now();
  for (;;) {
    try {
      await fetch(url); // any response (even 401) means the server is up
      return;
    } catch {
      if (Date.now() - start > timeoutMs) throw new Error('server did not start');
      await new Promise((r) => setTimeout(r, 200));
    }
  }
}

describe('serve access token gate (T2.1)', () => {
  const base = `http://127.0.0.1:${PORT}`;

  beforeAll(async () => {
    proc = spawn(
      process.execPath,
      [
        path.join(ROOT, 'dist', 'index.js'),
        'serve',
        '-s',
        path.join(ROOT, 'tests', 'fixtures', 'schema1.json'),
        '-p',
        String(PORT),
        '-H',
        '127.0.0.1', // bind IPv4 explicitly; 'localhost' may resolve to ::1 on some hosts
        '--token',
        TOKEN,
      ],
      { cwd: ROOT, env: { ...process.env, SCHEMAVIZ_NO_OPEN: '1' }, stdio: 'ignore' },
    );
    await waitForServer(`${base}/`);
  }, 20000);

  afterAll(() => {
    proc?.kill();
  });

  it('rejects unauthenticated page requests with 401', async () => {
    const res = await fetch(`${base}/`);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/Unauthorized/);
  });

  it('rejects unauthenticated API requests with 401', async () => {
    const res = await fetch(`${base}/api/connections`);
    expect(res.status).toBe(401);
  });

  it('rejects a wrong bearer token', async () => {
    const res = await fetch(`${base}/`, { headers: { Authorization: 'Bearer wrong' } });
    expect(res.status).toBe(401);
  });

  it('accepts the token as a bearer header', async () => {
    const res = await fetch(`${base}/`, { headers: { Authorization: `Bearer ${TOKEN}` } });
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('<!DOCTYPE html>');
  });

  it('?token= handshake sets an HttpOnly cookie and redirects', async () => {
    const res = await fetch(`${base}/?token=${TOKEN}`, { redirect: 'manual' });
    expect(res.status).toBe(302);
    const cookie = res.headers.get('set-cookie') ?? '';
    expect(cookie).toContain(`schemaviz_token=${TOKEN}`);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Strict');
    expect(res.headers.get('location')).toBe('/');
  });

  it('accepts requests carrying the handshake cookie', async () => {
    const res = await fetch(`${base}/`, { headers: { Cookie: `schemaviz_token=${TOKEN}` } });
    expect(res.status).toBe(200);
  });
});
