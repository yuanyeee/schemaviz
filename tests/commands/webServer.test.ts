import { describe, it, expect } from 'vitest';
import { buildHtml } from '../../src/core/webServer';
import { Schema } from '../../src/types';

const schema: Schema = {
  database: 'test_db',
  generatedAt: '2026-01-01T00:00:00.000Z',
  tables: [
    {
      name: 'users',
      columns: [
        { name: 'id', type: 'INTEGER', nullable: false, isPrimaryKey: true, isForeignKey: false },
        { name: 'email', type: 'VARCHAR(255)', nullable: false, isPrimaryKey: false, isForeignKey: false },
        { name: 'created_at', type: 'TIMESTAMP', nullable: false, isPrimaryKey: false, isForeignKey: false },
      ],
      indexes: [{ name: 'users_pkey', columns: ['id'], isUnique: true }],
      foreignKeys: [],
    },
    {
      name: 'posts',
      columns: [
        { name: 'id', type: 'INTEGER', nullable: false, isPrimaryKey: true, isForeignKey: false },
        { name: 'user_id', type: 'INTEGER', nullable: false, isPrimaryKey: false, isForeignKey: true },
        { name: 'title', type: 'VARCHAR(255)', nullable: false, isPrimaryKey: false, isForeignKey: false },
      ],
      indexes: [],
      foreignKeys: [
        { name: 'posts_user_fk', columns: ['user_id'], referencedTable: 'users', referencedColumns: ['id'] },
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
    expect(html).toContain('copyMermaid');
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
    expect(html).toContain('function runDiff');
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
