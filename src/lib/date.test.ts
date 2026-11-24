import { describe, expect, it } from 'vitest';
import { daysBetween, localDate, pageTitleDate, parseLocalDate, relativeDay, shortDate } from './date';

// vite.config.ts pins TZ to America/Los_Angeles for tests, so UTC math would fail these.

describe('localDate', () => {
  it('uses the local calendar day late at night', () => {
    expect(localDate(new Date(2026, 10, 24, 23, 59))).toBe('2026-11-24');
  });
  it('uses the local calendar day just after midnight', () => {
    expect(localDate(new Date(2026, 10, 25, 0, 1))).toBe('2026-11-25');
  });
  it('pads month and day', () => {
    expect(localDate(new Date(2026, 0, 5, 12))).toBe('2026-01-05');
  });
});

describe('parseLocalDate', () => {
  it('parses to local midnight on the same day', () => {
    const d = parseLocalDate('2026-11-24');
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 10, 24, 0]);
  });
  it('round-trips with localDate', () => {
    expect(localDate(parseLocalDate('2026-03-08'))).toBe('2026-03-08');
  });
  it('rejects other formats', () => {
    expect(() => parseLocalDate('11/24/2026')).toThrow();
  });
});

describe('formatting', () => {
  it('formats the page title', () => {
    expect(pageTitleDate('2026-11-24')).toBe('Tuesday, Nov 24');
  });
  it('formats a short date', () => {
    expect(shortDate('2026-11-21')).toBe('Nov 21');
  });
});

describe('daysBetween', () => {
  it('counts across a DST change', () => {
    expect(daysBetween('2026-03-07', '2026-03-09')).toBe(2);
    expect(daysBetween('2026-10-31', '2026-11-02')).toBe(2);
  });
});

describe('relativeDay', () => {
  it('says Today, Yesterday, else the date', () => {
    expect(relativeDay('2026-11-24', '2026-11-24')).toBe('Today');
    expect(relativeDay('2026-11-23', '2026-11-24')).toBe('Yesterday');
    expect(relativeDay('2026-11-21', '2026-11-24')).toBe('Nov 21');
  });
});
