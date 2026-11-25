import { describe, expect, it } from 'vitest';
import { activeMinutes, formatDuration, plural } from './format';

describe('format', () => {
  it('formats memo durations', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(38_400)).toBe('0:38');
    expect(formatDuration(725_000)).toBe('12:05');
  });
  it('pluralises counts', () => {
    expect(plural(1, 'page')).toBe('1 page');
    expect(plural(0, 'memo')).toBe('0 memos');
    expect(plural(31, 'memo')).toBe('31 memos');
  });
  it('shows minutes on a page', () => {
    expect(activeMinutes(59_000)).toBeNull();
    expect(activeMinutes(14 * 60_000 + 5)).toBe('14 min');
  });
});
