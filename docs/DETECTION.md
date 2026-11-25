# DETECTION

How the app decides an exercise word has been used, and how it counts syllables. All of this lives in pure functions in `src/lib/detect.ts` and `src/lib/syllables.ts`. The tables at the bottom are the unit tests: write them first.

## 1. Normalizing text
Applied to both the pad text and each exercise word before comparing:
1. Lowercase.
2. Curly quotes and apostrophes → straight (`’` → `'`).
3. Dropped-g endings: `in'` at the end of a word → `ing` ("lovin'" → "loving", "runnin'" → "running").
4. Strip leading and trailing punctuation from each token, keeping internal apostrophes and hyphens.
5. Possessive `'s` at the end → removed ("porch's" → "porch").

## 2. Tokenizing
- Split each line on whitespace. Keep each token's line index and character offsets in the original text, so the mirror can highlight the exact span.
- A hyphenated token ("burnt-out") is checked as a whole and as each of its parts. The highlight covers the whole token.
- Section label lines (`[Verse 1]`) are skipped entirely.

## 3. Forms of a word (forward generation)
Don't stem pad words backward. Instead, for each exercise word, generate the set of its own forms once, then check pad tokens against that set. It's more precise, and there are only 16 words.

`formsOf(word)` returns a Set containing:
- the word itself
- noun forms: plural and singular (use `compromise`: `nlp(word).nouns().toPlural()` and `.toSingular()`)
- verb forms: 3rd person, past, past participle, gerund (use `compromise`: `nlp(word).verbs().conjugate()`)
- adjective forms for `texture` words: comparative and superlative (`-er`, `-est`, with the spelling rules below)
- everything in the irregular table (`src/lib/irregulars.ts`) for that word, in both directions

Spelling rules to check `compromise`'s output against (add the form if it's missing):
- consonant doubling: stop → stopped, stopping
- silent-e drop: hope → hoped, hoping
- y → i: bury → buried, buries; carry → carried
- sibilant plurals: porch → porches, box → boxes

Irregular table: seed it with at least the 150 most common irregular verbs (run/ran, swim/swam/swum, wear/wore/worn, burn/burnt, dream/dreamt, light/lit, leave/left…), plus irregular plurals (tooth/teeth, knife/knives, mouse/mice, leaf/leaves).

`rootOf(a, b)`: two words share a root if either is in the other's `formsOf`. WORDS.md uses this to keep "burn" and "burned" out of the same grid.

## 4. Match levels
The page's detection level (default **Root**, changeable in the ••• menu and Settings):

| level | a pad token counts for word W if… |
|---|---|
| Exact | token === W |
| Root | token is in `formsOf(W)` |
| Loose | Root, **or** any of: |
| | • W has 4+ letters and the token is W plus one of these endings: `y`, `ish`, `less`, `ful`, `ly`, `er`, `ness`, `like` (rust → rusty, burn → burner) |
| | • W has 4+ letters and the token is a closed compound that starts or ends with W or one of its forms (porch → porchlight, headlights → headlight-shaped is handled by hyphen split) |
| | • W has 6+ letters and the token is within edit distance 1 of W or one of its forms (Damerau-Levenshtein), to catch typos and bent spellings (envelope → envelop) |

Loose never matches a word hidden inside another word that doesn't start or end with it: "art" never matches "start", "rust" never matches "trust".

## 5. Overrides
Each exercise word has a manual state on the page: `auto`, `used` or `unused`.
- `auto`: used if any token matches at the current level.
- `used`: always counts as used, even with no match (for when you bent it past what the rules catch).
- `unused`: never counts, and its matches aren't highlighted (for false positives).

## 6. Output
`detect(text, words, level, overrides)` returns, for each word:
```ts
{ word: string; used: boolean; source: 'match' | 'override' | 'none';
  matches: { line: number; start: number; end: number; token: string; exact: boolean }[] }
```
`exact: false` matches feed the "matched: burned → burn" line under the grid (show each pair once, the first match).

Run it 150 ms after typing stops. It must handle a 2,000-word page in under 10 ms on a phone; forms are computed once per word, not per keystroke.

## 7. Syllables
`countLine(line)`: the sum of `syllable(word)` over the line's words, after the overrides below. Words are normalized as in section 1 first.
- Hyphenated words: count each part.
- Digits: convert to words first ("1999" → "nineteen ninety-nine"), for numbers up to 9,999. Larger: count each digit as its spoken word.
- Override table in `src/lib/syllableOverrides.ts` for words people sing differently from how the package counts. Start it with: fire 1, hour 1, every 2, family 2, different 2, evening 2, chocolate 2, our 1, flower 2, heaven 2. Overrides win over the package. (Added: nineteen 2, ninety 2.)
- Then `src/data/syllableFixes.json` (written by `npm run bank`): CMU dictionary counts for bank words and their forms where the package disagrees. Order: overrides, then CMU fixes, then the package.
- Section label lines and empty lines return `null` (no count shown).

## 8. Test cases

### Matching
| word | token | Exact | Root | Loose |
|---|---|---|---|---|
| burn | burn | ✓ | ✓ | ✓ |
| burn | Burned, | ✗ | ✓ | ✓ |
| burn | burnt | ✗ | ✓ | ✓ |
| burn | burning | ✗ | ✓ | ✓ |
| burn | burns | ✗ | ✓ | ✓ |
| burn | burner | ✗ | ✗ | ✓ |
| burn | burnt-out | ✗ | ✓ | ✓ |
| run | ran | ✗ | ✓ | ✓ |
| run | runnin' | ✗ | ✓ | ✓ |
| swallow | swallowed | ✗ | ✓ | ✓ |
| borrow | borrowed | ✗ | ✓ | ✓ |
| porch | porches | ✗ | ✓ | ✓ |
| porch | porch's | ✓ | ✓ | ✓ |
| porch | porchlight | ✗ | ✗ | ✓ |
| headlights | headlight | ✗ | ✓ | ✓ |
| rust | rusty | ✗ | ✗ | ✓ |
| rust | trust | ✗ | ✗ | ✗ |
| art | start | ✗ | ✗ | ✗ |
| tide | tidy | ✗ | ✗ | ✗ |
| stop | stopped | ✗ | ✓ | ✓ |
| hope | hoping | ✗ | ✓ | ✓ |
| bury | buried | ✗ | ✓ | ✓ |
| knife | knives | ✗ | ✓ | ✓ |
| envelope | envelop | ✗ | ✗ | ✓ |
| cathedral | Cathedrals. | ✗ | ✓ | ✓ |

("porch's" is ✓ for Exact because normalizing removes the possessive first.)

### Overrides
- word `mercy`, no match in text, override `used` → `used: true, source: 'override'`
- word `burn`, text "I burned it", override `unused` → `used: false`, no matches returned
- word `burn`, text "I burned it", override `auto`, level Exact → `used: false`

### Syllables
| line | count |
|---|---|
| Headlights crawl across the porch | 7 |
| I burned your static for the heat | 8 |
| Rust on the ladder rungs | 6 |
| A quarter I borrowed from you | 8 |
| I swallowed the envelope whole | 8 |
| Tide comes in like | 4 |
| Born in 1999 | 7 |
| The fire's out | 3 |
| [Chorus] | null |
| (empty line) | null |
