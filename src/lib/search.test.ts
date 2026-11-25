import { describe, expect, it } from 'vitest';
import { matchesQuery, searchText } from './search';

const grid = {
  body: 'Headlights crawl across the porch',
  title: null,
  state: { seed: 'page:abc', world: 'road', words: ['gasoline', 'Quarter'], overrides: { porch: 'used' } },
};

describe('search', () => {
  it('finds page text case-insensitively, anywhere in a word', () => {
    const t = searchText(grid, []);
    expect(matchesQuery(t, 'HEADLIGHT')).toBe(true);
    expect(matchesQuery(t, 'cross')).toBe(true);
  });
  it('finds exercise words and prompts', () => {
    expect(matchesQuery(searchText(grid, []), 'quarter')).toBe(true);
    expect(matchesQuery(searchText({ body: '', title: null, state: { object: 'A motel ice bucket' } }, []), 'ice')).toBe(true);
  });
  it('finds memo labels and page titles', () => {
    expect(matchesQuery(searchText(grid, ['verse hum']), 'hum')).toBe(true);
    expect(matchesQuery(searchText({ ...grid, title: 'Toll booth song' }, []), 'toll')).toBe(true);
  });
  it('skips machinery like seeds and world ids', () => {
    const t = searchText(grid, []);
    expect(matchesQuery(t, 'page:abc')).toBe(false);
    expect(matchesQuery(t, 'road')).toBe(false);
  });
  it('matches everything on a blank query', () => {
    expect(matchesQuery('', '   ')).toBe(true);
  });
});
