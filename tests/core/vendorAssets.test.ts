import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import { getMermaidScriptPath, getMermaidScriptSource } from '../../src/core/vendorAssets';
import { generateHtml } from '../../src/core/imageGenerator';

describe('local mermaid bundle (T2.4)', () => {
  it('resolves the installed mermaid UMD bundle', () => {
    const p = getMermaidScriptPath();
    expect(p).toMatch(/mermaid[\\/]dist[\\/]mermaid\.min\.js$/);
    expect(fs.existsSync(p)).toBe(true);
  });

  it('reads the bundle source (cached)', () => {
    const src = getMermaidScriptSource();
    expect(src.length).toBeGreaterThan(100_000);
    expect(src).toContain('mermaid');
    // cached: same reference on second call
    expect(getMermaidScriptSource()).toBe(src);
  });

  it('generateHtml references no CDN and no module script', () => {
    const html = generateHtml('erDiagram\n  users {\n    int id\n  }', '#ffffff');
    expect(html).not.toContain('cdn.jsdelivr.net');
    expect(html).not.toContain('unpkg.com');
    expect(html).not.toContain('<script');
    expect(html).toContain('<div class="mermaid">');
  });

  it('generateHtml escapes markup inside the mermaid definition', () => {
    const html = generateHtml('erDiagram</div><script>alert(1)</script>', '#fff');
    expect(html).not.toContain('</div><script>alert(1)</script>');
    expect(html).toContain('&lt;/div&gt;');
  });
});
