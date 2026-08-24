// ─── HTML/JS injection escaping helpers ───────────────────────────────────────

/**
 * Escapes a JSON payload for safe embedding inside an inline <script> block.
 * Rewrites `</` as `<\/` so embedded markup cannot close the script element;
 * the escape is a no-op for JSON.parse and JS string literals.
 */
export function escapeJsonForHtmlScript(json: string): string {
  return json.replace(/<\//g, '<\\/');
}

/**
 * Escapes arbitrary text for embedding inside a JS template literal that lives
 * in an inline <script> block (backslashes, backticks, placeholders, closing tags).
 */
export function escapeForInlineTemplateLiteral(code: string): string {
  return code
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$\{/g, '\\${')
    .replace(/<\//g, '<\\/');
}

/** Escapes text for embedding as raw text inside an HTML element. */
export function escapeHtmlText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
