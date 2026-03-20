# Word-Position Anchoring Plan

## Goal

Replace char-offset feedback anchors with word-index anchors. Word indices are
stable across styling-only edits (adding `**bold**`, fixing punctuation), and
enable cross-version queries like "show all feedback on this sentence across
every version".

## Why not char offsets

`char_start` shifts whenever any earlier character is inserted or deleted —
including markdown syntax that the reader never sees. Word indices derived from
`htmlToTextContent(rendered_html)` are immune to formatting changes and can be
mapped across versions via a word-level diff.

## Why not git diff on raw markdown

Git diffs the source. A change from `*word*` to `**word**` looks like a
deletion+insertion even though the rendered text is identical. We diff the
**rendered text content** (post-`htmlToTextContent`) instead, so styling
commits produce zero word-map changes.

---

## Schema changes

### `chapter_versions`
- Add `word_count int` — number of words in `htmlToTextContent(rendered_html)`

### `chapter_diffs`
- Replace `diff_json jsonb` with `word_map int[]` — array indexed by **new**
  word position, value = corresponding **old** word position, or -1 if the
  word is new. Length = new version's word count.

### `feedback_comments`
- Add `word_start int`, `word_end int` (inclusive indices into the version's
  word array, derived from `selected_text` at write time)

### `suggested_edits`
- Add `word_start int`, `word_end int` (derived from `original_text`)

---

## New utility: `lib/db/wordPos.ts`

```
htmlToWords(html)             → string[]   split rendered text on whitespace
feedbackWordPos(html, text)   → { wordStart, wordEnd } | null
buildWordMap(oldWords, newWords) → number[]   LCS-based, new→old index map
mapWordRange(wordMap, ws, we) → { wordStart, wordEnd } | null   cross-version
```

### LCS algorithm

Standard O(n·m) DP on word arrays, then backtrack to build `newToOld[]`.
Chapter texts are ~1 000–3 000 words → well within sync budget.

---

## Ingest pipeline changes (`scripts/seed.ts` → `ingestCommit`)

After inserting a chapter version:

1. `words = htmlToWords(rendered_html)` → store `word_count`
2. If a previous version of this chapter exists:
   a. Fetch previous `rendered_html`
   b. `wordMap = buildWordMap(oldWords, newWords)`
   c. Insert / update `chapter_diffs` with `word_map = wordMap`

---

## API write-time changes

Both `/api/public/comments` and `/api/public/suggestions`:
- Fetch `rendered_html` for the version (already doing this)
- Call `feedbackWordPos(rendered_html, selectedText / originalText)`
- Store `word_start`, `word_end` alongside existing `char_start`, `char_length`

`char_start`/`char_length` are kept for now as a fallback for the existing
highlighting logic on the frontend, which uses char offsets directly.

---

## Cross-version query (foundation only — no UI yet)

To map feedback from version A to version B, traverse the `chapter_diffs`
chain: `mapWordRange(wordMap_A→B, wordStart, wordEnd)`. A helper
`resolveWordRange(fromVersionId, toVersionId, wordStart, wordEnd)` will do the
chain walk in Postgres by joining `chapter_diffs`.

---

## Files touched

| File | Change |
|------|--------|
| `lib/db/schema.ts` | Add columns per above |
| `lib/db/wordPos.ts` | New — word utilities + LCS |
| `lib/db/charPos.ts` | `feedbackCharPos` unchanged; word layer is additive |
| `scripts/seed.ts` | `ingestCommit` computes `word_count` + `word_map`; feedback inserts include `word_start`/`word_end` |
| `scripts/migrate-word-pos.ts` | One-off ALTER TABLE migrations |
| `app/api/public/comments/route.ts` | Store `word_start`/`word_end` |
| `app/api/public/suggestions/route.ts` | Same |

Frontend highlighting continues to use stored `char_start`/`char_length` —
no frontend changes needed in this phase.


  Root cause of the null char positions: Marked converts straight apostrophes (') to smart/curly quotes (', U+2019) in the rendered HTML. So
  feedbackWordPos was trying to match bees' (U+0027) against bees' (U+2019) — they don't equal, so it returned null, giving char_start=null.

  The fix I made in lib/db/wordPos.ts: added a normalizeQuotes() function that converts smart quotes → straight before comparing in feedbackWordPos. This
   makes anchoring quote-agnostic.

  What still needs to happen: reseed so the two failing comments (bees' nest and prince's eyes) get their char_start computed correctly with the fixed
  function. The seed ran but may have used a cached version. Run it once more: