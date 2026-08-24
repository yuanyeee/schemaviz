// Shared helpers for column type parameters (length / precision / scale).

/**
 * Formats a column type with its parameters.
 *   ('VARCHAR', 255)              -> 'VARCHAR(255)'
 *   ('DECIMAL', undefined, 10, 2) -> 'DECIMAL(10,2)'
 *   ('DECIMAL', undefined, 10)    -> 'DECIMAL(10)'
 *   ('TEXT')                      -> 'TEXT'
 */
export function formatColumnType(
  type: string,
  length?: number,
  precision?: number,
  scale?: number,
): string {
  if (length != null) return `${type}(${length})`;
  if (precision != null && scale != null) return `${type}(${precision},${scale})`;
  if (precision != null) return `${type}(${precision})`;
  return type;
}

/** Whether the type accepts a character/binary length parameter. */
export function isLengthType(type: string): boolean {
  const t = type.toLowerCase().trim();
  return t.includes('char') || t.includes('binary');
}

/** Whether the type accepts exact numeric precision/scale parameters. */
export function isPrecisionType(type: string): boolean {
  const t = type.toLowerCase().trim();
  return t === 'numeric' || t === 'decimal';
}

export interface ParsedColumnType {
  type: string;
  length?: number;
  precision?: number;
  scale?: number;
}

/**
 * Parses a declared type string (as reported by e.g. SQLite PRAGMA table_info)
 * into its base type and parameters.
 *   'VARCHAR(100)'  -> { type: 'VARCHAR', length: 100 }
 *   'DECIMAL(10,2)' -> { type: 'DECIMAL', precision: 10, scale: 2 }
 *   'DECIMAL(10)'   -> { type: 'DECIMAL', precision: 10 }
 *   'INTEGER'       -> { type: 'INTEGER' }
 */
export function parseColumnType(declared: string): ParsedColumnType {
  const m = /^([^()]+?)(?:\((\d+)(?:\s*,\s*(\d+))?\))?$/.exec(declared.trim());
  if (!m) return { type: declared.trim() };

  const type = m[1].trim();
  if (m[2] == null) return { type };

  const first = parseInt(m[2], 10);
  const second = m[3] != null ? parseInt(m[3], 10) : undefined;

  if (second != null) {
    return { type, precision: first, scale: second };
  }
  if (isLengthType(type)) {
    return { type, length: first };
  }
  return { type, precision: first };
}
