import { describe, it, expect } from 'vitest';
import {
  buildHtml,
  buildTableSelectHtml,
  buildLoginHtml,
  escapeJsonForHtmlScript,
  escapeForInlineTemplateLiteral,
  escapeHtmlText,
  isAuthorizedRequest,
} from '../../src/core/webServer';
import { Schema } from '../../src/types';
import type { IncomingMessage } from 'http';

const schema: Schema = {
  database: 'test_db',
  generatedAt: '2026-01-01T00:00:00.000Z',
  tables: [
    {
      name: 'users',
      columns: [
        { name: 'id', type: 'INTEGER', nullable: false, isPrimaryKey: true, isForeignKey: false },
        {
          name: 'email',
          type: 'VARCHAR(255)',
          nullable: false,
          isPrimaryKey: false,
          isForeignKey: false,
        },
        {
          name: 'created_at',
          type: 'TIMESTAMP',
          nullable: false,
          isPrimaryKey: false,
          isForeignKey: false,
        },
      ],
      indexes: [{ name: 'users_pkey', columns: ['id'], isUnique: true }],
      foreignKeys: [],
    },
    {
      name: 'posts',
      columns: [
        { name: 'id', type: 'INTEGER', nullable: false, isPrimaryKey: true, isForeignKey: false },
        {
          name: 'user_id',
          type: 'INTEGER',
          nullable: false,
          isPrimaryKey: false,
          isForeignKey: true,
        },
        {
          name: 'title',
          type: 'VARCHAR(255)',
          nullable: false,
          isPrimaryKey: false,
          isForeignKey: false,
        },
      ],
      indexes: [],
      foreignKeys: [
        {
          name: 'posts_user_fk',
          columns: ['user_id'],
          referencedTable: 'users',
          referencedColumns: ['id'],
        },
      ],
    },
  ],
};

describe('buildHtml', () => {
  it('returns a valid HTML string', () => {
    const html = buildHtml(schema);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('</html>');
  });

  it('includes the database name in the title', () => {
    const html = buildHtml(schema);
    expect(html).toContain('SchemaViz — test_db');
  });

  it('includes the table count in the header', () => {
    const html = buildHtml(schema);
    expect(html).toContain('2 tables');
  });

  it('embeds schema JSON in the page', () => {
    const html = buildHtml(schema);
    expect(html).toContain('"database": "test_db"');
  });

  it('embeds raw mermaid ER diagram code (no markdown wrapper)', () => {
    const html = buildHtml(schema);
    expect(html).toContain('erDiagram');
    expect(html).toContain('users');
    expect(html).toContain('posts');
    // Must NOT wrap in markdown code fences — mermaid.js needs raw code
    const mermaidPre = html.match(/<pre class="mermaid">([\s\S]*?)<\/pre>/);
    expect(mermaidPre).not.toBeNull();
    expect(mermaidPre![1]).not.toContain('```');
  });

  it('includes mermaid.js CDN script', () => {
    const html = buildHtml(schema);
    expect(html).toContain('mermaid');
  });

  it('includes interactive controls (zoom, theme, copy, export)', () => {
    const html = buildHtml(schema);
    expect(html).toContain('toggleTheme');
    expect(html).toContain('copyDiagramCode');
    expect(html).toContain('exportSvg');
    expect(html).toContain('zoom(');
  });

  it('includes table search functionality', () => {
    const html = buildHtml(schema);
    expect(html).toContain('filterTables');
    expect(html).toContain('searchInput');
  });

  it('includes detail panel for table inspection', () => {
    const html = buildHtml(schema);
    expect(html).toContain('detailPanel');
    expect(html).toContain('showDetail');
  });

  it('includes keyboard shortcuts', () => {
    const html = buildHtml(schema);
    expect(html).toContain('keydown');
    expect(html).toContain('Escape');
  });

  it('embeds generated timestamp', () => {
    const html = buildHtml(schema);
    expect(html).toContain('2026-01-01T00:00:00.000Z');
  });

  // ── Feature Panel UI ──────────────────────────────────────────────────────
  it('includes feature panel header buttons', () => {
    const html = buildHtml(schema);
    expect(html).toContain("openPanel('validate')");
    expect(html).toContain("openPanel('generate')");
    expect(html).toContain("openPanel('snapshot')");
    expect(html).toContain("openPanel('diff')");
  });

  it('includes feature panel HTML scaffold', () => {
    const html = buildHtml(schema);
    expect(html).toContain('id="featurePanel"');
    expect(html).toContain('id="fpTitle"');
    expect(html).toContain('id="fpBody"');
    expect(html).toContain('closeFeaturePanel');
  });

  it('includes feature panel JavaScript functions', () => {
    const html = buildHtml(schema);
    expect(html).toContain('function openPanel');
    expect(html).toContain('function closeFeaturePanel');
    expect(html).toContain('function runValidate');
    expect(html).toContain('function runGenerate');
    expect(html).toContain('function renderSnapshotPanel');
    expect(html).toContain('function runDiffAdvanced');
  });

  it('includes escapeHtml utility function', () => {
    const html = buildHtml(schema);
    expect(html).toContain('function escapeHtml');
  });

  it('Escape key closes both detail panel and feature panel', () => {
    const html = buildHtml(schema);
    expect(html).toContain('closeDetail()');
    expect(html).toContain('closeFeaturePanel()');
  });
});

// ─── T2.2: HTML injection escaping ───────────────────────────────────────────

describe('HTML injection escaping (T2.2)', () => {
  const evilName = '</script><script>alert(1)</script>';
  const evilSchema: Schema = {
    database: 'evil_db',
    generatedAt: '2026-01-01T00:00:00.000Z',
    tables: [
      {
        name: evilName,
        columns: [
          { name: 'id', type: 'INTEGER', nullable: false, isPrimaryKey: true, isForeignKey: false },
        ],
        indexes: [],
        foreignKeys: [],
      },
    ],
  };

  it('buildHtml never embeds a raw injected </script> from table names', () => {
    const html = buildHtml(evilSchema);
    expect(html).not.toContain(evilName);
    // the JSON embed uses the escaped form instead
    expect(html).toContain('<\\/script>');
  });

  it('buildTableSelectHtml escapes table names in the embedded JSON', () => {
    const html = buildTableSelectHtml([evilName, 'users'], 'mydb');
    expect(html).not.toContain(evilName);
    expect(html).toContain('<\\/script>');
  });

  it('buildHtml escapes template-literal metacharacters in mermaid code', () => {
    const tricky: Schema = {
      database: 'd',
      generatedAt: '2026-01-01T00:00:00.000Z',
      tables: [
        {
          name: 'a`b${x}',
          columns: [
            {
              name: 'id',
              type: 'INTEGER',
              nullable: false,
              isPrimaryKey: true,
              isForeignKey: false,
            },
          ],
          indexes: [],
          foreignKeys: [],
        },
      ],
    };
    const html = buildHtml(tricky);
    // inside the MERMAID_CODE template literal the name must appear escaped
    expect(html).toContain('a\\`b\\${x}');
  });

  it('escape helpers produce the expected escaped forms', () => {
    expect(escapeJsonForHtmlScript('"</script>"')).toBe('"<\\/script>"');
    expect(escapeForInlineTemplateLiteral('a\\b`c${d}</script>')).toBe(
      'a\\\\b\\`c\\${d}<\\/script>',
    );
    expect(escapeHtmlText('<b>&</b>')).toBe('&lt;b&gt;&amp;&lt;/b&gt;');
  });

  it('login page escapes connection history labels', () => {
    const html = buildLoginHtml();
    expect(html).toContain('escapeHtml(c.label)');
  });
});

// ─── T2.1: access token check ────────────────────────────────────────────────

describe('isAuthorizedRequest (T2.1)', () => {
  const req = (headers: Record<string, string>) =>
    ({ headers }) as unknown as { headers: IncomingMessage['headers'] };

  it('rejects requests without any credential', () => {
    expect(isAuthorizedRequest(req({}), 'secret')).toBe(false);
  });

  it('accepts a matching Bearer token', () => {
    expect(isAuthorizedRequest(req({ authorization: 'Bearer secret' }), 'secret')).toBe(true);
  });

  it('rejects a wrong Bearer token', () => {
    expect(isAuthorizedRequest(req({ authorization: 'Bearer wrong' }), 'secret')).toBe(false);
  });

  it('accepts a matching cookie among several cookies', () => {
    expect(
      isAuthorizedRequest(req({ cookie: 'other=1; schemaviz_token=secret; x=2' }), 'secret'),
    ).toBe(true);
  });

  it('rejects a wrong cookie', () => {
    expect(isAuthorizedRequest(req({ cookie: 'schemaviz_token=wrong' }), 'secret')).toBe(false);
  });
});

// ─── T2.4: local mermaid bundle ──────────────────────────────────────────────

describe('local mermaid bundle in buildHtml (T2.4)', () => {
  it('serves mermaid from /vendor instead of the CDN', () => {
    const html = buildHtml(schema);
    expect(html).toContain('<script src="/vendor/mermaid.min.js"></script>');
    expect(html).not.toContain('cdn.jsdelivr.net');
    expect(html).not.toContain('unpkg.com');
  });
});
