import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import { Schema } from '../types';
import { generateMermaidCode, generatePlantUML } from './generator';
import { createAdapter } from '../adapters/base';
import { validateSchema } from './validator';
import { generatePrismaSchema } from './codegen/prisma';
import { generateTypeOrmEntities } from './codegen/typeorm';
import { generateGraphQLSchema } from './codegen/graphql';
import { saveSnapshotFromData, loadIndex, loadSnapshot, deleteSnapshot } from './history';
import { computeDiff, generateMigrationSQL } from './diff';

export interface ServeOptions {
  schema?: string;   // Optional — omit to show login page on startup
  port: number;
  host: string;
  watch: boolean;
}

// ─── Login Page ───────────────────────────────────────────────────────────────

export function buildLoginHtml(): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SchemaViz — Connect to Server</title>
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
      --ok: #34d399;
    }
    [data-theme="light"] {
      --bg: #e8ecf0;
      --surface: #f5f7f9;
      --surface2: #eaedf0;
      --border: #c8cdd3;
      --text: #0f172a;
      --text-muted: #64748b;
      --accent: #4f46e5;
      --accent-hover: #6366f1;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Tahoma, sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }

    /* ── Dialog card ── */
    .dialog {
      width: 460px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 4px;
      box-shadow: 0 8px 40px rgba(0,0,0,0.45);
      overflow: hidden;
    }

    /* Title bar */
    .dialog-titlebar {
      background: #2b3a6b;
      padding: 10px 16px;
      display: flex;
      align-items: center;
      gap: 10px;
      user-select: none;
    }
    .dialog-titlebar .app-icon { font-size: 1.3rem; }
    .dialog-titlebar .app-name {
      font-size: 0.95rem;
      font-weight: 600;
      color: #fff;
    }
    .dialog-titlebar .theme-btn {
      margin-left: auto;
      background: none;
      border: none;
      color: rgba(255,255,255,0.65);
      cursor: pointer;
      font-size: 1rem;
      padding: 2px 4px;
      border-radius: 3px;
    }
    .dialog-titlebar .theme-btn:hover { color: #fff; background: rgba(255,255,255,0.1); }

    /* Section header */
    .dialog-section-header {
      background: var(--surface2);
      border-bottom: 1px solid var(--border);
      padding: 10px 20px 10px 16px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .dialog-section-header .db-icon { font-size: 1.6rem; }
    .dialog-section-header h2 { font-size: 0.9rem; font-weight: 600; color: var(--text); }
    .dialog-section-header p { font-size: 0.75rem; color: var(--text-muted); margin-top: 2px; }

    /* Body */
    .dialog-body { padding: 16px 20px 4px; }

    .form-row {
      display: grid;
      grid-template-columns: 118px 1fr;
      align-items: center;
      gap: 6px;
      margin-bottom: 8px;
    }
    .form-row label {
      font-size: 0.82rem;
      color: var(--text-muted);
      text-align: right;
      padding-right: 6px;
      white-space: nowrap;
    }
    .form-row input,
    .form-row select {
      padding: 5px 8px;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 2px;
      color: var(--text);
      font-size: 0.82rem;
      width: 100%;
      outline: none;
    }
    .form-row input:focus,
    .form-row select:focus { border-color: var(--accent); }

    .form-row .input-row {
      display: flex;
      gap: 6px;
      align-items: center;
    }
    .form-row .input-row input { flex: 1; }
    .port-input { width: 70px !important; flex: none !important; }

    .separator {
      border: none;
      border-top: 1px solid var(--border);
      margin: 10px 0 10px;
    }

    .show-pw-label {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 0.75rem;
      color: var(--text-muted);
      white-space: nowrap;
      cursor: pointer;
    }
    .show-pw-label input[type="checkbox"] { cursor: pointer; accent-color: var(--accent); }

    /* Options accordion */
    .options-toggle {
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: 0.8rem;
      color: var(--text-muted);
      cursor: pointer;
      padding: 4px 0 4px 4px;
      border: none;
      background: none;
      color: var(--text-muted);
      user-select: none;
    }
    .options-toggle:hover { color: var(--text); }
    .options-toggle .arrow { display: inline-block; transition: transform .15s; font-size: 0.65rem; }
    .options-toggle.open .arrow { transform: rotate(90deg); }
    .options-body { display: none; padding: 6px 0 0 20px; }
    .options-body.open { display: block; }
    .options-body .form-row { margin-bottom: 6px; }

    /* Error box */
    .error-box {
      display: none;
      background: rgba(248,113,113,0.08);
      border: 1px solid rgba(248,113,113,0.35);
      border-radius: 3px;
      padding: 7px 10px;
      margin: 8px 0 4px;
      font-size: 0.78rem;
      color: var(--error);
      line-height: 1.4;
    }
    .error-box.show { display: flex; gap: 6px; align-items: flex-start; }
    .error-box .err-icon { flex-shrink: 0; font-size: 0.95rem; }

    /* Footer */
    .dialog-footer {
      padding: 12px 20px;
      border-top: 1px solid var(--border);
      background: var(--surface2);
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 8px;
    }
    .btn {
      padding: 5px 18px;
      border-radius: 2px;
      font-size: 0.82rem;
      cursor: pointer;
      border: 1px solid var(--border);
      background: var(--surface);
      color: var(--text);
      transition: background .12s;
      min-width: 75px;
    }
    .btn:hover { background: var(--surface2); }
    .btn.primary {
      background: var(--accent);
      border-color: var(--accent);
      color: #fff;
    }
    .btn.primary:hover { background: var(--accent-hover); border-color: var(--accent-hover); }
    .btn:disabled { opacity: 0.55; cursor: not-allowed; }

    /* Spinner inside button */
    .spinner {
      display: inline-block;
      width: 11px; height: 11px;
      border: 2px solid rgba(255,255,255,0.3);
      border-top-color: #fff;
      border-radius: 50%;
      animation: spin .6s linear infinite;
      vertical-align: middle;
      margin-right: 4px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* Footnote */
    .footnote {
      margin-top: 14px;
      font-size: 0.73rem;
      color: var(--text-muted);
      text-align: center;
    }

    /* Connection history */
    .history-section {
      width: 460px;
      margin-top: 12px;
    }
    .history-header {
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--text-muted);
      margin-bottom: 6px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .history-list {
      max-height: 180px;
      overflow-y: auto;
    }
    .history-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 10px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 4px;
      margin-bottom: 4px;
      cursor: pointer;
      transition: border-color .12s;
      font-size: 0.8rem;
    }
    .history-item:hover { border-color: var(--accent); }
    .history-item .hi-label { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .history-item .hi-date { font-size: 0.7rem; color: var(--text-muted); white-space: nowrap; }
    .history-item .hi-del {
      background: none; border: none; color: var(--text-muted); cursor: pointer;
      font-size: 0.85rem; padding: 0 2px; opacity: 0.5;
    }
    .history-item .hi-del:hover { opacity: 1; color: var(--error); }
  </style>
</head>
<body data-theme="dark">

<div class="dialog" id="dialog">

  <!-- Title bar -->
  <div class="dialog-titlebar">
    <span class="app-icon">🗄</span>
    <span class="app-name">SchemaViz</span>
    <button class="theme-btn" onclick="toggleTheme()" title="Toggle light/dark mode">◑</button>
  </div>

  <!-- Section header -->
  <div class="dialog-section-header">
    <span class="db-icon" id="dbIcon">🐘</span>
    <div>
      <h2>サーバーに接続</h2>
      <p>Connect to Database Server</p>
    </div>
  </div>

  <!-- Form body -->
  <div class="dialog-body">

    <div class="form-row">
      <label for="dbType">サーバーの種類:</label>
      <select id="dbType" onchange="onDbTypeChange()">
        <option value="postgresql">PostgreSQL</option>
        <option value="mysql">MySQL</option>
        <option value="sqlserver">SQL Server</option>
        <option value="sqlserver-express">SQL Server Express</option>
        <option value="sqlite">SQLite (ファイル)</option>
      </select>
    </div>

    <!-- Host/Port row (hidden for SQLite) -->
    <div class="form-row" id="hostRow">
      <label for="host">サーバー名:</label>
      <div class="input-row">
        <input type="text" id="host" value="localhost" autocomplete="off" spellcheck="false">
        <input type="number" id="port" class="port-input" value="5432" min="1" max="65535" title="Port">
      </div>
    </div>

    <!-- Instance name row (SQL Server Express) -->
    <div class="form-row" id="instanceRow" style="display:none">
      <label for="instanceName">インスタンス名:</label>
      <input type="text" id="instanceName" value="SQLEXPRESS" autocomplete="off" spellcheck="false" placeholder="SQLEXPRESS">
    </div>

    <!-- SQLite file row (visible only for SQLite) -->
    <div class="form-row" id="fileRow" style="display:none">
      <label for="filename">データベースファイル:</label>
      <input type="text" id="filename" placeholder="./myapp.db" autocomplete="off" spellcheck="false">
    </div>

    <hr class="separator">

    <div class="form-row" id="authRow">
      <label for="authType">認証:</label>
      <select id="authType" onchange="onAuthTypeChange()">
        <option value="sql">データベース認証</option>
        <option value="windows">Windows認証</option>
      </select>
    </div>

    <!-- Domain row (Windows Auth only) -->
    <div class="form-row" id="domainRow" style="display:none">
      <label for="domain">ドメイン:</label>
      <input type="text" id="domain" placeholder="(省略可)" autocomplete="off" spellcheck="false">
    </div>

    <!-- Credentials (hidden for SQLite) -->
    <div id="credSection">
      <div class="form-row">
        <label for="user">ログイン:</label>
        <input type="text" id="user" autocomplete="username" spellcheck="false">
      </div>
      <div class="form-row">
        <label for="password">パスワード:</label>
        <div class="input-row">
          <input type="password" id="password" autocomplete="current-password">
          <label class="show-pw-label" title="Show password">
            <input type="checkbox" id="showPw" onchange="togglePw()"> 表示
          </label>
        </div>
      </div>
    </div>

    <div class="form-row" id="dbRow">
      <label for="database">データベース:</label>
      <div class="input-row">
        <input type="text" id="database" placeholder="(省略可 — 後で選択可)" autocomplete="off" spellcheck="false" style="flex:1">
        <button class="btn" type="button" id="dbListBtn" style="display:none; padding:5px 8px; font-size:0.75rem" onclick="loadDatabases()">一覧</button>
      </div>
    </div>
    <div class="form-row" id="dbSelectRow" style="display:none">
      <label>DB選択:</label>
      <select id="dbSelect" onchange="document.getElementById('database').value=this.value" style="width:100%">
        <option value="">-- データベースを選択 --</option>
      </select>
    </div>

    <hr class="separator">

    <!-- Options accordion -->
    <button class="options-toggle" id="optionsToggle" type="button" onclick="toggleOptions()">
      <span class="arrow">▶</span> オプション
    </button>
    <div class="options-body" id="optionsBody">
      <div class="form-row">
        <label for="sslMode">SSL:</label>
        <select id="sslMode">
          <option value="">なし (None)</option>
          <option value="require">必須 (Require)</option>
          <option value="prefer">優先 (Prefer)</option>
        </select>
      </div>
      <div class="form-row">
        <label for="timeout">接続タイムアウト:</label>
        <input type="number" id="timeout" value="30" min="1" max="120" style="width:70px">
      </div>
    </div>

    <!-- Error message -->
    <div class="error-box" id="errorBox">
      <span class="err-icon">⚠</span>
      <span id="errorMsg"></span>
    </div>

  </div><!-- /dialog-body -->

  <!-- Footer buttons -->
  <div class="dialog-footer">
    <button class="btn" type="button" onclick="resetForm()">リセット</button>
    <button class="btn primary" type="button" id="connectBtn" onclick="doConnect()">接続</button>
  </div>

</div><!-- /dialog -->

<div class="history-section" id="historySection" style="display:none">
  <div class="history-header">📋 接続履歴 (Connection History)</div>
  <div class="history-list" id="historyList"></div>
</div>

<p class="footnote">SchemaViz — Database Schema Visualizer</p>

<script>
  const DEFAULT_PORTS = { postgresql: 5432, mysql: 3306, sqlserver: 1433, 'sqlserver-express': 1433 };
  const DB_ICONS      = { postgresql: '🐘', mysql: '🐬', sqlserver: '🪟', 'sqlserver-express': '🪟', sqlite: '📁' };

  function onDbTypeChange() {
    const type = document.getElementById('dbType').value;
    const isSqlite = type === 'sqlite';
    const isSqlServerExpress = type === 'sqlserver-express';
    const isSqlServer = type === 'sqlserver' || isSqlServerExpress;

    document.getElementById('dbIcon').textContent    = DB_ICONS[type] || '🗄';
    document.getElementById('hostRow').style.display = isSqlite ? 'none' : 'grid';
    document.getElementById('fileRow').style.display = isSqlite ? 'grid' : 'none';
    document.getElementById('credSection').style.display = isSqlite ? 'none' : 'block';
    document.getElementById('dbRow').style.display   = isSqlite ? 'none' : 'grid';
    document.getElementById('instanceRow').style.display = isSqlServerExpress ? 'grid' : 'none';
    document.getElementById('dbListBtn').style.display = isSqlite ? 'none' : 'inline-flex';
    document.getElementById('dbSelectRow').style.display = 'none';

    // Show Windows Auth option only for SQL Server
    const authType = document.getElementById('authType');
    const authRow = document.getElementById('authRow');
    const winOpt = authType.querySelector('option[value="windows"]');
    if (isSqlServer) {
      if (!winOpt) {
        const opt = document.createElement('option');
        opt.value = 'windows';
        opt.textContent = 'Windows認証';
        authType.appendChild(opt);
      }
    } else {
      if (winOpt) { winOpt.remove(); authType.value = 'sql'; }
    }
    authRow.style.display = isSqlite ? 'none' : 'grid';
    onAuthTypeChange();

    // Hide port for Express (uses named instance)
    if (isSqlServerExpress) {
      document.getElementById('port').style.display = 'none';
    } else {
      document.getElementById('port').style.display = '';
    }

    if (!isSqlite && DEFAULT_PORTS[type]) {
      document.getElementById('port').value = DEFAULT_PORTS[type];
    }
  }

  function onAuthTypeChange() {
    const auth = document.getElementById('authType').value;
    const isWin = auth === 'windows';
    document.getElementById('domainRow').style.display = isWin ? 'grid' : 'none';
  }

  function togglePw() {
    const pw = document.getElementById('password');
    pw.type = document.getElementById('showPw').checked ? 'text' : 'password';
  }

  function toggleOptions() {
    const btn  = document.getElementById('optionsToggle');
    const body = document.getElementById('optionsBody');
    btn.classList.toggle('open');
    body.classList.toggle('open');
  }

  function showError(msg) {
    const box = document.getElementById('errorBox');
    document.getElementById('errorMsg').textContent = msg;
    box.classList.add('show');
  }
  function hideError() {
    document.getElementById('errorBox').classList.remove('show');
  }

  function resetForm() {
    document.getElementById('host').value     = 'localhost';
    document.getElementById('port').value     = DEFAULT_PORTS[document.getElementById('dbType').value] || 5432;
    document.getElementById('user').value     = '';
    document.getElementById('password').value = '';
    document.getElementById('database').value = '';
    document.getElementById('filename').value = '';
    document.getElementById('instanceName').value = 'SQLEXPRESS';
    document.getElementById('domain').value   = '';
    document.getElementById('dbSelectRow').style.display = 'none';
    hideError();
  }

  function buildConfig() {
    let type = document.getElementById('dbType').value;
    const isSqlServerExpress = type === 'sqlserver-express';
    if (isSqlServerExpress) type = 'sqlserver';
    const config = { type };

    if (document.getElementById('dbType').value === 'sqlite') {
      const fn = document.getElementById('filename').value.trim();
      if (!fn) { showError('データベースファイルパスを入力してください。'); return null; }
      config.filename = fn;
    } else {
      const host = document.getElementById('host').value.trim();
      if (!host) { showError('サーバー名を入力してください。'); return null; }
      config.host = host;

      if (isSqlServerExpress) {
        const inst = document.getElementById('instanceName').value.trim();
        if (inst) config.instanceName = inst;
      } else {
        const port = parseInt(document.getElementById('port').value, 10);
        config.port = port;
      }

      const authType = document.getElementById('authType').value;
      if (authType === 'windows') {
        config.authType = 'windows';
        const domain = document.getElementById('domain').value.trim();
        if (domain) config.domain = domain;
      }

      const user = document.getElementById('user').value.trim();
      const pass = document.getElementById('password').value;
      if (user) config.user = user;
      if (pass) config.password = pass;
      const db = document.getElementById('database').value.trim();
      if (db)   config.database = db;
      const ssl = document.getElementById('sslMode').value;
      if (ssl)  config.ssl = ssl;
    }

    const tout = parseInt(document.getElementById('timeout').value, 10);
    if (!isNaN(tout)) config.connectionTimeout = tout * 1000;
    return config;
  }

  async function loadDatabases() {
    hideError();
    const config = buildConfig();
    if (!config) return;

    const btn = document.getElementById('dbListBtn');
    btn.disabled = true;
    btn.textContent = '取得中…';

    try {
      const res = await fetch('/api/databases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (data.error) { showError(data.error); btn.disabled = false; btn.textContent = '一覧'; return; }

      const sel = document.getElementById('dbSelect');
      sel.innerHTML = '<option value="">-- データベースを選択 --</option>';
      (data.databases || []).forEach(function(name) {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        sel.appendChild(opt);
      });
      document.getElementById('dbSelectRow').style.display = 'grid';
    } catch (err) {
      showError('DB一覧の取得に失敗: ' + err.message);
    }
    btn.disabled = false;
    btn.textContent = '一覧';
  }

  async function doConnect() {
    hideError();
    const btn  = document.getElementById('connectBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>接続中…';

    const config = buildConfig();
    if (!config) { resetBtn(); return; }

    try {
      const res  = await fetch('/api/connect', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body:    JSON.stringify(config),
      });
      const data = await res.json();
      if (data.ok) {
        // Show table selection page instead of going directly to diagram
        window.location.href = '/select-tables';
      } else {
        showError(data.error || '接続に失敗しました。');
        resetBtn();
      }
    } catch (err) {
      showError('ネットワークエラー: ' + err.message);
      resetBtn();
    }

    function resetBtn() {
      btn.disabled = false;
      btn.innerHTML = '接続';
    }
  }

  function toggleTheme() {
    const body = document.body;
    body.dataset.theme = body.dataset.theme === 'dark' ? 'light' : 'dark';
  }

  // ─── Connection History ───
  async function loadHistory() {
    try {
      const data = await fetch('/api/connections').then(function(r) { return r.json(); });
      const conns = data.connections || [];
      if (conns.length === 0) { document.getElementById('historySection').style.display = 'none'; return; }
      document.getElementById('historySection').style.display = '';
      var list = document.getElementById('historyList');
      list.innerHTML = '';
      conns.forEach(function(c, i) {
        var item = document.createElement('div');
        item.className = 'history-item';
        var dateStr = new Date(c.lastUsed).toLocaleDateString();
        item.innerHTML = '<span class="hi-label">' + c.label + '</span>' +
          '<span class="hi-date">' + dateStr + '</span>' +
          '<button class="hi-del" title="削除" data-idx="' + i + '">✕</button>';
        item.addEventListener('click', function(e) {
          if (e.target.classList.contains('hi-del')) return;
          applyConnection(c.config);
        });
        item.querySelector('.hi-del').addEventListener('click', function(e) {
          e.stopPropagation();
          deleteHistory(parseInt(this.dataset.idx, 10));
        });
        list.appendChild(item);
      });
    } catch (e) {
      // ignore
    }
  }

  function applyConnection(config) {
    // Set DB type
    var dbType = config.type;
    if (config.instanceName) dbType = 'sqlserver-express';
    document.getElementById('dbType').value = dbType;
    onDbTypeChange();

    if (config.type === 'sqlite') {
      document.getElementById('filename').value = config.filename || '';
    } else {
      document.getElementById('host').value = config.host || 'localhost';
      if (config.port) document.getElementById('port').value = config.port;
      if (config.instanceName) document.getElementById('instanceName').value = config.instanceName;
      document.getElementById('user').value = config.user || '';
      document.getElementById('database').value = config.database || '';
      if (config.authType === 'windows') {
        document.getElementById('authType').value = 'windows';
        onAuthTypeChange();
        if (config.domain) document.getElementById('domain').value = config.domain;
      }
      if (config.ssl) document.getElementById('sslMode').value = config.ssl;
    }
    // Focus password field since it's not saved
    if (config.type !== 'sqlite') {
      document.getElementById('password').focus();
    }
    hideError();
  }

  async function deleteHistory(idx) {
    await fetch('/api/connections/' + idx, { method: 'DELETE' });
    loadHistory();
  }

  // Load history on page load
  loadHistory();

  // Allow Enter key to connect
  document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !document.getElementById('connectBtn').disabled) doConnect();
  });
</script>
</body>
</html>`;
}

// ─── Table Selection Page ─────────────────────────────────────────────────────

export function buildTableSelectHtml(tables: string[], database: string): string {
  const tableListJson = JSON.stringify(tables);
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SchemaViz — テーブル選択</title>
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
      --ok: #34d399;
    }
    [data-theme="light"] {
      --bg: #e8ecf0;
      --surface: #f5f7f9;
      --surface2: #eaedf0;
      --border: #c8cdd3;
      --text: #0f172a;
      --text-muted: #64748b;
      --accent: #4f46e5;
      --accent-hover: #6366f1;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Tahoma, sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    .dialog {
      width: 520px;
      max-height: 80vh;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 4px;
      box-shadow: 0 8px 40px rgba(0,0,0,0.45);
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .dialog-titlebar {
      background: #2b3a6b;
      padding: 10px 16px;
      display: flex;
      align-items: center;
      gap: 10px;
      user-select: none;
      flex-shrink: 0;
    }
    .dialog-titlebar .app-icon { font-size: 1.3rem; }
    .dialog-titlebar .app-name { font-size: 0.95rem; font-weight: 600; color: #fff; }
    .dialog-titlebar .theme-btn {
      margin-left: auto;
      background: none; border: none; color: rgba(255,255,255,0.65);
      cursor: pointer; font-size: 1rem; padding: 2px 4px; border-radius: 3px;
    }
    .dialog-titlebar .theme-btn:hover { color: #fff; background: rgba(255,255,255,0.1); }

    .dialog-section-header {
      background: var(--surface2);
      border-bottom: 1px solid var(--border);
      padding: 10px 20px 10px 16px;
      display: flex;
      align-items: center;
      gap: 10px;
      flex-shrink: 0;
    }
    .dialog-section-header .db-icon { font-size: 1.6rem; }
    .dialog-section-header h2 { font-size: 0.9rem; font-weight: 600; }
    .dialog-section-header p { font-size: 0.75rem; color: var(--text-muted); margin-top: 2px; }

    .toolbar {
      padding: 10px 16px;
      display: flex;
      gap: 8px;
      align-items: center;
      border-bottom: 1px solid var(--border);
      flex-shrink: 0;
    }
    .search-input {
      flex: 1;
      padding: 5px 8px;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 2px;
      color: var(--text);
      font-size: 0.82rem;
      outline: none;
    }
    .search-input:focus { border-color: var(--accent); }
    .link-btn {
      background: none; border: none; color: var(--accent); cursor: pointer;
      font-size: 0.78rem; padding: 2px 4px; white-space: nowrap;
    }
    .link-btn:hover { text-decoration: underline; }
    .count-badge {
      font-size: 0.75rem; color: var(--text-muted); white-space: nowrap;
    }

    .table-list {
      flex: 1;
      overflow-y: auto;
      padding: 8px 16px;
      min-height: 120px;
      max-height: 45vh;
    }
    .table-check {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 5px 8px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.85rem;
      transition: background .1s;
    }
    .table-check:hover { background: var(--surface2); }
    .table-check input[type="checkbox"] { accent-color: var(--accent); cursor: pointer; }
    .table-check.hidden { display: none; }

    .dialog-footer {
      padding: 12px 20px;
      border-top: 1px solid var(--border);
      background: var(--surface2);
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 8px;
      flex-shrink: 0;
    }
    .btn {
      padding: 5px 18px; border-radius: 2px; font-size: 0.82rem;
      cursor: pointer; border: 1px solid var(--border); background: var(--surface);
      color: var(--text); transition: background .12s; min-width: 75px;
    }
    .btn:hover { background: var(--surface2); }
    .btn.primary { background: var(--accent); border-color: var(--accent); color: #fff; }
    .btn.primary:hover { background: var(--accent-hover); border-color: var(--accent-hover); }
    .btn:disabled { opacity: 0.55; cursor: not-allowed; }
    .spinner {
      display: inline-block; width: 11px; height: 11px;
      border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff;
      border-radius: 50%; animation: spin .6s linear infinite;
      vertical-align: middle; margin-right: 4px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .footnote { margin-top: 14px; font-size: 0.73rem; color: var(--text-muted); text-align: center; }
  </style>
</head>
<body data-theme="dark">

<div class="dialog">
  <div class="dialog-titlebar">
    <span class="app-icon">🗄</span>
    <span class="app-name">SchemaViz — テーブル選択</span>
    <button class="theme-btn" onclick="document.body.dataset.theme = document.body.dataset.theme === 'dark' ? 'light' : 'dark'" title="Toggle theme">◑</button>
  </div>

  <div class="dialog-section-header">
    <span class="db-icon">▦</span>
    <div>
      <h2>${database} — ER図に表示するテーブルを選択</h2>
      <p>Select tables to include in the ER diagram</p>
    </div>
  </div>

  <div class="toolbar">
    <input class="search-input" id="searchInput" placeholder="テーブル名で検索..." oninput="filterTables()">
    <button class="link-btn" onclick="selectAll()">全選択</button>
    <button class="link-btn" onclick="deselectAll()">全解除</button>
    <span class="count-badge" id="countBadge">0 / ${tables.length}</span>
  </div>

  <div class="table-list" id="tableList"></div>

  <div class="dialog-footer">
    <button class="btn" onclick="window.location.href='/'">戻る</button>
    <button class="btn primary" id="showBtn" onclick="showDiagram()">ER図を表示</button>
  </div>
</div>

<p class="footnote">SchemaViz — Database Schema Visualizer</p>

<script>
  const ALL_TABLES = ${tableListJson};

  function buildList() {
    const list = document.getElementById('tableList');
    list.innerHTML = '';
    ALL_TABLES.forEach(function(name) {
      const label = document.createElement('label');
      label.className = 'table-check';
      label.dataset.name = name.toLowerCase();
      label.innerHTML = '<input type="checkbox" value="' + name + '" checked onchange="updateCount()"> ' + name;
      list.appendChild(label);
    });
    updateCount();
  }

  function filterTables() {
    const q = document.getElementById('searchInput').value.toLowerCase();
    document.querySelectorAll('.table-check').forEach(function(el) {
      el.classList.toggle('hidden', !el.dataset.name.includes(q));
    });
  }

  function selectAll() {
    document.querySelectorAll('.table-check:not(.hidden) input').forEach(function(cb) { cb.checked = true; });
    updateCount();
  }

  function deselectAll() {
    document.querySelectorAll('.table-check:not(.hidden) input').forEach(function(cb) { cb.checked = false; });
    updateCount();
  }

  function updateCount() {
    const checked = document.querySelectorAll('.table-check input:checked').length;
    document.getElementById('countBadge').textContent = checked + ' / ' + ALL_TABLES.length;
    document.getElementById('showBtn').disabled = checked === 0;
  }

  async function showDiagram() {
    const btn = document.getElementById('showBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>読み込み中…';

    const selected = [];
    document.querySelectorAll('.table-check input:checked').forEach(function(cb) {
      selected.push(cb.value);
    });

    try {
      const res = await fetch('/api/extract-tables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ tables: selected }),
      });
      const data = await res.json();
      if (data.ok) {
        window.location.href = '/diagram';
      } else {
        alert(data.error || 'エラーが発生しました。');
        btn.disabled = false;
        btn.innerHTML = 'ER図を表示';
      }
    } catch (err) {
      alert('エラー: ' + err.message);
      btn.disabled = false;
      btn.innerHTML = 'ER図を表示';
    }
  }

  buildList();
</script>
</body>
</html>`;
}

// ─── PlantUML server-side encoding ────────────────────────────────────────────

function plantumlEncode(text: string): string {
  const deflated = zlib.deflateRawSync(Buffer.from(text, 'utf-8'), { level: 9 });
  return encode64(deflated);
}

function encode64(data: Buffer): string {
  let r = '';
  for (let i = 0; i < data.length; i += 3) {
    const b1 = data[i];
    const b2 = i + 1 < data.length ? data[i + 1] : 0;
    const b3 = i + 2 < data.length ? data[i + 2] : 0;
    r += append3bytes(b1, b2, b3);
  }
  return r;
}

function append3bytes(b1: number, b2: number, b3: number): string {
  const c1 = b1 >> 2;
  const c2 = ((b1 & 0x3) << 4) | (b2 >> 4);
  const c3 = ((b2 & 0xF) << 2) | (b3 >> 6);
  const c4 = b3 & 0x3F;
  return encode6bit(c1) + encode6bit(c2) + encode6bit(c3) + encode6bit(c4);
}

function encode6bit(b: number): string {
  if (b < 10) return String.fromCharCode(48 + b);
  b -= 10;
  if (b < 26) return String.fromCharCode(65 + b);
  b -= 26;
  if (b < 26) return String.fromCharCode(97 + b);
  b -= 26;
  if (b === 0) return '-';
  if (b === 1) return '_';
  return '?';
}

function getPlantUMLUrl(pumlCode: string): string {
  return 'https://www.plantuml.com/plantuml/svg/' + plantumlEncode(pumlCode);
}

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
        <pre class="mermaid">${mermaidCode}</pre>
      </div>
      <div id="plantumlDiagram">
        <img id="plantumlImg" src="${plantumlUrl}" alt="PlantUML ER Diagram"
             style="max-width:none"
             onload="this.dataset.loaded='1';document.getElementById('plantumlFallback').style.display='none'"
             onerror="this.style.display='none';document.getElementById('plantumlFallback').style.display='block'">
        <div id="plantumlFallback" style="display:none;padding:16px;max-width:700px">
          <p style="color:var(--text-muted);font-size:0.85rem;margin-bottom:10px">PlantUML サーバーに接続できません。下記コードをコピーして <a href="https://www.plantuml.com/plantuml/uml/" target="_blank" style="color:var(--accent)">plantuml.com</a> で描画してください。</p>
          <pre style="background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:12px;font-size:0.78rem;overflow:auto;max-height:60vh;white-space:pre;font-family:monospace;color:var(--text)">${plantumlCode.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</pre>
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
  const SCHEMA = ${schemaJson};
  const MERMAID_CODE = \`${mermaidCode.replace(/`/g, '\\`')}\`;
  const PLANTUML_CODE = \`${plantumlCode.replace(/`/g, '\\`')}\`;
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
    el('pass').value = '';
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

// ─── Connection History ───────────────────────────────────────────────────────

interface ConnectionEntry {
  label: string;
  config: any;
  lastUsed: string;
}

function getConnectionsFilePath(): string {
  const dir = path.join(process.cwd(), '.schemaviz');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, 'connections.json');
}

function loadConnections(): ConnectionEntry[] {
  const fp = getConnectionsFilePath();
  if (!fs.existsSync(fp)) return [];
  try {
    return JSON.parse(fs.readFileSync(fp, 'utf-8'));
  } catch {
    return [];
  }
}

function saveConnection(config: any): void {
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

  // Remove password from stored config for security
  const safeConfig = { ...config };
  delete safeConfig.password;
  delete safeConfig.connectionTimeout;

  // Check for duplicate by label
  const idx = conns.findIndex(c => c.label === label);
  const entry: ConnectionEntry = { label, config: safeConfig, lastUsed: new Date().toISOString() };
  if (idx >= 0) {
    conns[idx] = entry;
  } else {
    conns.unshift(entry);
  }
  // Keep max 20 entries
  const trimmed = conns.slice(0, 20);
  fs.writeFileSync(getConnectionsFilePath(), JSON.stringify(trimmed, null, 2), 'utf-8');
}

function deleteConnection(index: number): boolean {
  const conns = loadConnections();
  if (index < 0 || index >= conns.length) return false;
  conns.splice(index, 1);
  fs.writeFileSync(getConnectionsFilePath(), JSON.stringify(conns, null, 2), 'utf-8');
  return true;
}

// ─── HTTP Server ──────────────────────────────────────────────────────────────

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

export async function startServer(options: ServeOptions): Promise<void> {
  const SNAP_BASE_DIR = process.cwd();

  const loadSchemaFromFile = (): Schema => {
    return JSON.parse(fs.readFileSync(options.schema!, 'utf-8'));
  };

  // Pre-load schema from file if provided
  let schema: Schema | null = options.schema ? loadSchemaFromFile() : null;
  // Keep adapter alive for table selection flow
  let currentAdapter: any = null;
  let currentConfig: any = null;
  let availableTableNames: string[] = [];

  const server = http.createServer((req, res) => {
    const url = req.url ?? '/';

    // ── GET /api/connections — list saved connections ──────────────────────
    if (url === '/api/connections' && req.method === 'GET') {
      try {
        const conns = loadConnections();
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ connections: conns }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
      }
      return;
    }

    // ── DELETE /api/connections/:index — delete a saved connection ───────────
    if (url.startsWith('/api/connections/') && req.method === 'DELETE') {
      const idx = parseInt(url.slice('/api/connections/'.length), 10);
      try {
        const ok = deleteConnection(idx);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
      }
      return;
    }

    // ── POST /api/databases — list available databases ───────────────────────
    if (url === '/api/databases' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const config = JSON.parse(body);
          const adapter = createAdapter(config);
          await adapter.connect();
          const databases = await adapter.getDatabases();
          await adapter.disconnect();
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ ok: true, databases }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
        }
      });
      return;
    }

    // ── POST /api/connect — connect to DB, keep adapter for table selection ──
    if (url === '/api/connect' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const config = JSON.parse(body);
          const adapter = createAdapter(config);
          await adapter.connect();
          // Get table names for selection
          const tableNames = await adapter.getTableNames();
          // Store adapter and table names for later use
          if (currentAdapter) {
            try { await currentAdapter.disconnect(); } catch {}
          }
          currentAdapter = adapter;
          currentConfig = config;
          availableTableNames = tableNames;
          // Save to connection history
          try { saveConnection(config); } catch {}
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ ok: true, database: config.database || '(default)', tables: tableNames.length }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
        }
      });
      return;
    }

    // ── POST /api/extract-tables — extract schema for selected tables ────────
    if (url === '/api/extract-tables' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const { tables: selectedTables } = JSON.parse(body);
          if (!currentAdapter) {
            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: 'Not connected. Please connect first.' }));
            return;
          }
          schema = await currentAdapter.extractSchemaForTables(selectedTables);
          await currentAdapter.disconnect();
          currentAdapter = null;
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ ok: true, database: schema.database, tables: schema.tables.length }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
        }
      });
      return;
    }

    // ── GET /api/disconnect — clear current schema ───────────────────────────
    if (url === '/api/disconnect') {
      schema = null;
      if (currentAdapter) {
        currentAdapter.disconnect().catch(() => {});
        currentAdapter = null;
      }
      currentConfig = null;
      availableTableNames = [];
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    // ── GET /api/schema ──────────────────────────────────────────────────────
    if (url === '/api/schema') {
      if (!schema) {
        res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'No schema loaded' }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(schema));
      return;
    }

    // ── GET /api/reload ──────────────────────────────────────────────────────
    if (url === '/api/reload') {
      if (!options.schema) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'No schema file configured' }));
        return;
      }
      try {
        schema = loadSchemaFromFile();
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: true }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
      }
      return;
    }

    // ── POST /api/validate ──────────────────────────────────────────────────
    if (url === '/api/validate' && req.method === 'POST') {
      if (!schema) {
        res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'No schema loaded' }));
        return;
      }
      try {
        const result = validateSchema(schema);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
      }
      return;
    }

    // ── POST /api/generate ──────────────────────────────────────────────────
    if (url === '/api/generate' && req.method === 'POST') {
      if (!schema) {
        res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'No schema loaded' }));
        return;
      }
      const currentSchema = schema;
      readBody(req).then(body => {
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
      return;
    }

    // ── POST /api/snapshots ─────────────────────────────────────────────────
    if (url === '/api/snapshots' && req.method === 'POST') {
      if (!schema) {
        res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'No schema loaded' }));
        return;
      }
      const currentSchema = schema;
      readBody(req).then(body => {
        try {
          const { tag } = JSON.parse(body || '{}');
          const snapshot = saveSnapshotFromData(SNAP_BASE_DIR, currentSchema, tag || new Date().toISOString().slice(0, 10));
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ id: snapshot.id, tag: snapshot.tag, savedAt: snapshot.savedAt }));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
        }
      });
      return;
    }

    // ── GET /api/snapshots ──────────────────────────────────────────────────
    if (url === '/api/snapshots' && req.method === 'GET') {
      try {
        const index = loadIndex(SNAP_BASE_DIR);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ snapshots: index.snapshots }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
      }
      return;
    }

    // ── GET /api/snapshots/:id/tables — list table names in a snapshot ──────
    if (url.match(/^\/api\/snapshots\/[^/]+\/tables$/) && req.method === 'GET') {
      const ref = url.slice('/api/snapshots/'.length, url.length - '/tables'.length);
      try {
        const snap = loadSnapshot(SNAP_BASE_DIR, ref);
        if (!snap) {
          res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'Snapshot not found: ' + ref }));
          return;
        }
        const tables = snap.schema.tables.map((t: any) => t.name);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: true, tables }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
      }
      return;
    }

    // ── DELETE /api/snapshots/:id ───────────────────────────────────────────
    if (url.startsWith('/api/snapshots/') && req.method === 'DELETE') {
      const ref = url.slice('/api/snapshots/'.length);
      try {
        const ok = deleteSnapshot(SNAP_BASE_DIR, ref);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
      }
      return;
    }

    // ── POST /api/diff ──────────────────────────────────────────────────────
    if (url === '/api/diff' && req.method === 'POST') {
      if (!schema) {
        res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'No schema loaded' }));
        return;
      }
      const currentSchema = schema;
      readBody(req).then(body => {
        try {
          const { from, to, tables: filterTables } = JSON.parse(body);
          const resolveRef = (ref: string): Schema | null => {
            if (ref === 'current') return currentSchema;
            const snap = loadSnapshot(SNAP_BASE_DIR, ref);
            return snap ? snap.schema : null;
          };
          let s1 = resolveRef(from);
          let s2 = resolveRef(to);
          if (!s1) { res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify({ error: `Snapshot not found: ${from}` })); return; }
          if (!s2) { res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify({ error: `Snapshot not found: ${to}` })); return; }
          // Filter schemas to selected tables if specified
          if (filterTables && Array.isArray(filterTables) && filterTables.length > 0) {
            const tableSet = new Set(filterTables as string[]);
            s1 = { ...s1, tables: s1.tables.filter(t => tableSet.has(t.name)) };
            s2 = { ...s2, tables: s2.tables.filter(t => tableSet.has(t.name)) };
          }
          const diffResult = computeDiff(s1, s2);
          const migration = generateMigrationSQL(s1.database, diffResult);
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ diff: diffResult, migration }));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
        }
      });
      return;
    }

    // ── POST /api/fetch-schema — connect to a DB and return schema/table list ─
    if (url === '/api/fetch-schema' && req.method === 'POST') {
      readBody(req).then(async body => {
        try {
          const { config, tables: selectedTables } = JSON.parse(body);
          const adapter = createAdapter(config);
          await adapter.connect();
          let s: Schema;
          if (selectedTables && selectedTables.length > 0) {
            s = await adapter.extractSchemaForTables(selectedTables);
          } else {
            s = await adapter.extractSchema();
          }
          await adapter.disconnect();
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ ok: true, schema: s }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
        }
      });
      return;
    }

    // ── POST /api/fetch-tables — connect and return table name list ───────────
    if (url === '/api/fetch-tables' && req.method === 'POST') {
      readBody(req).then(async body => {
        try {
          const config = JSON.parse(body);
          const adapter = createAdapter(config);
          await adapter.connect();
          const tableNames = await adapter.getTableNames();
          await adapter.disconnect();
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ ok: true, tables: tableNames }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
        }
      });
      return;
    }

    // ── POST /api/diff-advanced — compare two schemas with table mapping ──────
    if (url === '/api/diff-advanced' && req.method === 'POST') {
      readBody(req).then(async body => {
        try {
          const params = JSON.parse(body);
          // params.left:  { source: 'current'|'snapshot'|'connection', snapshotId?, config?, tables? }
          // params.right: same
          // params.tableMapping?: [{left: 'tblA', right: 'tblB'}, ...]

          const resolveSchema = async (side: any): Promise<Schema> => {
            if (side.source === 'current') {
              if (!schema) throw new Error('No current schema loaded');
              let s = schema;
              if (side.tables && side.tables.length > 0) {
                const set = new Set(side.tables as string[]);
                s = { ...s, tables: s.tables.filter(t => set.has(t.name)) };
              }
              return s;
            } else if (side.source === 'snapshot') {
              const snap = loadSnapshot(SNAP_BASE_DIR, side.snapshotId);
              if (!snap) throw new Error('Snapshot not found: ' + side.snapshotId);
              let s = snap.schema;
              if (side.tables && side.tables.length > 0) {
                const set = new Set(side.tables as string[]);
                s = { ...s, tables: s.tables.filter(t => set.has(t.name)) };
              }
              return s;
            } else if (side.source === 'connection') {
              const adapter = createAdapter(side.config);
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

          let s1 = await resolveSchema(params.left);
          let s2 = await resolveSchema(params.right);

          // Apply table mapping: rename right-side tables to match left-side names for comparison
          if (params.tableMapping && params.tableMapping.length > 0) {
            const mapping = params.tableMapping as { left: string; right: string }[];
            // Only keep mapped tables
            const leftNames = new Set(mapping.map((m: any) => m.left));
            const rightNameMap = new Map(mapping.map((m: any) => [m.right, m.left]));
            s1 = { ...s1, tables: s1.tables.filter(t => leftNames.has(t.name)) };
            s2 = {
              ...s2,
              tables: s2.tables
                .filter(t => rightNameMap.has(t.name))
                .map(t => ({ ...t, name: rightNameMap.get(t.name)! })),
            };
          }

          const diffResult = computeDiff(s1, s2);
          const migration = generateMigrationSQL(s1.database || s2.database, diffResult);
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ diff: diffResult, migration }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
        }
      });
      return;
    }

    // ── GET /select-tables — table selection page ──────────────────────────
    if (url === '/select-tables') {
      try {
        if (availableTableNames.length > 0) {
          const dbName = currentConfig?.database || '(database)';
          const html = buildTableSelectHtml(availableTableNames, dbName);
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(html);
        } else {
          // No table list available, redirect to login
          res.writeHead(302, { Location: '/' });
          res.end();
        }
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end(`Error: ${err}`);
      }
      return;
    }

    // ── GET /diagram — ER diagram page ───────────────────────────────────────
    if (url === '/diagram') {
      try {
        if (schema) {
          const html = buildHtml(schema);
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(html);
        } else {
          res.writeHead(302, { Location: '/' });
          res.end();
        }
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end(`Error: ${err}`);
      }
      return;
    }

    // ── GET / — main page ────────────────────────────────────────────────────
    try {
      if (options.watch && options.schema) {
        schema = loadSchemaFromFile();
      }
      if (options.schema && schema) {
        // If schema loaded from file, show diagram directly (original flow)
        const html = buildHtml(schema);
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html);
      } else if (schema) {
        // If schema is from live connection, redirect to diagram
        res.writeHead(302, { Location: '/diagram' });
        res.end();
      } else {
        const html = buildLoginHtml();
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html);
      }
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
  if (options.schema) {
    console.log(`Schema: ${path.resolve(options.schema)}`);
  } else {
    console.log('No schema file specified — login page will be shown.');
  }
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
