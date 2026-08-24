import * as fs from 'fs';

/**
 * Resolves the locally installed mermaid UMD bundle.
 * Used instead of the CDN so both the web UI and image generation work offline (T2.4).
 */
export function getMermaidScriptPath(): string {
  return require.resolve('mermaid/dist/mermaid.min.js');
}

let cachedMermaid: string | null = null;

/** Reads (and caches) the mermaid UMD bundle source. */
export function getMermaidScriptSource(): string {
  if (cachedMermaid === null) {
    cachedMermaid = fs.readFileSync(getMermaidScriptPath(), 'utf-8');
  }
  return cachedMermaid;
}
