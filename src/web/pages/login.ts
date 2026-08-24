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
      <div class="form-row">
        <label></label>
        <label style="display:flex;align-items:center;gap:5px;font-size:.78rem;color:var(--text-muted);cursor:pointer">
          <input type="checkbox" id="savePassword" style="accent-color:var(--accent)" disabled> パスワードは保存されません(セキュリティのため)
        </label>
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
  function escapeHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }

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
        item.innerHTML = '<span class="hi-label">' + escapeHtml(c.label) + '</span>' +
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
    // Passwords are never saved — focus the password field for re-entry
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
