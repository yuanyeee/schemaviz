import { Schema } from '../../types';
import { generateMermaidCode, generatePlantUML } from '../../core/generator';
import { getPlantUMLUrl } from '../plantuml';
import { escapeJsonForHtmlScript, escapeForInlineTemplateLiteral, escapeHtmlText } from '../escape';

// ─── Main Diagram Page ────────────────────────────────────────────────────────

export function buildHtml(schema: Schema): string {
  const mermaidCode = generateMermaidCode(schema);
  const plantumlCode = generatePlantUML(schema);
  const plantumlUrl = getPlantUMLUrl(plantumlCode);
  const schemaJson = JSON.stringify(schema, null, 2);

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SchemaViz — ${schema.database}</title>
  <script src="/vendor/mermaid.min.js"></script>
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
    .btn.danger:hover { border-color: var(--error); color: var(--error); }

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

    /* ─── Feature Panel ─── */
    .feature-panel {
      width: 420px; flex-shrink: 0;
      background: var(--surface); border-left: 1px solid var(--border);
      display: none; flex-direction: column; overflow: hidden;
    }
    .feature-panel.visible { display: flex; }
    .fp-header {
      padding: 12px 16px; border-bottom: 1px solid var(--border);
      display: flex; align-items: center; gap: 8px; flex-shrink: 0;
    }
    .fp-title { font-weight: 600; font-size: 0.95rem; flex: 1; }
    .fp-body { flex: 1; overflow-y: auto; padding: 16px; }

    /* Validate */
    .validate-summary { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
    .badge-error { padding: 2px 8px; border-radius: 4px; background: rgba(248,113,113,.15); color: var(--error); font-size: .8rem; font-weight: 600; }
    .badge-warn  { padding: 2px 8px; border-radius: 4px; background: rgba(251,191,36,.15); color: var(--warn); font-size: .8rem; font-weight: 600; }
    .badge-info  { padding: 2px 8px; border-radius: 4px; background: rgba(99,102,241,.15); color: var(--accent); font-size: .8rem; font-weight: 600; }
    .validate-table-group { margin-bottom: 14px; }
    .validate-table-name { font-weight: 600; font-size: .85rem; margin-bottom: 6px; }
    .validate-issue { padding: 8px 10px; border-radius: 6px; margin-bottom: 6px; background: var(--surface2); border-left: 3px solid var(--border); }
    .validate-issue.level-error { border-left-color: var(--error); }
    .validate-issue.level-warning { border-left-color: var(--warn); }
    .validate-issue.level-info { border-left-color: var(--accent); }
    .issue-level { font-size: .7rem; font-weight: 700; text-transform: uppercase; }
    .issue-rule { font-size: .75rem; color: var(--text-muted); margin-left: 6px; }
    .issue-message { font-size: .82rem; margin-top: 4px; }
    .issue-suggestion { font-size: .78rem; color: var(--text-muted); margin-top: 3px; }

    /* Generate */
    .format-tabs { display: flex; gap: 4px; }
    .fmt-tab { padding: 4px 12px; border-radius: 4px; border: 1px solid var(--border); background: var(--surface2); color: var(--text-muted); cursor: pointer; font-size: .8rem; }
    .fmt-tab.active { background: var(--accent); border-color: var(--accent); color: #fff; }
    .code-block { background: var(--surface2); border: 1px solid var(--border); border-radius: 6px; padding: 12px; font-size: .78rem; overflow-x: auto; white-space: pre; font-family: monospace; max-height: 350px; overflow-y: auto; margin: 0; }
    .gen-file-header { display: flex; align-items: center; justify-content: space-between; font-size: .8rem; font-weight: 600; margin: 12px 0 4px; }

    /* Snapshots */
    .snap-save-row { display: flex; gap: 8px; }
    .snap-row { display: flex; align-items: center; gap: 8px; padding: 8px 4px; border-bottom: 1px solid var(--border); }
    .snap-tag { font-weight: 500; font-size: .85rem; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .snap-date { font-size: .75rem; color: var(--text-muted); white-space: nowrap; }

    /* Diff */
    .diff-mode-tabs { display: flex; gap: 4px; margin-bottom: 10px; }
    .diff-mode-tab { background: var(--surface2); border: 1px solid var(--border); border-radius: 4px 4px 0 0; padding: 5px 14px; font-size: .78rem; color: var(--text-muted); cursor: pointer; font-weight: 600; }
    .diff-mode-tab.active { background: var(--accent); color: #fff; border-color: var(--accent); }
    .diff-side { flex: 1; min-width: 220px; background: var(--surface2); border: 1px solid var(--border); border-radius: 6px; padding: 10px; }
    .diff-form { display: flex; flex-direction: column; gap: 8px; }
    .form-row { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
    .form-label { font-size: .82rem; width: 65px; flex-shrink: 0; color: var(--text-muted); }
    .diff-section { margin-bottom: 14px; }
    .diff-section-title { font-size: .78rem; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; margin-bottom: 6px; }
    .diff-section-title.added { color: var(--ok); }
    .diff-section-title.removed { color: var(--error); }
    .diff-section-title.modified { color: var(--warn); }
    .diff-table-chip { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: .82rem; margin: 2px; }
    .diff-table-chip.added { background: rgba(52,211,153,.1); color: var(--ok); }
    .diff-table-chip.removed { background: rgba(248,113,113,.1); color: var(--error); }
    .diff-modified-table { padding: 6px 10px; border-radius: 6px; background: var(--surface2); margin-bottom: 6px; }
    .diff-table-name { font-weight: 600; font-size: .85rem; margin-bottom: 4px; color: var(--warn); }
    .diff-col { font-size: .78rem; padding: 2px 0; font-family: monospace; }
    .diff-col.diff-added { color: var(--ok); }
    .diff-col.diff-removed { color: var(--error); }
    .diff-col.diff-modified { color: var(--warn); }
    .migration-details { margin-top: 12px; }
    .migration-details summary { cursor: pointer; font-size: .82rem; font-weight: 600; padding: 4px 0; }

    /* Diagram format toggle */
    .diagram-toggle {
      display: flex;
      border: 1px solid var(--border);
      border-radius: 6px;
      overflow: hidden;
      margin-right: 4px;
    }
    .dt-btn {
      padding: 4px 10px;
      border: none;
      background: var(--surface2);
      color: var(--text-muted);
      font-size: 0.78rem;
      cursor: pointer;
      transition: background .15s, color .15s;
    }
    .dt-btn:not(:last-child) { border-right: 1px solid var(--border); }
    .dt-btn:hover { color: var(--text); }
    .dt-btn.active { background: var(--accent); color: #fff; }

    /* PlantUML container */
    #plantumlDiagram { display: none; }
    #plantumlDiagram img { max-width: none; }
    .plantuml-error {
      color: var(--error);
      font-size: 0.85rem;
      padding: 20px;
    }
  </style>
</head>
<body data-theme="dark">

<header>
  <span class="logo">SchemaViz</span>
  <span class="db-badge">${schema.database}</span>
  <span class="stats">${schema.tables.length} tables</span>
  <span class="spacer"></span>
  <div class="diagram-toggle">
    <button class="dt-btn active" id="dtMermaid" onclick="switchDiagram('mermaid')">Mermaid</button>
    <button class="dt-btn" id="dtPlantUML" onclick="switchDiagram('plantuml')">PlantUML</button>
  </div>
  <button class="btn" onclick="openPanel('validate')" title="Validate schema">✔ Validate</button>
  <button class="btn" onclick="openPanel('generate')" title="Generate code">⚙ Generate</button>
  <button class="btn" onclick="openPanel('snapshot')" title="Save / browse snapshots">📷 Snapshot</button>
  <button class="btn" onclick="openPanel('diff')" title="Compare schemas">⟺ Diff</button>
  <button class="btn" onclick="toggleSidebar()" title="Toggle table list">☰ Tables</button>
  <button class="btn" onclick="copyDiagramCode()" title="Copy diagram code" id="copyBtn">⎘ Copy</button>
  <button class="btn" onclick="exportSvg()" title="Download SVG">↓ SVG</button>
  <button class="btn" onclick="toggleTheme()">◑ Theme</button>
  <button class="btn danger" onclick="disconnect()" title="Disconnect and go to login">⏏ 切断</button>
</header>

<div class="layout">
  <aside class="sidebar" id="sidebar">
    <div class="sidebar-header">Tables</div>
    <div class="search-wrap">
      <input class="search-input" id="searchInput" placeholder="Filter tables... (Ctrl+K)" oninput="filterTables(this.value)">
    </div>
    <div class="table-list" id="tableList"></div>
    <div class="gen-at">Generated: ${schema.generatedAt}</div>
  </aside>

  <div class="canvas-wrap">
    <div class="canvas-inner" id="canvasInner">
      <div id="diagram">
        <pre class="mermaid">${escapeHtmlText(mermaidCode)}</pre>
      </div>
      <div id="plantumlDiagram">
        <img id="plantumlImg" src="${plantumlUrl}" alt="PlantUML ER Diagram"
             style="max-width:none"
             onload="this.dataset.loaded='1';document.getElementById('plantumlFallback').style.display='none'"
             onerror="this.style.display='none';document.getElementById('plantumlFallback').style.display='block'">
        <div id="plantumlFallback" style="display:none;padding:16px;max-width:700px">
          <p style="color:var(--text-muted);font-size:0.85rem;margin-bottom:10px">PlantUML サーバーに接続できません。下記コードをコピーして <a href="https://www.plantuml.com/plantuml/uml/" target="_blank" style="color:var(--accent)">plantuml.com</a> で描画してください。</p>
          <pre style="background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:12px;font-size:0.78rem;overflow:auto;max-height:60vh;white-space:pre;font-family:monospace;color:var(--text)">${plantumlCode.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
        </div>
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

  <aside class="feature-panel" id="featurePanel">
    <div class="fp-header">
      <span class="fp-title" id="fpTitle"></span>
      <span class="close-btn" onclick="closeFeaturePanel()">✕</span>
    </div>
    <div class="fp-body" id="fpBody"></div>
  </aside>
</div>

<div class="toast" id="toast"></div>

<script>
  const SCHEMA = ${escapeJsonForHtmlScript(schemaJson)};
  const MERMAID_CODE = \`${escapeForInlineTemplateLiteral(mermaidCode)}\`;
  const PLANTUML_CODE = \`${escapeForInlineTemplateLiteral(plantumlCode)}\`;
  const tableMap = new Map(SCHEMA.tables.map(t => [t.name, t]));

  let scale = 1;
  let currentDiagramFormat = 'mermaid';

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

  // ─── Diagram switching (Mermaid / PlantUML) ───
  function switchDiagram(format) {
    currentDiagramFormat = format;
    var mermaidEl = document.getElementById('diagram');
    var plantumlEl = document.getElementById('plantumlDiagram');
    var btnM = document.getElementById('dtMermaid');
    var btnP = document.getElementById('dtPlantUML');

    if (format === 'mermaid') {
      mermaidEl.style.display = 'block';
      plantumlEl.style.display = 'none';
      btnM.classList.add('active');
      btnP.classList.remove('active');
    } else {
      mermaidEl.style.display = 'none';
      plantumlEl.style.display = 'block';
      btnM.classList.remove('active');
      btnP.classList.add('active');
    }
    resetZoom();
  }

  // Copy diagram code (Mermaid or PlantUML)
  function copyDiagramCode() {
    var code = currentDiagramFormat === 'mermaid' ? MERMAID_CODE : PLANTUML_CODE;
    var label = currentDiagramFormat === 'mermaid' ? 'Mermaid' : 'PlantUML';
    navigator.clipboard.writeText(code).then(function() { toast(label + ' code copied!'); });
  }

  // Export SVG
  function exportSvg() {
    if (currentDiagramFormat === 'mermaid') {
      var svg = document.querySelector('#diagram svg');
      if (!svg) { toast('Diagram not ready'); return; }
      var blob = new Blob([svg.outerHTML], { type: 'image/svg+xml' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = \`\${SCHEMA.database}-er-mermaid.svg\`;
      a.click();
      toast('SVG downloaded!');
    } else {
      // PlantUML SVG: get from the <img> src
      var img = document.getElementById('plantumlImg');
      if (img && img.src) {
        var a = document.createElement('a');
        a.href = img.src;
        a.download = \`\${SCHEMA.database}-er-plantuml.svg\`;
        a.target = '_blank';
        a.click();
        toast('PlantUML SVG opened!');
      } else {
        toast('PlantUML diagram not ready');
      }
    }
  }

  // Disconnect
  async function disconnect() {
    await fetch('/api/disconnect');
    window.location.href = '/';
  }

  // Toast
  function toast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 2500);
  }

  // ─── Feature Panel ────────────────────────────────────────────────────────
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function copyCodeBlock(id) {
    const text = document.getElementById(id).textContent;
    navigator.clipboard.writeText(text).then(() => toast('Copied!'));
  }

  // Event delegation for dynamic data-* buttons
  document.addEventListener('click', function(e) {
    const btn = e.target.closest('[data-delete-snap]');
    if (btn) doDeleteSnap(btn.dataset.deleteSnap);
    const cbtn = e.target.closest('[data-copy-id]');
    if (cbtn) copyCodeBlock(cbtn.dataset.copyId);
  });

  let currentPanelName = null;
  function openPanel(name) {
    currentPanelName = name;
    document.getElementById('featurePanel').classList.add('visible');
    const titles = { validate: '✔ Validate Schema', generate: '⚙ Generate Code', snapshot: '📷 Snapshots', diff: '⟺ Schema Diff' };
    document.getElementById('fpTitle').textContent = titles[name];
    renderPanelContent(name);
  }
  function closeFeaturePanel() {
    document.getElementById('featurePanel').classList.remove('visible');
    currentPanelName = null;
  }
  function renderPanelContent(name) {
    if (name === 'validate') renderValidatePanel();
    else if (name === 'generate') renderGeneratePanel();
    else if (name === 'snapshot') renderSnapshotPanel().catch(function(e) { console.error(e); });
    else if (name === 'diff') renderDiffPanel().catch(function(e) { console.error(e); });
  }

  // ── Validate ──
  function renderValidatePanel() {
    document.getElementById('fpBody').innerHTML =
      '<button class="btn primary" onclick="runValidate()">▶ Run Validation</button>' +
      '<div id="validateResults" style="margin-top:14px"></div>';
  }
  async function runValidate() {
    const el = document.getElementById('validateResults');
    el.innerHTML = '<span style="color:var(--text-muted);font-size:.85rem">Running...</span>';
    const data = await fetch('/api/validate', { method: 'POST' }).then(r => r.json());
    if (data.error) { el.innerHTML = '<div style="color:var(--error)">' + escapeHtml(data.error) + '</div>'; return; }
    if (data.issues.length === 0) { el.innerHTML = '<div style="color:var(--ok);padding:8px 0">✔ All checks passed!</div>'; return; }
    let html = '<div class="validate-summary">';
    if (data.errorCount) html += '<span class="badge-error">' + data.errorCount + ' Error' + (data.errorCount > 1 ? 's' : '') + '</span>';
    if (data.warningCount) html += '<span class="badge-warn">' + data.warningCount + ' Warning' + (data.warningCount > 1 ? 's' : '') + '</span>';
    if (data.infoCount) html += '<span class="badge-info">' + data.infoCount + ' Info</span>';
    html += '</div>';
    const byTable = {};
    for (const issue of data.issues) { if (!byTable[issue.table]) byTable[issue.table] = []; byTable[issue.table].push(issue); }
    for (const [table, issues] of Object.entries(byTable)) {
      html += '<div class="validate-table-group"><div class="validate-table-name">▦ ' + escapeHtml(table) + '</div>';
      for (const i of issues) {
        html += '<div class="validate-issue level-' + i.level + '">';
        html += '<div><span class="issue-level">' + i.level.toUpperCase() + '</span><span class="issue-rule">[' + escapeHtml(i.rule) + ']</span></div>';
        html += '<div class="issue-message">' + escapeHtml(i.message) + '</div>';
        html += '<div class="issue-suggestion">→ ' + escapeHtml(i.suggestion) + '</div></div>';
      }
      html += '</div>';
    }
    el.innerHTML = html;
  }

  // ── Generate ──
  let generateFormat = 'prisma';
  function renderGeneratePanel() {
    generateFormat = 'prisma';
    document.getElementById('fpBody').innerHTML =
      '<div class="format-tabs">' +
      '<button class="fmt-tab active" onclick="setFmt(\\'prisma\\',this)">Prisma</button>' +
      '<button class="fmt-tab" onclick="setFmt(\\'typeorm\\',this)">TypeORM</button>' +
      '<button class="fmt-tab" onclick="setFmt(\\'graphql\\',this)">GraphQL</button>' +
      '</div>' +
      '<button class="btn primary" style="margin:10px 0" onclick="runGenerate()">▶ Generate</button>' +
      '<div id="generateResults"></div>';
  }
  function setFmt(fmt, btn) {
    generateFormat = fmt;
    document.querySelectorAll('.fmt-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  }
  async function runGenerate() {
    const el = document.getElementById('generateResults');
    el.innerHTML = '<span style="color:var(--text-muted);font-size:.85rem">Generating...</span>';
    const data = await fetch('/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify({ format: generateFormat }) }).then(r => r.json());
    if (data.error) { el.innerHTML = '<div style="color:var(--error)">' + escapeHtml(data.error) + '</div>'; return; }
    let html = '';
    data.files.forEach(function(file, idx) {
      const bid = 'genCode' + idx;
      html += '<div class="gen-file-header"><span>' + escapeHtml(file.name) + '</span><button class="btn" data-copy-id="' + bid + '">⎘ Copy</button></div>';
      html += '<pre class="code-block" id="' + bid + '">' + escapeHtml(file.content) + '</pre>';
    });
    el.innerHTML = html;
  }

  // ── Snapshot ──
  async function renderSnapshotPanel() {
    document.getElementById('fpBody').innerHTML =
      '<div class="snap-save-row">' +
      '<input id="snapTagInput" class="search-input" placeholder="Tag (optional)" style="flex:1">' +
      '<button class="btn primary" onclick="doSaveSnapshot()">Save</button>' +
      '</div>' +
      '<div class="section-label" style="margin-top:14px">Saved Snapshots</div>' +
      '<div id="snapList"><span style="color:var(--text-muted);font-size:.85rem">Loading...</span></div>';
    await refreshSnapList();
  }
  async function doSaveSnapshot() {
    const tag = document.getElementById('snapTagInput').value.trim();
    const data = await fetch('/api/snapshots', { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify({ tag: tag || undefined }) }).then(r => r.json());
    if (data.error) { toast('Error: ' + data.error); return; }
    document.getElementById('snapTagInput').value = '';
    toast('Snapshot saved' + (data.tag ? ': ' + data.tag : ''));
    await refreshSnapList();
  }
  async function refreshSnapList() {
    const data = await fetch('/api/snapshots').then(r => r.json());
    const el = document.getElementById('snapList');
    if (!el) return;
    const snaps = data.snapshots || [];
    if (snaps.length === 0) { el.innerHTML = '<div style="color:var(--text-muted);font-size:.85rem">No snapshots yet.</div>'; return; }
    let html = '';
    snaps.slice().reverse().forEach(function(s) {
      html += '<div class="snap-row">';
      html += '<div style="flex:1;min-width:0"><div class="snap-tag">' + escapeHtml(s.tag || s.id) + '</div>';
      html += '<div class="snap-date">' + new Date(s.savedAt).toLocaleString() + '</div></div>';
      html += '<button class="btn danger" data-delete-snap="' + escapeHtml(s.id) + '">✕</button></div>';
    });
    el.innerHTML = html;
  }
  async function doDeleteSnap(id) {
    const data = await fetch('/api/snapshots/' + id, { method: 'DELETE' }).then(r => r.json());
    if (data.ok) { toast('Snapshot deleted'); await refreshSnapList(); }
    else toast('Failed to delete snapshot');
  }

  // ── Diff (Advanced Two-Source) ──
  var diffLeftTables = [];
  var diffRightTables = [];
  var diffSnapshots = [];
  var diffMode = 'quick'; // 'quick' or 'advanced'

  async function renderDiffPanel() {
    document.getElementById('fpBody').innerHTML = '<div id="diffPanelInner"><span style="color:var(--text-muted);font-size:.85rem">Loading...</span></div>';

    // Load snapshots and connection history in parallel
    var snapData = await fetch('/api/snapshots').then(function(r) { return r.json(); });
    var connData = await fetch('/api/connections').then(function(r) { return r.json(); });
    diffSnapshots = (snapData.snapshots || []).slice().reverse();
    var conns = connData.connections || [];

    // Build current schema table options for Quick Compare
    var currentTableOpts = '';
    SCHEMA.tables.forEach(function(t) {
      currentTableOpts += '<option value="' + escapeHtml(t.name) + '">' + escapeHtml(t.name) + '</option>';
    });

    // Build snapshot options
    var snapOpts = '';
    diffSnapshots.forEach(function(s) {
      snapOpts += '<option value="' + escapeHtml(s.id) + '">' + escapeHtml(s.tag || s.id) + ' (' + new Date(s.savedAt).toLocaleDateString() + ')</option>';
    });

    // Build connection history options
    var connOpts = '';
    conns.forEach(function(c, i) {
      connOpts += '<option value="' + i + '">' + escapeHtml(c.label) + '</option>';
    });

    // ── Quick Compare Tab ──
    var quickHtml = '<div id="diff-quick-panel">';
    quickHtml += '<div style="font-size:.82rem;color:var(--text-muted);margin-bottom:8px">同じスキーマ内の2つのテーブルを項目レベルで比較します</div>';
    quickHtml += '<div class="form-row"><label class="form-label">Table A:</label>';
    quickHtml += '<select id="diff-quick-left" class="search-input">' + currentTableOpts + '</select></div>';
    quickHtml += '<div class="form-row"><label class="form-label">Table B:</label>';
    quickHtml += '<select id="diff-quick-right" class="search-input">' + currentTableOpts + '</select></div>';
    quickHtml += '<button class="btn primary" style="margin-top:8px" onclick="runQuickTableCompare()">▶ Compare Tables</button>';
    quickHtml += '</div>';

    // ── Advanced Tab (two-source) ──
    function buildSideHtml(side) {
      var id = side;
      var label = side === 'left' ? 'Left (From)' : 'Right (To)';
      var h = '';
      h += '<div class="diff-side" id="diff-' + id + '">';
      h += '<div style="font-size:.8rem;font-weight:700;color:var(--accent);text-transform:uppercase;margin-bottom:6px">' + label + '</div>';
      h += '<div class="form-row"><label class="form-label">Source:</label>';
      h += '<select id="diff-' + id + '-source" class="search-input" onchange="diffSourceChanged(\\'' + id + '\\')">';
      h += '<option value="current">Current Schema</option>';
      h += '<option value="snapshot">Snapshot</option>';
      h += '<option value="connection">External DB</option>';
      h += '</select></div>';
      h += '<div id="diff-' + id + '-snap-row" class="form-row" style="display:none"><label class="form-label">Snapshot:</label>';
      h += '<select id="diff-' + id + '-snap" class="search-input">' + snapOpts + '</select></div>';
      h += '<div id="diff-' + id + '-conn" style="display:none">';
      if (conns.length > 0) {
        h += '<div class="form-row"><label class="form-label">History:</label>';
        h += '<select id="diff-' + id + '-connhist" class="search-input" onchange="diffFillFromHistory(\\'' + id + '\\')">';
        h += '<option value="">-- select --</option>' + connOpts;
        h += '</select></div>';
      }
      h += '<div class="form-row"><label class="form-label">Type:</label>';
      h += '<select id="diff-' + id + '-type" class="search-input">';
      h += '<option value="postgresql">PostgreSQL</option><option value="mysql">MySQL</option><option value="sqlserver">SQL Server</option><option value="sqlite">SQLite</option>';
      h += '</select></div>';
      h += '<div class="form-row"><label class="form-label">Host:</label><input id="diff-' + id + '-host" class="search-input" value="localhost"></div>';
      h += '<div class="form-row"><label class="form-label">Port:</label><input id="diff-' + id + '-port" class="search-input" value="5432" style="width:80px"></div>';
      h += '<div class="form-row"><label class="form-label">Database:</label><input id="diff-' + id + '-db" class="search-input"></div>';
      h += '<div class="form-row"><label class="form-label">User:</label><input id="diff-' + id + '-user" class="search-input"></div>';
      h += '<div class="form-row"><label class="form-label">Password:</label><input id="diff-' + id + '-pass" class="search-input" type="password"></div>';
      h += '</div>';
      h += '<button class="btn" style="margin-top:6px;font-size:.78rem" onclick="diffLoadTables(\\'' + id + '\\')">Load Tables</button>';
      h += '<div id="diff-' + id + '-tables" style="margin-top:6px"></div>';
      h += '</div>';
      return h;
    }

    var advHtml = '<div id="diff-advanced-panel" style="display:none">';
    advHtml += '<div style="display:flex;gap:12px;flex-wrap:wrap">';
    advHtml += buildSideHtml('left');
    advHtml += buildSideHtml('right');
    advHtml += '</div>';
    advHtml += '<div id="diff-mapping-section" style="margin-top:12px;display:none">';
    advHtml += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">';
    advHtml += '<span style="font-size:.78rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.04em">Table Mapping</span>';
    advHtml += '<button class="btn" style="padding:2px 6px;font-size:.7rem" onclick="diffAddMapping()">+ Add</button>';
    advHtml += '</div>';
    advHtml += '<div style="font-size:.72rem;color:var(--text-muted);margin-bottom:4px">異なるテーブル名を対応付けて項目レベルで比較できます</div>';
    advHtml += '<div id="diff-mappings" style="max-height:120px;overflow-y:auto"></div>';
    advHtml += '</div>';
    advHtml += '<button class="btn primary" style="margin-top:12px" onclick="runDiffAdvanced()">▶ Compare</button>';
    advHtml += '</div>';

    // Mode toggle tabs
    var html = '<div class="diff-mode-tabs">';
    html += '<button class="diff-mode-tab active" id="diff-tab-quick" onclick="switchDiffMode(\\'quick\\')">Quick Compare</button>';
    html += '<button class="diff-mode-tab" id="diff-tab-advanced" onclick="switchDiffMode(\\'advanced\\')">Advanced</button>';
    html += '</div>';
    html += quickHtml;
    html += advHtml;
    html += '<div id="diffResults" style="margin-top:14px"></div>';

    document.getElementById('diffPanelInner').innerHTML = html;
    window._diffConns = conns;
  }

  function switchDiffMode(mode) {
    diffMode = mode;
    document.getElementById('diff-quick-panel').style.display = mode === 'quick' ? 'block' : 'none';
    document.getElementById('diff-advanced-panel').style.display = mode === 'advanced' ? 'block' : 'none';
    document.getElementById('diff-tab-quick').classList.toggle('active', mode === 'quick');
    document.getElementById('diff-tab-advanced').classList.toggle('active', mode === 'advanced');
    document.getElementById('diffResults').innerHTML = '';
  }

  async function runQuickTableCompare() {
    var tableA = document.getElementById('diff-quick-left').value;
    var tableB = document.getElementById('diff-quick-right').value;
    if (tableA === tableB) { toast('異なるテーブルを選択してください'); return; }

    var el = document.getElementById('diffResults');
    el.innerHTML = '<span style="color:var(--text-muted);font-size:.85rem">Comparing ' + escapeHtml(tableA) + ' vs ' + escapeHtml(tableB) + '...</span>';

    // Use diff-advanced with table mapping: map right table name to left table name
    var body = {
      left: { source: 'current', tables: [tableA] },
      right: { source: 'current', tables: [tableB] },
      tableMapping: [{ left: tableA, right: tableB }]
    };

    try {
      var data = await fetch('/api/diff-advanced', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify(body)
      }).then(function(r) { return r.json(); });

      if (data.error) { el.innerHTML = '<div style="color:var(--error)">' + escapeHtml(data.error) + '</div>'; return; }
      renderDiffResults(el, data, tableA + ' vs ' + tableB);
    } catch (e) {
      el.innerHTML = '<div style="color:var(--error)">' + escapeHtml(String(e)) + '</div>';
    }
  }

  function renderDiffResults(el, data, title) {
    var d = data.diff;
    var html = '';
    if (title) {
      html += '<div style="font-size:.82rem;font-weight:700;color:var(--accent);margin-bottom:8px">' + escapeHtml(title) + '</div>';
    }

    // Summary
    var totalChanges = d.added.length + d.removed.length + d.modified.length;
    if (totalChanges === 0) {
      html += '<div style="color:var(--ok);padding:8px 0;font-size:.85rem">✔ No differences found.</div>';
      el.innerHTML = html;
      return;
    }

    html += '<div class="diff-section"><div class="diff-section-title added">+ Added Tables (' + d.added.length + ')</div>';
    if (d.added.length) {
      d.added.forEach(function(t) {
        html += '<div class="diff-modified-table" style="border-left:3px solid var(--ok)">';
        html += '<div class="diff-table-name" style="color:var(--ok)">+ ' + escapeHtml(t.name) + '</div>';
        (t.columns || []).forEach(function(col) {
          var colInfo = escapeHtml(col.name) + ' <span style="color:var(--text-muted)">' + escapeHtml(col.type || '') + '</span>';
          if (col.nullable === false) colInfo += ' <span style="font-size:.7rem;color:var(--warn)">NOT NULL</span>';
          if (col.isPrimaryKey) colInfo += ' <span style="font-size:.7rem;color:var(--accent)">PK</span>';
          html += '<div class="diff-col diff-added" style="padding-left:8px">+ ' + colInfo + '</div>';
        });
        html += '</div>';
      });
    } else {
      html += '<span style="color:var(--text-muted);font-size:.8rem">None</span>';
    }
    html += '</div>';

    html += '<div class="diff-section"><div class="diff-section-title removed">- Removed Tables (' + d.removed.length + ')</div>';
    if (d.removed.length) {
      d.removed.forEach(function(t) {
        html += '<div class="diff-modified-table" style="border-left:3px solid var(--error)">';
        html += '<div class="diff-table-name" style="color:var(--error)">- ' + escapeHtml(t.name) + '</div>';
        (t.columns || []).forEach(function(col) {
          var colInfo = escapeHtml(col.name) + ' <span style="color:var(--text-muted)">' + escapeHtml(col.type || '') + '</span>';
          html += '<div class="diff-col diff-removed" style="padding-left:8px">- ' + colInfo + '</div>';
        });
        html += '</div>';
      });
    } else {
      html += '<span style="color:var(--text-muted);font-size:.8rem">None</span>';
    }
    html += '</div>';

    html += '<div class="diff-section"><div class="diff-section-title modified">~ Modified Tables (' + d.modified.length + ')</div>';
    if (d.modified.length) {
      d.modified.forEach(function(m) {
        html += '<div class="diff-modified-table"><div class="diff-table-name">~ ' + escapeHtml(m.name) + '</div>';
        (m.columns || []).forEach(function(c) {
          var sym = c.type === 'added' ? '+' : c.type === 'removed' ? '-' : '~';
          var detail = '';
          if (c.type === 'modified') {
            var parts = [];
            if (c.oldType !== c.newType) parts.push(escapeHtml(c.oldType) + ' -> ' + escapeHtml(c.newType));
            if (c.oldNullable !== c.newNullable) parts.push(c.oldNullable ? 'NULL -> NOT NULL' : 'NOT NULL -> NULL');
            if (parts.length > 0) detail = ' (' + parts.join(', ') + ')';
          }
          html += '<div class="diff-col diff-' + c.type + '">' + sym + ' ' + escapeHtml(c.name) + detail + '</div>';
        });
        html += '</div>';
      });
    } else {
      html += '<span style="color:var(--text-muted);font-size:.8rem">None</span>';
    }
    html += '</div>';

    html += '<details class="migration-details"><summary>Migration SQL</summary>';
    html += '<button class="btn" style="margin:6px 0" data-copy-id="migrationSql">⎘ Copy SQL</button>';
    html += '<pre class="code-block" id="migrationSql">' + escapeHtml(data.migration) + '</pre></details>';
    el.innerHTML = html;
  }

  function diffSourceChanged(side) {
    var src = document.getElementById('diff-' + side + '-source').value;
    var snapRow = document.getElementById('diff-' + side + '-snap-row');
    var connDiv = document.getElementById('diff-' + side + '-conn');
    snapRow.style.display = src === 'snapshot' ? 'flex' : 'none';
    connDiv.style.display = src === 'connection' ? 'block' : 'none';
  }

  function diffFillFromHistory(side) {
    var sel = document.getElementById('diff-' + side + '-connhist');
    var idx = parseInt(sel.value, 10);
    if (isNaN(idx) || !window._diffConns[idx]) return;
    var c = window._diffConns[idx].config;
    var el = function(id) { return document.getElementById('diff-' + side + '-' + id); };
    if (c.type) el('type').value = c.type;
    if (c.host) el('host').value = c.host;
    if (c.port) el('port').value = c.port;
    if (c.database) el('db').value = c.database;
    if (c.user) el('user').value = c.user;
    el('pass').value = ''; // passwords are never saved (T2.3)
  }

  function diffGetConnConfig(side) {
    var el = function(id) { return document.getElementById('diff-' + side + '-' + id); };
    return {
      type: el('type').value,
      host: el('host').value || 'localhost',
      port: parseInt(el('port').value, 10) || undefined,
      database: el('db').value,
      user: el('user').value,
      password: el('pass').value
    };
  }

  async function diffLoadTables(side) {
    var src = document.getElementById('diff-' + side + '-source').value;
    var container = document.getElementById('diff-' + side + '-tables');
    container.innerHTML = '<span style="color:var(--text-muted);font-size:.8rem">Loading...</span>';
    var tables = [];
    try {
      if (src === 'current') {
        tables = SCHEMA.tables.map(function(t) { return t.name; });
      } else if (src === 'snapshot') {
        var snapId = document.getElementById('diff-' + side + '-snap').value;
        var snapResp = await fetch('/api/snapshots/' + encodeURIComponent(snapId) + '/tables').then(function(r) { return r.json(); });
        if (snapResp.error) { container.innerHTML = '<div style="color:var(--error);font-size:.8rem">' + escapeHtml(snapResp.error) + '</div>'; return; }
        tables = snapResp.tables || [];
      } else if (src === 'connection') {
        var config = diffGetConnConfig(side);
        var resp = await fetch('/api/fetch-tables', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify(config)
        }).then(function(r) { return r.json(); });
        if (resp.error) { container.innerHTML = '<div style="color:var(--error);font-size:.8rem">' + escapeHtml(resp.error) + '</div>'; return; }
        tables = resp.tables || [];
      }
    } catch (e) {
      container.innerHTML = '<div style="color:var(--error);font-size:.8rem">' + escapeHtml(String(e)) + '</div>';
      return;
    }

    if (side === 'left') diffLeftTables = tables;
    else diffRightTables = tables;

    var h = '<div style="display:flex;align-items:center;gap:6px;margin-bottom:3px">';
    h += '<span style="font-size:.72rem;font-weight:600;color:var(--text-muted);text-transform:uppercase">Tables (' + tables.length + ')</span>';
    h += '<button class="btn" style="padding:1px 5px;font-size:.68rem" onclick="diffToggleAll(\\'' + side + '\\',true)">All</button>';
    h += '<button class="btn" style="padding:1px 5px;font-size:.68rem" onclick="diffToggleAll(\\'' + side + '\\',false)">None</button>';
    h += '</div>';
    h += '<div style="max-height:120px;overflow-y:auto;border:1px solid var(--border);border-radius:4px;padding:3px 5px">';
    tables.forEach(function(t) {
      h += '<label style="display:flex;align-items:center;gap:4px;padding:1px 3px;font-size:.78rem;cursor:pointer">';
      h += '<input type="checkbox" class="diff-' + side + '-tcb" value="' + escapeHtml(t) + '" checked style="accent-color:var(--accent)"> ' + escapeHtml(t);
      h += '</label>';
    });
    h += '</div>';
    container.innerHTML = h;

    // Show mapping section if both sides have tables
    if (diffLeftTables.length > 0 && diffRightTables.length > 0) {
      document.getElementById('diff-mapping-section').style.display = 'block';
    }
  }

  function diffToggleAll(side, checked) {
    document.querySelectorAll('.diff-' + side + '-tcb').forEach(function(cb) { cb.checked = checked; });
  }

  function diffAddMapping() {
    var container = document.getElementById('diff-mappings');
    var leftOpts = '';
    diffLeftTables.forEach(function(t) { leftOpts += '<option value="' + escapeHtml(t) + '">' + escapeHtml(t) + '</option>'; });
    var rightOpts = '';
    diffRightTables.forEach(function(t) { rightOpts += '<option value="' + escapeHtml(t) + '">' + escapeHtml(t) + '</option>'; });

    var row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:6px;margin-bottom:3px;font-size:.78rem';
    row.innerHTML = '<select class="search-input diff-map-left" style="flex:1">' + leftOpts + '</select>' +
      '<span style="color:var(--text-muted)">↔</span>' +
      '<select class="search-input diff-map-right" style="flex:1">' + rightOpts + '</select>' +
      '<button class="btn" style="padding:1px 5px;font-size:.7rem" onclick="this.parentElement.remove()">✕</button>';
    container.appendChild(row);
  }

  function diffGetSelectedTables(side) {
    var selected = [];
    document.querySelectorAll('.diff-' + side + '-tcb:checked').forEach(function(cb) { selected.push(cb.value); });
    return selected;
  }

  async function runDiffAdvanced() {
    var el = document.getElementById('diffResults');
    el.innerHTML = '<span style="color:var(--text-muted);font-size:.85rem">Comparing...</span>';

    // Build left side params
    var leftSource = document.getElementById('diff-left-source').value;
    var leftParams = { source: leftSource };
    if (leftSource === 'snapshot') {
      leftParams.snapshotId = document.getElementById('diff-left-snap').value;
    } else if (leftSource === 'connection') {
      leftParams.config = diffGetConnConfig('left');
    }
    var leftTables = diffGetSelectedTables('left');
    if (leftTables.length > 0 && leftTables.length < diffLeftTables.length) {
      leftParams.tables = leftTables;
    }

    // Build right side params
    var rightSource = document.getElementById('diff-right-source').value;
    var rightParams = { source: rightSource };
    if (rightSource === 'snapshot') {
      rightParams.snapshotId = document.getElementById('diff-right-snap').value;
    } else if (rightSource === 'connection') {
      rightParams.config = diffGetConnConfig('right');
    }
    var rightTables = diffGetSelectedTables('right');
    if (rightTables.length > 0 && rightTables.length < diffRightTables.length) {
      rightParams.tables = rightTables;
    }

    // Collect table mappings
    var mappings = [];
    document.querySelectorAll('#diff-mappings > div').forEach(function(row) {
      var leftSel = row.querySelector('.diff-map-left');
      var rightSel = row.querySelector('.diff-map-right');
      if (leftSel && rightSel) {
        mappings.push({ left: leftSel.value, right: rightSel.value });
      }
    });

    var body = { left: leftParams, right: rightParams };
    if (mappings.length > 0) body.tableMapping = mappings;

    try {
      var data = await fetch('/api/diff-advanced', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify(body)
      }).then(function(r) { return r.json(); });

      if (data.error) { el.innerHTML = '<div style="color:var(--error)">' + escapeHtml(data.error) + '</div>'; return; }
      var title = mappings.length > 0 ? 'Mapped Comparison (' + mappings.map(function(m) { return m.left + ' ↔ ' + m.right; }).join(', ') + ')' : null;
      renderDiffResults(el, data, title);
    } catch (e) {
      el.innerHTML = '<div style="color:var(--error)">' + escapeHtml(String(e)) + '</div>';
    }
  }

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeDetail(); closeFeaturePanel(); }
    if ((e.ctrlKey || e.metaKey) && e.key === '0') { e.preventDefault(); resetZoom(); }
    if ((e.ctrlKey || e.metaKey) && e.key === '=') { e.preventDefault(); zoom(1.2); }
    if ((e.ctrlKey || e.metaKey) && e.key === '-') { e.preventDefault(); zoom(1/1.2); }
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); document.getElementById('searchInput').focus(); }
  });
</script>
</body>
</html>`;
}
