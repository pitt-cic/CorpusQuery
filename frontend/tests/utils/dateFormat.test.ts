import { describe, it, expect, vi } from 'vitest';
import { relativeTime, formatTimestamp } from '@/utils/dateFormat';

describe('relativeTime', () => {
  it('returns "just now" for times less than 60 seconds ago', () => {
    const now = new Date('2026-06-01T12:00:00Z');
    vi.setSystemTime(now);
    expect(relativeTime('2026-06-01T11:59:30Z')).toBe('just now');
    vi.useRealTimers();
  });

  it('returns minutes ago', () => {
    const now = new Date('2026-06-01T12:00:00Z');
    vi.setSystemTime(now);
    expect(relativeTime('2026-06-01T11:55:00Z')).toBe('5m ago');
    vi.useRealTimers();
  });

  it('returns hours ago', () => {
    const now = new Date('2026-06-01T12:00:00Z');
    vi.setSystemTime(now);
    expect(relativeTime('2026-06-01T09:00:00Z')).toBe('3h ago');
    vi.useRealTimers();
  });

  it('returns days ago', () => {
    const now = new Date('2026-06-01T12:00:00Z');
    vi.setSystemTime(now);
    expect(relativeTime('2026-05-29T12:00:00Z')).toBe('3d ago');
    vi.useRealTimers();
  });

  it('returns weeks ago for 7+ days', () => {
    const now = new Date('2026-06-01T12:00:00Z');
    vi.setSystemTime(now);
    expect(relativeTime('2026-05-18T12:00:00Z')).toBe('2w ago');
    vi.useRealTimers();
  });
});

describe('formatTimestamp', () => {
  it('formats ISO string to readable date', () => {
    expect(formatTimestamp('2026-05-28T14:32:00Z')).toBe('2026-05-28 14:32');
  });
});
