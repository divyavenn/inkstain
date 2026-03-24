# Fixes & Feature Spec

---

## Feedback Model

Four feedback types, all anchored by word positions (word_start, word_end) + char positions (char_start, char_length):

| Type     | Color  | Trigger                        | Stored in           |
|----------|--------|--------------------------------|---------------------|
| Like     | Green  | Select text → Enter            | feedback_reactions  |
| Dislike  | Red    | Select text → any arrow → Enter| feedback_reactions  |
| Comment  | Yellow | Select text → start typing     | feedback_comments   |
| Edit     | Blue   | Click text → retype → Enter    | suggested_edits     |

---

## Read View Fixes (`components/ChapterReader.tsx`)

### 1. Selection-based feedback (Like / Dislike / Comment)

**Interaction flow:**
1. Reader drags to select text → `onMouseUp` fires
2. Pending state is created immediately with mode = `'like'`
3. A green inline highlight appears on the selected text (via charWrap into a `<mark class="pending-like">`)
4. A pending `MarginNote` appears in the right margin, anchored vertically to the midpoint of the selection's bounding rect
5. While pending:
   - **Any arrow key** → toggles mode between `'like'` (green) and `'dislike'` (red), only if no comment text has been typed
   - **Printable character** → mode becomes `'comment'`, highlight turns yellow, character appended to `commentText`, text streams into the MarginNote in real time as user types
   - **Backspace** → if commentText non-empty, removes last char; if empty, cancels pending
   - **Enter** → submit (see below)
   - **Escape** → cancel, remove pending highlight and MarginNote
6. On submit:
   - `'like'` → `POST /api/public/reactions` `{ sessionId, chapterVersionId, reaction: 'like', wordStart, wordEnd, charStart, charLength, selectedText }`
   - `'dislike'` → same with `reaction: 'dislike'`
   - `'comment'` → `POST /api/public/comments` `{ sessionId, chapterVersionId, body: commentText, selectedText, wordStart, wordEnd, charStart, charLength }`
   - On success: pending state is cleared, the submitted item is added to local `feedbackItems` state so it renders persistently

**State additions to ChapterReader:**
```ts
type PendingMode = 'like' | 'dislike' | 'comment';

interface PendingSelection {
  selectedText: string;
  wordStart: number;
  wordEnd: number;
  charStart: number;
  charLength: number;
  mode: PendingMode;
  commentText: string;
  anchorY: number;   // getBoundingClientRect().top of the selection, relative to text panel
}

const [pending, setPending] = useState<PendingSelection | null>(null);
```

**Key listener:** Attach a `keydown` listener to `document` while `pending !== null`. Remove on cleanup.

---

### 2. Inline Edit Mode

**Interaction flow:**
1. Reader clicks anywhere in the chapter text without making a selection (detected in the existing `onMouseUp` if `selection.toString() === ''`)
2. `editMode` is set to `true`
3. `contentRef.current.innerHTML` is snapshotted as `editOriginalHtml`
4. `contentRef.current.contentEditable = 'true'` — browser cursor appears at click point
5. Reader erases / retypes text freely
6. **Enter** → exit edit mode, diff original vs current, submit suggestion
7. **Escape** → exit edit mode, restore `editOriginalHtml`

**Diffing on submit:**
```
original = htmlToTextContent(editOriginalHtml)
current  = htmlToTextContent(contentRef.current.innerHTML)
```
Find the minimal contiguous span that differs (scan from start and end to find first/last differing char). Extract:
- `originalText = original.slice(diffStart, diffEnd_original)`
- `suggestedText = current.slice(diffStart, diffEnd_current)`
- `charStart = diffStart`

Convert charStart to wordStart/wordEnd via `wordRangeToCharPos` in reverse (or use a word-walker).

Submit `POST /api/public/suggestions` `{ sessionId, chapterVersionId, originalText, suggestedText, charStart, charLength: originalText.length, wordStart, wordEnd }`.

**State additions:**
```ts
const [editMode, setEditMode] = useState(false);
const [editOriginalHtml, setEditOriginalHtml] = useState<string | null>(null);
```

**Visual:** While in edit mode, show a subtle blue outline on the text panel, hide all existing highlights (so the user is editing clean text), show a small "editing…" indicator and "↵ propose · esc cancel" hint.

---

### 3. Delete feedback by pressing Backspace

**For submitted feedback items visible in the read view (highlights in text):**

1. Click on any rendered highlight mark → sets `focusedFeedbackId` and `focusedFeedbackType` state
2. A faint outline appears on the clicked highlight
3. **Backspace key** (while `focusedFeedbackId` is set) → calls the appropriate DELETE endpoint, removes the item from local `feedbackItems` state, clears focus
4. Clicking elsewhere clears `focusedFeedbackId`

**New DELETE API routes:**
- `DELETE /api/public/reactions/[id]` — validates session owns the item, deletes from `feedback_reactions`
- `DELETE /api/public/comments/[id]` — validates session owns the item, deletes from `feedback_comments`
- `DELETE /api/public/suggestions/[id]` — validates session owns the item, deletes from `suggested_edits`

All three check `reader_session_id = sessionId` before deleting.

---

### 4. Edit existing comment text in margin

**For existing MarginNote components displaying the reader's own comments:**

1. Reader clicks on the note text → note becomes editable (replace text `<div>` with `<textarea>` pre-filled with current body)
2. Reader edits text
3. **Enter** or blur → `PATCH /api/public/comments/[id]` `{ body: newText }`, update local state
4. **Escape** → revert to original text

**New PATCH API route:**
- `PATCH /api/public/comments/[id]` — validates session owns item, updates `body` in `feedback_comments`

---

## New Component: `components/MarginNote.tsx`

Renders an absolutely-positioned annotation in the right margin of the reading layout.

```ts
interface MarginNoteProps {
  text: string;              // comment body (or typed text while pending)
  anchorY: number;           // px from top of text panel container
  isPending?: boolean;       // true while user is still typing
  commentId?: string;        // set for persisted comments
  sessionId?: string;        // to authorize edits/deletes
  onEdit?: (newText: string) => void;
  onDelete?: () => void;
}
```

**Styling:**
- `position: absolute; right: -260px; top: {anchorY}px; width: 220px`
- Font: `Caveat` (Google Font, add to `app/layout.tsx`)
- Font size: `1.1rem`, color: `#333`, line-height: `1.4`
- A thin line connecting the note to the highlight position (SVG or CSS border-left)

**Only the current reader's comments are shown** (filter local `feedbackItems` by matching sessionId when rendering margin notes).

**Reading layout change:** The `ChapterReader` outer container needs `position: relative` and enough right margin (≥ 260px) to accommodate notes. On narrow screens, notes collapse / show on tap.

---

## Schema Changes

### `feedback_reactions` — add word anchors

```sql
ALTER TABLE feedback_reactions
  ADD COLUMN IF NOT EXISTS word_start int,
  ADD COLUMN IF NOT EXISTS word_end int,
  ADD COLUMN IF NOT EXISTS char_start int,
  ADD COLUMN IF NOT EXISTS char_length int,
  ADD COLUMN IF NOT EXISTS selected_text text;
```

Add to `lib/db/schema.ts` `CREATE_SCHEMA_SQL`.

### Reactions API update

`POST /api/public/reactions` — add word/char position handling (same pattern as comments API):
- Accept `selectedText` in request body
- Call `feedbackWordPos(renderedHtml, selectedText)` to get `wordStart`/`wordEnd`
- Call `wordRangeToCharPos(renderedHtml, wordStart, wordEnd)` to get `charStart`/`charLength`
- Store all four columns

---

## Author Dashboard Fixes

### Jotai → Recoil (full migration)

**Remove** `jotai` package.
**Add** `recoil` package.

Update `lib/atoms.ts`:
```ts
import { atom } from 'recoil';

export const selectedVersionAtom = atom<string | null>({
  key: 'selectedVersion',
  default: null,
});

export interface SelectedTextRange {
  wordStart: number;
  wordEnd: number;
  charStart: number;
  charLength: number;
  selectedText: string;
  chapterId: string;
}

export const selectedTextAtom = atom<SelectedTextRange | null>({
  key: 'selectedText',
  default: null,
});
```

Wrap root layout in `<RecoilRoot>` (`app/layout.tsx`).

Update all Jotai `useAtom` calls → Recoil `useRecoilState` / `useRecoilValue`.
Files to update: `components/AuthorDashboard.tsx`, `components/VersionTimeline.tsx` (if it uses selectedVersionAtom).

---

### Dashboard Fix 1: Default view = current commit only

The comment pane already fetches `WHERE chapter_version_id = ${versionId}`, so data is version-scoped. The fix is to ensure the UI makes this explicit and `selectedTextAtom` is `null` by default (no cross-version expansion unless user interacts).

When the user selects a different version in the timeline → reset `selectedTextAtom` to `null`.

---

### Dashboard Fix 2: selectedText cross-version pane

**In `CommentsView.tsx`:**

**Setting selectedText:**

a) Click on an existing highlight mark:
- `handleTextClick` already pins the mark. Additionally, read `data-item-ids` → look up the comment's `char_start`/`char_length`/`word_start`/`word_end` from the `comments` array → set `selectedTextAtom`

b) Manual text selection in the text panel:
- Add `onMouseUp` handler to `TextPanel`
- On mouse up, get `window.getSelection()`, compute char offsets relative to the text container using a char-walker (same logic as `charWrap` but in reverse — walk DOM text nodes, accumulate charPos until hitting the anchor/focus nodes)
- Convert char range to word range (walk `htmlToTextContent(chapterHtml)` to find word indices for the char range)
- Set `selectedTextAtom`

**When `selectedTextAtom` is set → fetch cross-version feedback:**

New API: `GET /api/dashboard/chapters/[chapterId]/feedback-for-range?wordStart=X&wordEnd=Y`

This endpoint:
1. Gets all chapter_versions for this chapter, ordered by `version_number DESC`
2. For each version, queries `feedback_comments` and `suggested_edits` where `word_start <= queryWordEnd AND word_end >= queryWordStart` (overlap check)
3. Uses `resolveWordRange` to map the query word range into each version's word space (via `chapter_diffs` word maps), then checks overlap in that version's space
4. Returns:
```ts
{
  versions: [{
    versionNumber: number,
    commitSha: string,
    commitMessage: string,
    date: string,
    items: DashComment[] | DashSuggestion[]  // same types as current
  }]
}
```

**Comment pane rendering when selectedText is set:**

Replace the flat `visibleItems` list with a version-grouped view:

```
────────────────────────
  v10 · affaf88d · "updates"
────────────────────────
  [CommentCard] ...
  [CommentCard] ...
────────────────────────
  v9 · 83b6cb5 · "Fix chapter-01..."
────────────────────────
  [CommentCard] ...
────────────────────────
  v8 · 5170c0c · "changed how..."
  (no feedback on this text)
────────────────────────
```

Separator: thin `1px solid rgba(26,26,24,0.1)` line with small version label in 0.6rem uppercase Inter.

Clicking the X or clicking outside the text deselects → sets `selectedTextAtom` to `null` → returns to flat single-version view.

---

### Dashboard Fix 3: Heatmap — word-by-word reactions

**Schema:** `feedback_reactions` gets `word_start`, `word_end` (see above).

**Heatmap API (`/api/dashboard/chapter-versions/[id]/heatmap`):**

Change response shape to include per-word data in addition to (or replacing) per-line:

```ts
{
  words: [{
    wordIndex: number,
    word: string,
    likeCount: number,    // aggregated across all versions
    dislikeCount: number, // aggregated across all versions
    netScore: number,
    commentCount: number,
    readerReachPercent: number,
  }]
}
```

Cross-version aggregation:
1. Get all chapter_versions for this chapter (all of them, not just current)
2. For each version, get its reactions (where `word_start IS NOT NULL`)
3. For each reaction, use the stored `chapter_diffs` word map to translate that version's word range into the CURRENT version's word range (via `resolveWordRange`)
4. Accumulate likes/dislikes per current-version word index
5. Comments: same approach using existing `word_start`/`word_end` columns

**`LikesHeatmapView.tsx` changes:**

Instead of painting whole `<p>` blocks, render the chapter text word-by-word. Strategy:
1. Get `htmlToWords(chapterHtml)` → array of words with their char positions
2. Use `charWrap`-style DOM manipulation to wrap each word in `<span data-word-index="N" style="background-color: ...">`
3. Color scale: `rgba(80, 200, 80, opacity)` for net positive, `rgba(200, 80, 80, opacity)` for net negative, opacity proportional to `Math.abs(netScore) / maxAbsScore`
4. Tooltip on hover: `wordIndex` → look up in `words[]` array → show "X likes · Y dislikes · Z comments"

---

## File Change Summary

**New files:**
- `components/MarginNote.tsx`
- `app/api/public/reactions/[id]/route.ts` — DELETE
- `app/api/public/comments/[id]/route.ts` — GET, PATCH, DELETE
- `app/api/public/suggestions/[id]/route.ts` — DELETE
- `app/api/dashboard/chapters/[id]/feedback-for-range/route.ts` — GET

**Modified files:**
- `lib/atoms.ts` — replace Jotai with Recoil, add `selectedTextAtom`
- `lib/db/schema.ts` — add word/char columns to `feedback_reactions`
- `app/layout.tsx` — add `<RecoilRoot>`, load Caveat Google Font
- `app/api/public/reactions/route.ts` — store word/char positions
- `app/api/dashboard/chapter-versions/[id]/heatmap/route.ts` — word-level cross-version aggregation
- `components/ChapterReader.tsx` — new interaction model (like/dislike/comment/edit)
- `components/LikesHeatmapView.tsx` — word-by-word rendering
- `components/CommentsView.tsx` — selectedText integration, cross-version grouped pane
- `components/AuthorDashboard.tsx` — Recoil, reset selectedText on version change
- `components/VersionTimeline.tsx` — Recoil migration

**Deleted / removed dependency:**
- `jotai` from `package.json`

---

## Confirmed Answers

1. **Edit mode diff**: Full span of whatever the user changed (minimal contiguous diff).
2. **Margin notes**: Only the current reader's own comments visible in the read view. Other readers' notes are author-dashboard only.
3. **FeedbackPopover**: Replace entirely with backspace-to-delete flow.
