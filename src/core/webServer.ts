import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { Schema } from '../types';
import { generateMermaid } from './generator';

export interface ServeOptions {
  schema: string;
  port: number;
  host: string;
  watch: boolean;
}

export function buildHtml(schema: Schema): string {
  const mermaidCode = generateMermaid(schema);
  const schemaJson = JSON.stringify(schema, null, 2);
  const tableNames = schema.tables.map(t => t.name);

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SchemaViz — ${schema.database}</title>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg: #0f1117;
      --surface: #1a1d27;
      --surface2: #252836;
      --border: #2e3250;
      --text: #e2e8f0;
      --text-muted: #8892a4;
      --accent: #6366f1;
      --accent-hover: #818cf8;
      --error: #f87171;
      --warn: #fbbf24;
      --ok: #34d399;
    }
    [data-theme="light"] {
      --bg: #f8fafc;
      --surface: #ffffff;
      --surface2: #f1f5f9;
      --border: #e2e8f0;
      --text: #0f172a;
      --text-muted: #64748b;
      --accent: #4f46e5;
      --accent-hover: #6366f1;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: var(--bg);
      color: var(--text);
      height: 100vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    /* Header */
    header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 20px;
      background: var(--surface);
      border-bottom: 1px solid var(--border);
      flex-shrink: 0;
      z-index: 10;
    }
    .logo { font-weight: 700; font-size: 1.1rem; color: var(--accent); }
    .db-badge {
      background: var(--surface2);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 2px 10px;
      font-size: 0.8rem;
      color: var(--text-muted);
    }
    .spacer { flex: 1; }
    .stats { font-size: 0.8rem; color: var(--text-muted); }
    .btn {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 5px 12px;
      border: 1px solid var(--border);
      border-radius: 6px;
      background: var(--surface2);
      color: var(--text);
      cursor: pointer;
      font-size: 0.8rem;
      transition: border-color .15s, background .15s;
    }
    .btn:hover { border-color: var(--accent); background: var(--surface); }
    .btn.primary { background: var(--accent); border-color: var(--accent); color: #fff; }
    .btn.primary:hover { background: var(--accent-hover); border-color: var(--accent-hover); }

    /* Layout */
    .layout {
      display: flex;
      flex: 1;
      overflow: hidden;
    }

    /* Sidebar */
    .sidebar {
      width: 260px;
      flex-shrink: 0;
      background: var(--surface);
      border-right: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      transition: width .2s;
    }
    .sidebar.collapsed { width: 0; }
    .sidebar-header {
      padding: 12px 16px;
      border-bottom: 1px solid var(--border);
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: .05em;
      flex-shrink: 0;
    }
    .search-wrap { padding: 10px 12px; border-bottom: 1px solid var(--border); flex-shrink: 0; }
    .search-input {
      width: 100%;
      padding: 6px 10px;
      background: var(--surface2);
      border: 1px solid var(--border);
      border-radius: 6px;
      color: var(--text);
      font-size: 0.85rem;
      outline: none;
    }
    .search-input:focus { border-color: var(--accent); }
    .table-list { flex: 1; overflow-y: auto; padding: 8px; }
    .table-item {
      padding: 7px 10px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.85rem;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: background .1s;
    }
    .table-item:hover { background: var(--surface2); }
    .table-item.active { background: var(--accent); color: #fff; }
    .table-item .col-count {
      margin-left: auto;
      font-size: 0.75rem;
      opacity: 0.6;
    }
    .table-icon { opacity: 0.5; font-size: 0.8rem; }

    /* Detail panel */
    .detail-panel {
      width: 280px;
      flex-shrink: 0;
      background: var(--surface);
      border-left: 1px solid var(--border);
      display: none;
      flex-direction: column;
      overflow: hidden;
    }
    .detail-panel.visible { display: flex; }
    .detail-header {
      padding: 12px 16px;
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .detail-title { font-weight: 600; font-size: 0.95rem; flex: 1; }
    .close-btn { cursor: pointer; opacity: 0.5; font-size: 1.1rem; }
    .close-btn:hover { opacity: 1; }
    .detail-body { flex: 1; overflow-y: auto; padding: 12px; }
    .col-row {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 8px;
      border-radius: 6px;
      font-size: 0.8rem;
      transition: background .1s;
    }
    .col-row:hover { background: var(--surface2); }
    .col-name { font-weight: 500; flex: 1; font-family: monospace; }
    .col-type { color: var(--text-muted); font-family: monospace; font-size: 0.75rem; }
    .badge {
      padding: 1px 5px;
      border-radius: 3px;
      font-size: 0.65rem;
      font-weight: 700;
      text-transform: uppercase;
    }
    .badge-pk { background: #7c3aed22; color: #a78bfa; }
    .badge-fk { background: #0369a122; color: #38bdf8; }
    .badge-null { background: #71717122; color: var(--text-muted); }
    .section-label {
      font-size: 0.7rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: .05em;
      color: var(--text-muted);
      padding: 10px 8px 4px;
    }
    .fk-row {
      font-size: 0.8rem;
      padding: 5px 8px;
      border-radius: 6px;
      color: var(--text-muted);
    }
    .fk-row span { color: var(--accent); }
    .idx-row {
      font-size: 0.8rem;
      padding: 5px 8px;
      border-radius: 6px;
      color: var(--text-muted);
      font-family: monospace;
    }

    /* Canvas */
    .canvas-wrap {
      flex: 1;
      overflow: hidden;
      position: relative;
      background: var(--bg);
    }
    .canvas-inner {
      width: 100%;
      height: 100%;
      overflow: auto;
      display: flex;
      align-items: flex-start;
      justify-content: center;
      padding: 24px;
    }
    #diagram {
      transform-origin: top center;
      transition: transform .1s;
    }
    #diagram svg {
      max-width: none !important;
    }

    /* Zoom controls */
    .zoom-controls {
      position: absolute;
      bottom: 20px;
      right: 20px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .zoom-btn {
      width: 34px; height: 34px;
      border-radius: 8px;
      background: var(--surface);
      border: 1px solid var(--border);
      color: var(--text);
      font-size: 1.1rem;
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: border-color .15s;
    }
    .zoom-btn:hover { border-color: var(--accent); }
    .zoom-label {
      text-align: center;
      font-size: 0.7rem;
      color: var(--text-muted);
      padding: 2px;
    }

    /* Toast */
    .toast {
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%) translateY(60px);
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 8px 16px;
      font-size: 0.85rem;
      opacity: 0;
      transition: transform .2s, opacity .2s;
      z-index: 100;
    }
    .toast.show { transform: translateX(-50%) translateY(0); opacity: 1; }

    /* Generated at */
    .gen-at {
      font-size: 0.7rem;
      color: var(--text-muted);
      padding: 8px 16px;
      border-top: 1px solid var(--border);
      flex-shrink: 0;
    }
  </style>
</head>
<body data-theme="dark">

<header>
  <span class="logo">SchemaViz</span>
  <span class="db-badge">${schema.database}</span>
  <span class="stats">${schema.tables.length} tables</span>
  <span class="spacer"></span>
  <button class="btn" onclick="toggleSidebar()" title="Toggle table list">☰ Tables</button>
  <button class="btn" onclick="copyMermaid()" title="Copy Mermaid code">⎘ Copy</button>
  <button class="btn" onclick="exportSvg()" title="Download SVG">↓ SVG</button>
  <button class="btn" onclick="toggleTheme()">◑ Theme</button>
</header>

<div class="layout">
  <aside class="sidebar" id="sidebar">
    <div class="sidebar-header">Tables</div>
    <div class="search-wrap">
      <input class="search-input" id="searchInput" placeholder="Filter tables..." oninput="filterTables(this.value)">
    </div>
    <div class="table-list" id="tableList"></div>
    <div class="gen-at">Generated: ${schema.generatedAt}</div>
  </aside>

  <div class="canvas-wrap">
    <div class="canvas-inner" id="canvasInner">
      <div id="diagram">
        <pre class="mermaid">${mermaidCode}</pre>
      </div>
    </div>
    <div class="zoom-controls">
      <button class="zoom-btn" onclick="zoom(1.2)">+</button>
      <div class="zoom-label" id="zoomLabel">100%</div>
      <button class="zoom-btn" onclick="zoom(1/1.2)">−</button>
      <button class="zoom-btn" onclick="resetZoom()" title="Reset zoom" style="font-size:.75rem">⊙</button>
    </div>
  </div>

  <aside class="detail-panel" id="detailPanel">
    <div class="detail-header">
      <span class="detail-title" id="detailTitle"></span>
      <span class="close-btn" onclick="closeDetail()">✕</span>
    </div>
    <div class="detail-body" id="detailBody"></div>
  </aside>
</div>

<div class="toast" id="toast"></div>

<script>
  const SCHEMA = ${schemaJson};
  const MERMAID_CODE = \`${mermaidCode.replace(/`/g, '\\`')}\`;
  const tableMap = new Map(SCHEMA.tables.map(t => [t.name, t]));

  let scale = 1;

  // Init Mermaid
  mermaid.initialize({
    startOnLoad: true,
    theme: 'dark',
    er: { diagramPadding: 30 },
  });

  // Build table list
  function buildTableList(tables) {
    const list = document.getElementById('tableList');
    list.innerHTML = '';
    tables.forEach(t => {
      const item = document.createElement('div');
      item.className = 'table-item';
      item.dataset.name = t.name;
      item.innerHTML = \`
        <span class="table-icon">▦</span>
        <span>\${t.name}</span>
        <span class="col-count">\${t.columns.length}</span>
      \`;
      item.onclick = () => showDetail(t.name);
      list.appendChild(item);
    });
  }
  buildTableList(SCHEMA.tables);

  function filterTables(q) {
    const filtered = SCHEMA.tables.filter(t => t.name.toLowerCase().includes(q.toLowerCase()));
    buildTableList(filtered);
  }

  function showDetail(name) {
    const t = tableMap.get(name);
    if (!t) return;

    // Highlight sidebar item
    document.querySelectorAll('.table-item').forEach(el => el.classList.remove('active'));
    const el = document.querySelector(\`.table-item[data-name="\${name}"]\`);
    if (el) el.classList.add('active');

    const panel = document.getElementById('detailPanel');
    panel.classList.add('visible');
    document.getElementById('detailTitle').textContent = t.name;

    let html = '<div class="section-label">Columns</div>';
    t.columns.forEach(col => {
      const badges = [];
      if (col.isPrimaryKey) badges.push('<span class="badge badge-pk">PK</span>');
      if (col.isForeignKey) badges.push('<span class="badge badge-fk">FK</span>');
      if (col.nullable) badges.push('<span class="badge badge-null">null</span>');
      html += \`<div class="col-row">
        <span class="col-name">\${col.name}</span>
        \${badges.join('')}
        <span class="col-type">\${col.type}</span>
      </div>\`;
    });

    if (t.foreignKeys.length > 0) {
      html += '<div class="section-label">Foreign Keys</div>';
      t.foreignKeys.forEach(fk => {
        html += \`<div class="fk-row">\${fk.columns.join(', ')} → <span>\${fk.referencedTable}</span>(\${fk.referencedColumns.join(', ')})</div>\`;
      });
    }

    if (t.indexes.length > 0) {
      html += '<div class="section-label">Indexes</div>';
      t.indexes.forEach(idx => {
        const u = idx.isUnique ? '⊕ UNIQUE' : '⊙';
        html += \`<div class="idx-row">\${u} [\${idx.columns.join(', ')}]</div>\`;
      });
    }

    document.getElementById('detailBody').innerHTML = html;
  }

  function closeDetail() {
    document.getElementById('detailPanel').classList.remove('visible');
    document.querySelectorAll('.table-item').forEach(el => el.classList.remove('active'));
  }

  // Zoom
  function zoom(factor) {
    scale = Math.min(Math.max(scale * factor, 0.2), 4);
    document.getElementById('diagram').style.transform = \`scale(\${scale})\`;
    document.getElementById('zoomLabel').textContent = Math.round(scale * 100) + '%';
  }
  function resetZoom() {
    scale = 1;
    document.getElementById('diagram').style.transform = '';
    document.getElementById('zoomLabel').textContent = '100%';
  }

  // Mouse wheel zoom
  document.getElementById('canvasInner').addEventListener('wheel', e => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      zoom(e.deltaY < 0 ? 1.1 : 1/1.1);
    }
  }, { passive: false });

  // Sidebar toggle
  function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('collapsed');
  }

  // Theme
  function toggleTheme() {
    const body = document.body;
    const isDark = body.dataset.theme === 'dark';
    body.dataset.theme = isDark ? 'light' : 'dark';
    mermaid.initialize({ startOnLoad: false, theme: isDark ? 'default' : 'dark' });
  }

  // Copy Mermaid code
  function copyMermaid() {
    navigator.clipboard.writeText(MERMAID_CODE).then(() => toast('Mermaid code copied!'));
  }

  // Export SVG
  function exportSvg() {
    const svg = document.querySelector('#diagram svg');
    if (!svg) { toast('Diagram not ready'); return; }
    const blob = new Blob([svg.outerHTML], { type: 'image/svg+xml' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = \`\${SCHEMA.database}-er.svg\`;
    a.click();
    toast('SVG downloaded!');
  }

  // Toast
  function toast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 2500);
  }

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeDetail();
    if ((e.ctrlKey || e.metaKey) && e.key === '0') { e.preventDefault(); resetZoom(); }
    if ((e.ctrlKey || e.metaKey) && e.key === '=') { e.preventDefault(); zoom(1.2); }
    if ((e.ctrlKey || e.metaKey) && e.key === '-') { e.preventDefault(); zoom(1/1.2); }
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); document.getElementById('searchInput').focus(); }
  });
</script>
</body>
</html>`;
}

export async function startServer(options: ServeOptions): Promise<void> {
  const loadSchema = (): Schema => {
    return JSON.parse(fs.readFileSync(options.schema, 'utf-8'));
  };

  let schema = loadSchema();

  const server = http.createServer((req, res) => {
    const url = req.url ?? '/';

    if (url === '/api/schema') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(loadSchema()));
      return;
    }

    if (url === '/api/reload') {
      try {
        schema = loadSchema();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: String(err) }));
      }
      return;
    }

    // Main page
    try {
      if (options.watch) {
        schema = loadSchema(); // Always reload in watch mode
      }
      const html = buildHtml(schema);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end(`Error: ${err}`);
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.listen(options.port, options.host, () => resolve());
    server.once('error', reject);
  });

  const url = `http://${options.host}:${options.port}`;
  console.log(`SchemaViz server running at ${url}`);
  console.log(`Schema: ${path.resolve(options.schema)}`);
  if (options.watch) {
    console.log('Watch mode enabled — page reloads on every request');
  }
  console.log('\nPress Ctrl+C to stop');

  // Open browser if possible
  try {
    const { execSync } = require('child_process');
    const open =
      process.platform === 'darwin' ? 'open' :
      process.platform === 'win32' ? 'start' : 'xdg-open';
    execSync(`${open} ${url}`, { stdio: 'ignore' });
  } catch {
    // ignore if can't open browser
  }

  // Keep running
  await new Promise<void>(() => {});
}
