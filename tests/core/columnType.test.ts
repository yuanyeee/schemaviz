import { describe, it, expect } from 'vitest';
import {
  formatColumnType,
  parseColumnType,
  isLengthType,
  isPrecisionType,
} from '../../src/core/columnType';

describe('formatColumnType', () => {
  it('formats length', () => {
    expect(formatColumnType('VARCHAR', 255)).toBe('VARCHAR(255)');
  });

  it('formats precision and scale', () => {
    expect(formatColumnType('DECIMAL', undefined, 10, 2)).toBe('DECIMAL(10,2)');
  });

  it('formats precision alone', () => {
    expect(formatColumnType('DECIMAL', undefined, 10)).toBe('DECIMAL(10)');
  });

  it('returns the bare type without parameters', () => {
    expect(formatColumnType('TEXT')).toBe('TEXT');
  });

  it('prefers length over precision when both are set', () => {
    expect(formatColumnType('VARCHAR', 100, 10, 2)).toBe('VARCHAR(100)');
  });
});

describe('parseColumnType', () => {
  it('parses character length', () => {
    expect(parseColumnType('VARCHAR(100)')).toEqual({ type: 'VARCHAR', length: 100 });
  });

  it('parses nvarchar length case-insensitively', () => {
    expect(parseColumnType('nvarchar(50)')).toEqual({ type: 'nvarchar', length: 50 });
  });

  it('parses precision and scale', () => {
    expect(parseColumnType('DECIMAL(10,2)')).toEqual({ type: 'DECIMAL', precision: 10, scale: 2 });
  });

  it('parses a single numeric parameter as precision', () => {
    expect(parseColumnType('NUMERIC(8)')).toEqual({ type: 'NUMERIC', precision: 8 });
  });

  it('handles bare types', () => {
    expect(parseColumnType('INTEGER')).toEqual({ type: 'INTEGER' });
  });

  it('handles whitespace', () => {
    expect(parseColumnType('  DECIMAL(10, 2) ')).toEqual({
      type: 'DECIMAL',
      precision: 10,
      scale: 2,
    });
  });
});

describe('type parameter predicates', () => {
  it('isLengthType matches character/binary families', () => {
    expect(isLengthType('character varying')).toBe(true);
    expect(isLengthType('nvarchar')).toBe(true);
    expect(isLengthType('varbinary')).toBe(true);
    expect(isLengthType('integer')).toBe(false);
    expect(isLengthType('decimal')).toBe(false);
  });

  it('isPrecisionType matches exact numerics only', () => {
    expect(isPrecisionType('numeric')).toBe(true);
    expect(isPrecisionType('decimal')).toBe(true);
    expect(isPrecisionType('integer')).toBe(false);
    expect(isPrecisionType('real')).toBe(false);
  });
});
