import { describe, it, expect } from 'vitest';
import { truncate, pluralize } from '@/utils/stringFormat';

describe('truncate', () => {
  it('returns string unchanged if under max length', () => {
    expect(truncate('short', 10)).toBe('short');
  });

  it('truncates and adds ellipsis at max length', () => {
    expect(truncate('this is a long string', 10)).toBe('this is a ...');
  });

  it('handles empty string', () => {
    expect(truncate('', 10)).toBe('');
  });
});

describe('pluralize', () => {
  it('returns singular for count 1', () => {
    expect(pluralize(1, 'chunk')).toBe('1 chunk');
  });

  it('returns plural for count > 1', () => {
    expect(pluralize(5, 'chunk')).toBe('5 chunks');
  });

  it('returns plural for count 0', () => {
    expect(pluralize(0, 'chunk')).toBe('0 chunks');
  });

  it('uses custom plural form', () => {
    expect(pluralize(2, 'index', 'indices')).toBe('2 indices');
  });
});
