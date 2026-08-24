import { escapeJsonForHtmlScript } from '../escape';

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
  const ALL_TABLES = ${escapeJsonForHtmlScript(tableListJson)};

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
