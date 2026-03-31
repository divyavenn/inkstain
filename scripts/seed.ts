/**
 * scripts/seed.ts
 *
 * Backfills all historical chapter commits into Neon and populates
 * sample reader profiles, groups, invites, sessions, reactions,
 * comments, suggested edits, retention data, and interest signups.
 *
 * Usage:
 *   npx tsx scripts/seed.ts
 *
 * Requires DATABASE_URL to be set (copy from .env.local or pass inline).
 */

import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import simpleGit from 'simple-git';
import matter from 'gray-matter';
import { nanoid } from 'nanoid';
import { feedbackWordPos, htmlToWords, buildWordMap, wordRangeToCharPos } from '../lib/db/wordPos.js';
import { parseChapter } from '../lib/ingest/parse-chapter.js';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL is not set. Create a .env.local with your Neon connection string.');
  process.exit(1);
}

const sql = neon(DATABASE_URL);

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function rawQuery(q: string) {
  return sql.query(q);
}

// ─── Schema bootstrap ─────────────────────────────────────────────────────────

async function ensureSchema() {
  const { CREATE_SCHEMA_SQL } = await import('../lib/db/schema.js');
  const stmts = CREATE_SCHEMA_SQL.split(';').map(s => s.trim()).filter(Boolean);
  for (const stmt of stmts) await rawQuery(stmt);
  console.log('✓ schema ready');
}

// ─── Per-commit ingest ────────────────────────────────────────────────────────

interface CommitInfo {
  sha: string;
  message: string;
  author: string;
  date: string;
}

async function ingestCommit(workId: string, commit: CommitInfo, chapterFiles: string[]) {
  // Reuse existing document_version or create a new one
  const existing = await sql`
    SELECT id FROM document_versions WHERE work_id = ${workId} AND commit_sha = ${commit.sha}
  `;
  let documentVersionId: string;
  if (existing.length > 0) {
    documentVersionId = existing[0].id as string;
  } else {
    const [docVer] = await sql`
      INSERT INTO document_versions (work_id, commit_sha, commit_message, commit_author, commit_created_at)
      VALUES (${workId}, ${commit.sha}, ${commit.message}, ${commit.author}, ${commit.date})
      RETURNING id
    `;
    documentVersionId = docVer.id as string;
  }

  const git = simpleGit(process.cwd());

  for (const filePath of chapterFiles) {
    let rawFile: string;
    try {
      rawFile = await git.show([`${commit.sha}:chapters/${filePath}`]);
    } catch {
      continue; // file didn't exist at this commit
    }

    const { data, content } = matter(rawFile);
    const parsed = parseChapter({
      filePath,
      slug: filePath.replace('.md', ''),
      title: data.title || filePath.replace('.md', ''),
      sortOrder: typeof data.order === 'number' ? data.order : (parseInt(data.order, 10) || 0),
      rawMarkdown: content,
      frontmatter: data,
    });

    // Upsert chapter
    const [ch] = await sql`
      INSERT INTO chapters (work_id, slug, title, file_path, sort_order)
      VALUES (${workId}, ${parsed.slug}, ${parsed.title}, ${parsed.filePath}, ${parsed.sortOrder})
      ON CONFLICT (work_id, file_path) DO UPDATE SET title = EXCLUDED.title, sort_order = EXCLUDED.sort_order
      RETURNING id
    `;
    const chapterId = ch.id as string;

    // Version number
    const [vc] = await sql`SELECT COUNT(*) as cnt FROM chapter_versions WHERE chapter_id = ${chapterId}`;
    const versionNumber = parseInt(vc.cnt as string, 10) + 1;

    const [cv] = await sql`
      INSERT INTO chapter_versions (chapter_id, document_version_id, version_number, title, raw_markdown, rendered_html, line_count, word_count, char_count)
      VALUES (${chapterId}, ${documentVersionId}, ${versionNumber}, ${parsed.title}, ${parsed.rawMarkdown}, ${parsed.renderedHtml}, ${parsed.lineCount}, ${parsed.wordCount}, ${parsed.charCount})
      ON CONFLICT (chapter_id, document_version_id) DO UPDATE SET title = EXCLUDED.title
      RETURNING id
    `;
    const chapterVersionId = cv.id as string;

    // Lines
    await sql`DELETE FROM chapter_version_lines WHERE chapter_version_id = ${chapterVersionId}`;
    for (const line of parsed.lines) {
      await sql`
        INSERT INTO chapter_version_lines (chapter_version_id, line_number, line_text, line_hash, block_type)
        VALUES (${chapterVersionId}, ${line.lineNumber}, ${line.lineText}, ${line.lineHash}, ${line.blockType})
      `;
    }

    // Word map: diff rendered text content against previous version
    const newWords = htmlToWords(parsed.renderedHtml);
    if (versionNumber > 1) {
      const [prevVer] = await sql`
        SELECT id, rendered_html FROM chapter_versions
        WHERE chapter_id = ${chapterId} AND version_number = ${versionNumber - 1}
      `;
      if (prevVer) {
        const oldWords = htmlToWords(prevVer.rendered_html);
        const wordMap = buildWordMap(oldWords, newWords);
        await sql`
          INSERT INTO chapter_diffs (chapter_version_id, previous_chapter_version_id, word_map)
          VALUES (${chapterVersionId}, ${prevVer.id}, ${wordMap})
          ON CONFLICT DO NOTHING
        `;
      }
    }

    console.log(`    ✓ ${filePath} v${versionNumber} (${parsed.lineCount} lines, ${newWords.length} words)`);
  }

  return documentVersionId;
}

// ─── Sample data ─────────────────────────────────────────────────────────────

const READERS = [
  { displayName: 'Diana Reyes',      email: 'diana@example.com',  slug: 'diana-reyes',   notes: 'Early reader, loves mythology' },
  { displayName: 'Marcus Chen',      email: 'marcus@example.com', slug: 'marcus-chen',   notes: 'Critique partner, focuses on pacing' },
  { displayName: 'Sofia Andrade',    email: 'sofia@example.com',  slug: 'sofia-andrade', notes: 'Sensitivity reader' },
  { displayName: 'James Whitfield',  email: null,                 slug: 'james-whitfield', notes: 'Anonymous beta reader' },
];

const GROUPS = [
  { name: 'Early Readers',     slug: 'early-readers',      description: 'First wave of beta readers' },
  { name: 'Critique Partners', slug: 'critique-partners',  description: 'Deep editing focus' },
];

// versionIdx: index into allDocVersions
//   4 = "migrate 2 neon" (640159f9) — text uses "who" (old spelling)
//   5 = "folder tabs look good now" (4e81fb96)
//   6 = "updates" (9667513a)
//  15 = 3287d1c0 — text uses "who", skioula present
//  16 = 114104d5 — text uses "whom", skioula present
//  17 = "formatting" (74c1ddfd) — latest
// readerIdx: index into READERS / sessionIds (-1 = anonymous session, seeded separately)
// selectedText must match the rendered text content verbatim (markdown syntax stripped).
const LATEST = 17;

// ─── Chapter 1 comments ─────────────────────────────────────────────────────

const COMMENTS_C1: Array<{ selectedText: string; body: string; readerIdx: number; versionIdx: number }> = [
  // ── v4 (640159f9): Diana and Marcus ───────────────────────────────────────
  {
    selectedText: 'there lived a shadow. A shadow should love who its owner loves and hate those who treat him badly.',
    body: 'That first line lands so hard. "A shadow should love who its owner loves" is a beautiful, strange rule. Sets up the whole tragedy in one breath.',
    readerIdx: 0, versionIdx: 4,
  },
  {
    selectedText: 'there lived a shadow. A shadow should love who its owner loves and hate those who treat him badly.',
    body: 'The opening hook is wonderful — dropped right into the mythology without exposition. But "shadow" feels abstract; could you give us a small physical detail in the first sentence to anchor the reader?',
    readerIdx: 1, versionIdx: 4,
  },
  {
    selectedText: 'He called her skioula, little shade, because he caught her peeping at him from behind a curtain.',
    body: 'I love *skioula*. The intimacy of a nickname this early does so much work. Could we feel more of her physical response here — a held breath, a heat in the cheeks?',
    readerIdx: 0, versionIdx: 4,
  },
  {
    selectedText: 'Did you eat a bees\' nest? Is this belly filled with cleverness and honey?',
    body: 'The father\'s speech is delightful — "Did you eat a bees\' nest?" is a keeper. His joy vs the king\'s coldness works as early foreshadowing.',
    readerIdx: 0, versionIdx: 4,
  },
  {
    selectedText: 'The look in her beloved prince\'s eyes as they spoke — half yearning to please, half hopeless — made her want to hate the king, but she could not.',
    body: 'The contrast between King Oeagrus with other children vs. with Orpheus is quietly devastating. I wonder if you could slow down here for one more sentence — let us sit with that look in Orpheus\'s eyes.',
    readerIdx: 1, versionIdx: 4,
  },

  // ── v5 (4e81fb96): Sofia ──────────────────────────────────────────────────
  {
    selectedText: 'there lived a shadow. A shadow should love who its owner loves and hate those who treat him badly.',
    body: 'Coming back to this on the revision — I\'d wondered if the second sentence was redundant, but it isn\'t. It does the work of establishing the stakes quietly. Keep it.',
    readerIdx: 2, versionIdx: 5,
  },
  {
    selectedText: 'always, always Hesypera listened, and in this way learned many things.',
    body: 'Her role as observer/listener is established really well. It mirrors Orpheus\'s role as singer — she absorbs, he expresses. This duality is going to pay off beautifully.',
    readerIdx: 2, versionIdx: 5,
  },
  {
    selectedText: 'Good times pass in a blur; only in hindsight do you recognize them as happiness. It takes shock and misery and fear to pull life into sharp focus.',
    body: 'This line hit me hard. It reframes everything that came before as the good times Hesypera couldn\'t name. The pacing earns this reflection perfectly.',
    readerIdx: 2, versionIdx: 5,
  },

  // ── v6 (9667513a): James ──────────────────────────────────────────────────
  {
    selectedText: 'Night after night King Oeagrus, thunder-browed, watched the slender figure of his heir roam the banks of the Hebrus and sing.',
    body: 'Thunder-browed is vivid but I\'m not sure it fits the register of the rest of the prose. Feels slightly archaic compared to the nimbler sentences around it.',
    readerIdx: 3, versionIdx: 6,
  },
  {
    selectedText: 'He was quicksilver where the king was iron, with wrists like a lark\'s whistle and a body corded with lean muscle.',
    body: 'The quicksilver/iron contrast is doing a lot of work here. Strong. But "wrists like a lark\'s whistle" is a synesthetic stretch — I had to re-read it twice.',
    readerIdx: 3, versionIdx: 6,
  },
  {
    selectedText: 'simply happy he existed, that she breathed the same air as him, that she alone was welcome to go wherever he went',
    body: 'The accumulation of "that she… that she… that she" works rhythmically but the passage lingers just a beat too long for me. Cutting the last clause might sharpen it.',
    readerIdx: 3, versionIdx: 6,
  },

  // ── v15 (3287d1c0): Diana and Marcus re-read ─────────────────────────────
  {
    selectedText: 'Night after night King Oeagrus, thunder-browed, watched the slender figure of his heir roam the banks of the Hebrus and sing.',
    body: 'I\'ve come around on thunder-browed. It works because it echoes the mythological register without overplaying it.',
    readerIdx: 0, versionIdx: 15,
  },
  {
    selectedText: 'Good times pass in a blur; only in hindsight do you recognize them as happiness. It takes shock and misery and fear to pull life into sharp focus.',
    body: 'This is the emotional crux of the chapter. The sentence rhythm — short, then long — is exactly right.',
    readerIdx: 1, versionIdx: 15,
  },
  {
    selectedText: 'One bare foot beat time against the wall as he sang.',
    body: 'The "beat time" revision is better than the old "beat out a rhythm." More musical, less wordy.',
    readerIdx: 1, versionIdx: 15,
  },

  // ── v16 (114104d5): Sofia and James re-read ──────────────────────────────
  {
    selectedText: 'A shadow should love whom its owner loves and hate those who treat him badly, but loyalty is rarely that easy.',
    body: 'The "whom" correction is subtle but it lifts the register. Feels more like a fable now.',
    readerIdx: 2, versionIdx: 16,
  },
  {
    selectedText: 'simply happy he existed, that she breathed the same air as him, that she alone was welcome to go wherever he went',
    body: 'I was wrong before — the rhythm here needs every clause. Don\'t cut anything.',
    readerIdx: 3, versionIdx: 16,
  },
  {
    selectedText: 'Night after night King Oeagrus, thunder-browed, watched the slender figure of his heir roam the banks of the Hebrus and sing.',
    body: 'Still not sold on thunder-browed. Every other descriptor in this chapter is nimbler.',
    readerIdx: 3, versionIdx: 16,
  },

  // ── v17 / LATEST (74c1ddfd): all readers + anonymous ─────────────────────
  {
    selectedText: 'A shadow should love whom its owner loves and hate those who treat him badly, but loyalty is rarely that easy.',
    body: 'Re-reading after all the edits — "whom" is better than the old "who". The opening still lands perfectly.',
    readerIdx: 0, versionIdx: LATEST,
  },
  {
    selectedText: 'He called her skioula, little shade, because he caught her peeping at him from behind a curtain.',
    body: 'This still might be my favorite line in the whole chapter. The tenderness of the nickname does so much.',
    readerIdx: 0, versionIdx: LATEST,
  },
  {
    selectedText: 'Night after night King Oeagrus, thunder-browed, watched the slender figure of his heir roam the banks of the Hebrus and sing.',
    body: 'On a second pass, I think thunder-browed is perfect actually. It sets Oeagrus apart from Orpheus in a single stroke.',
    readerIdx: 1, versionIdx: LATEST,
  },
  {
    selectedText: 'Good times pass in a blur; only in hindsight do you recognize them as happiness. It takes shock and misery and fear to pull life into sharp focus.',
    body: 'Still the strongest paragraph in the chapter. The shift from warmth to foreboding is seamless.',
    readerIdx: 2, versionIdx: LATEST,
  },
  {
    selectedText: 'simply happy he existed, that she breathed the same air as him, that she alone was welcome to go wherever he went',
    body: 'OK I take back what I said in the last round — the rhythm here is deliberate and earned. The repetition mirrors her devotion.',
    readerIdx: 3, versionIdx: LATEST,
  },
];

// Anonymous comments for latest version (readerIdx -1, seeded separately in main)
const ANON_COMMENTS_C1: Array<{ selectedText: string; body: string; versionIdx: number }> = [
  { selectedText: 'She hadn\'t meant to stare, or more precisely to be caught staring', body: 'i don\'t think you need this sentence', versionIdx: LATEST },
  { selectedText: 'One bare foot beat time against the wall as he sang.', body: 'have a hard time picturing this', versionIdx: LATEST },
  { selectedText: 'Brygias Archon?"', body: 'is this a title?', versionIdx: LATEST },
];

// ─── Chapter 2 comments ─────────────────────────────────────────────────────

const COMMENTS_C2: Array<{ selectedText: string; body: string; readerIdx: number; versionIdx: number }> = [
  // ── v4 ────────────────────────────────────────────────────────────────────
  {
    selectedText: 'The Lady Olyxena was like no noblewoman Hesypera had ever met. Everything about her was loud and undignified and careless.',
    body: 'Olyxena\'s introduction is immediately warm and specific. The contrast with Eurydice set up on the next page is effective.',
    readerIdx: 0, versionIdx: 4,
  },
  {
    selectedText: 'They whispered that her father was a wood-god, a servant of Pan, that there was bewitchment in her.',
    body: 'The "wood-god father" rumor is tantalizing. I want just slightly more — a detail that makes us believe it before we dismiss it.',
    readerIdx: 1, versionIdx: 4,
  },
  // ── v5 ────────────────────────────────────────────────────────────────────
  {
    selectedText: 'An odd scent hung about Eurydice wherever she went, a smell like crushed stems and darkened pools',
    body: 'The smell description (crushed stems, darkened pools) is excellent. Very sensory. Sets Eurydice apart without othering her clumsily.',
    readerIdx: 2, versionIdx: 5,
  },
  {
    selectedText: 'Her moods were as unpredictable as storms in the spring: sudden sunshine and frightening temper.',
    body: 'This is a neat summary line but it tells rather than shows. Could this be dramatised in a small scene instead?',
    readerIdx: 2, versionIdx: 5,
  },
  // ── v15 ───────────────────────────────────────────────────────────────────
  {
    selectedText: 'The Lady Olyxena was like no noblewoman Hesypera had ever met. Everything about her was loud and undignified and careless.',
    body: 'Olyxena still feels fully alive every time I re-read this. The contrast with Eurydice is sharper now.',
    readerIdx: 0, versionIdx: 15,
  },
  {
    selectedText: 'An odd scent hung about Eurydice wherever she went, a smell like crushed stems and darkened pools',
    body: 'The scent imagery has grown on me. It does the work of setting Eurydice apart without a single line of exposition.',
    readerIdx: 1, versionIdx: 15,
  },
  // ── v16 ───────────────────────────────────────────────────────────────────
  {
    selectedText: 'Her moods were as unpredictable as storms in the spring: sudden sunshine and frightening temper.',
    body: 'I still think this tells more than it shows. But it\'s a minor quibble now — the chapter earns it.',
    readerIdx: 2, versionIdx: 16,
  },
  {
    selectedText: 'They whispered that her father was a wood-god, a servant of Pan, that there was bewitchment in her.',
    body: 'This rumor is doing double duty now — foreshadowing and world-building. Stronger than I first thought.',
    readerIdx: 3, versionIdx: 16,
  },
  // ── v17 / LATEST ──────────────────────────────────────────────────────────
  {
    selectedText: 'The Lady Olyxena was like no noblewoman Hesypera had ever met. Everything about her was loud and undignified and careless.',
    body: 'Olyxena still pops off the page. The trio of adjectives — loud, undignified, careless — is just right.',
    readerIdx: 0, versionIdx: LATEST,
  },
  {
    selectedText: 'They whispered that her father was a wood-god, a servant of Pan, that there was bewitchment in her.',
    body: 'The wood-god detail works even better now. It seeds doubt without making Eurydice a villain.',
    readerIdx: 1, versionIdx: LATEST,
  },
];

// ─── Chapter 1 suggested edits ──────────────────────────────────────────────

const EDITS_C1: Array<{ original: string; suggested: string; rationale: string | null; readerIdx: number; versionIdx: number }> = [
  // ── v5: Sofia ─────────────────────────────────────────────────────────────
  {
    original: 'Good times pass in a blur; only in hindsight do you recognize them as happiness.',
    suggested: 'Good times pass in a blur; only in grief do you recognise them as happiness.',
    rationale: '"In grief" is more specific and emotionally charged than "in hindsight" — it anticipates Eurydice\'s death without spelling it out.',
    readerIdx: 2, versionIdx: 5,
  },
  // ── v16: Marcus ───────────────────────────────────────────────────────────
  {
    original: 'One bare foot beat time against the wall as he sang.',
    suggested: 'One bare foot beat time against the stone wall as he sang.',
    rationale: '"Stone" gives the palace a tactile quality — you can feel the cold against his foot.',
    readerIdx: 1, versionIdx: 16,
  },
  // ── v17 / LATEST: Marcus + anonymous ──────────────────────────────────────
  {
    original: 'One bare foot beat time against the wall as he sang.',
    suggested: 'One bare foot beat time against the stone wall as he sang.',
    rationale: '"Stone" gives the palace a tactile quality — you can feel the cold against his foot.',
    readerIdx: 1, versionIdx: LATEST,
  },
];

// Anonymous edits for latest version
const ANON_EDITS_C1: Array<{ original: string; suggested: string; rationale: string | null; versionIdx: number }> = [
  { original: 'She\'d heard the music', suggested: 'She\'d simply heard the music ', rationale: null, versionIdx: LATEST },
  { original: 'hair bleached silver by', suggested: 'hair bleached by', rationale: null, versionIdx: LATEST },
];

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🌱 Starting seed...\n');

  await ensureSchema();

  // Upsert work
  const workSlug = 'orpheus';
  const workTitle = 'After Eurydice';
  const [work] = await sql`
    INSERT INTO works (slug, title)
    VALUES (${workSlug}, ${workTitle})
    ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title
    RETURNING id
  `;
  const workId = work.id as string;
  console.log(`✓ work: ${workTitle} (${workId.slice(0, 8)}…)`);

  // ── Wipe only feedback data (not document/chapter versions) ──────────────
  console.log('\n🗑  Wiping feedback data for this work…');
  await sql`
    DELETE FROM feedback_reactions WHERE chapter_version_id IN (
      SELECT cv.id FROM chapter_versions cv JOIN chapters c ON c.id = cv.chapter_id WHERE c.work_id = ${workId}
    )
  `;
  await sql`
    DELETE FROM feedback_comments WHERE chapter_version_id IN (
      SELECT cv.id FROM chapter_versions cv JOIN chapters c ON c.id = cv.chapter_id WHERE c.work_id = ${workId}
    )
  `;
  await sql`
    DELETE FROM suggested_edits WHERE chapter_version_id IN (
      SELECT cv.id FROM chapter_versions cv JOIN chapters c ON c.id = cv.chapter_id WHERE c.work_id = ${workId}
    )
  `;
  await sql`
    DELETE FROM chapter_reads WHERE chapter_version_id IN (
      SELECT cv.id FROM chapter_versions cv JOIN chapters c ON c.id = cv.chapter_id WHERE c.work_id = ${workId}
    )
  `;
  console.log('  ✓ wiped feedback data');

  // ── Ingest historical commits (idempotent — skips if already present) ─────
  console.log('\n📖 Ingesting historical commits…');

  const git = simpleGit(process.cwd());
  const logResult = await git.log({ file: 'chapters/' });
  const commits: CommitInfo[] = logResult.all.map(c => ({
    sha: c.hash,
    message: c.message,
    author: c.author_name,
    date: c.date,
  }));

  // Process oldest → newest
  const orderedCommits = [...commits].reverse();

  const chapterFiles = ['chapter-01.md', 'chapter-02.md', 'chapter-03.md', 'chapter-X.md'];
  const documentVersionIds: string[] = [];

  for (const commit of orderedCommits) {
    console.log(`  commit ${commit.sha.slice(0, 8)}: ${commit.message}`);
    const dvId = await ingestCommit(workId, commit, chapterFiles);
    documentVersionIds.push(dvId);
  }

  const latestCommit = orderedCommits[orderedCommits.length - 1];
  console.log(`✓ latest commit: ${latestCommit.sha.slice(0, 8)}`);

  // ── Reader profiles ─────────────────────────────────────────────────────────
  console.log('\n👥 Creating reader profiles…');
  const readerIds: string[] = [];
  for (const r of READERS) {
    const [rp] = await sql`
      INSERT INTO reader_profiles (work_id, slug, display_name, email, notes)
      VALUES (${workId}, ${r.slug}, ${r.displayName}, ${r.email}, ${r.notes})
      ON CONFLICT (work_id, slug) DO UPDATE SET display_name = EXCLUDED.display_name
      RETURNING id
    `;
    readerIds.push(rp.id as string);
    console.log(`  ✓ ${r.displayName}`);
  }

  // ── Groups ──────────────────────────────────────────────────────────────────
  console.log('\n🏷  Creating groups…');
  const groupIds: string[] = [];
  for (const g of GROUPS) {
    const [grp] = await sql`
      INSERT INTO reader_groups (work_id, slug, name, description)
      VALUES (${workId}, ${g.slug}, ${g.name}, ${g.description})
      ON CONFLICT (work_id, slug) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `;
    groupIds.push(grp.id as string);
    console.log(`  ✓ ${g.name}`);
  }

  // Memberships: Diana + Marcus → Early Readers; Marcus + Sofia → Critique Partners
  const memberships = [
    [readerIds[0], groupIds[0]], [readerIds[1], groupIds[0]],
    [readerIds[1], groupIds[1]], [readerIds[2], groupIds[1]],
  ];
  for (const [rId, gId] of memberships) {
    await sql`
      INSERT INTO reader_group_memberships (reader_profile_id, reader_group_id)
      VALUES (${rId}, ${gId})
      ON CONFLICT DO NOTHING
    `;
  }

  // ── Invites ─────────────────────────────────────────────────────────────────
  console.log('\n🔗 Creating invite links…');
  const inviteIds: string[] = [];
  for (let i = 0; i < READERS.length; i++) {
    const token = READERS[i].slug;
    const [inv] = await sql`
      INSERT INTO reader_invites (work_id, token, reader_profile_id, label)
      VALUES (${workId}, ${token}, ${readerIds[i]}, ${READERS[i].displayName + ' personal link'})
      ON CONFLICT (token) DO UPDATE SET label = EXCLUDED.label
      RETURNING id
    `;
    inviteIds.push(inv.id as string);
  }
  // Group invite
  const [groupInv] = await sql`
    INSERT INTO reader_invites (work_id, token, reader_group_id, label)
    VALUES (${workId}, ${'early-readers'}, ${groupIds[0]}, 'Early Readers group link')
    ON CONFLICT (token) DO UPDATE SET label = EXCLUDED.label
    RETURNING id
  `;
  console.log(`  ✓ ${READERS.length + 1} invites created`);

  // ── Sessions ────────────────────────────────────────────────────────────────
  console.log('\n🌐 Creating reader sessions…');
  const sessionIds: string[] = [];
  for (let i = 0; i < READERS.length; i++) {
    const anonId = `anon-seed-${READERS[i].slug}`;
    const [sess] = await sql`
      INSERT INTO reader_sessions (work_id, anonymous_id, reader_profile_id, reader_group_id, reader_invite_id)
      VALUES (${workId}, ${anonId}, ${readerIds[i]}, ${i < 2 ? groupIds[0] : (i === 2 ? groupIds[1] : null)}, ${inviteIds[i]})
      ON CONFLICT DO NOTHING
      RETURNING id
    `;
    // In case of conflict, look up existing
    if (!sess) {
      const [existing] = await sql`SELECT id FROM reader_sessions WHERE work_id = ${workId} AND anonymous_id = ${anonId}`;
      sessionIds.push(existing.id as string);
    } else {
      sessionIds.push(sess.id as string);
    }
  }
  console.log(`  ✓ ${sessionIds.length} sessions created`);

  // ── Anonymous sessions (extra readers for retention curve variety) ───────────
  console.log('\n👻 Creating anonymous sessions for retention data…');
  const anonSessionIds: string[] = [];
  const ANON_COUNT = 8;
  for (let i = 0; i < ANON_COUNT; i++) {
    const anonId = `anon-seed-extra-${i}`;
    const [sess] = await sql`
      INSERT INTO reader_sessions (work_id, anonymous_id)
      VALUES (${workId}, ${anonId})
      ON CONFLICT DO NOTHING
      RETURNING id
    `;
    if (!sess) {
      const [existing] = await sql`SELECT id FROM reader_sessions WHERE work_id = ${workId} AND anonymous_id = ${anonId}`;
      anonSessionIds.push(existing.id as string);
    } else {
      anonSessionIds.push(sess.id as string);
    }
  }
  console.log(`  ✓ ${anonSessionIds.length} anonymous sessions created`);

  // ── Get ALL chapter versions across every ingested commit ────────────────────
  console.log('\n📚 Getting all chapter versions…');

  const allDocVersions = await sql`
    SELECT id, commit_sha FROM document_versions
    WHERE work_id = ${workId}
    ORDER BY deployed_at
  `;

  if (allDocVersions.length === 0) {
    console.error('No document versions found — ingest may have failed');
    process.exit(1);
  }

  // ── All reactions now use versionIdx (like comments/edits) ──────────────────

  type Reaction = { selectedText: string; reaction: 'like' | 'dislike'; readerIdx: number; versionIdx: number };

  const c1Reactions: Reaction[] = [
    // ── v4 (640159f9): readers 0-2 ──────────────────────────────────────────
    { selectedText: 'A shadow should love who its owner loves and hate those who treat him badly.', reaction: 'like',    readerIdx: 0, versionIdx: 4 },
    { selectedText: 'A shadow should love who its owner loves and hate those who treat him badly.', reaction: 'like',    readerIdx: 1, versionIdx: 4 },
    { selectedText: 'A shadow should love who its owner loves and hate those who treat him badly.', reaction: 'like',    readerIdx: 2, versionIdx: 4 },
    { selectedText: 'his fingers danced lazily but expertly over the strings of his kithara as he sang.', reaction: 'like', readerIdx: 0, versionIdx: 4 },
    { selectedText: 'his fingers danced lazily but expertly over the strings of his kithara as he sang.', reaction: 'like', readerIdx: 1, versionIdx: 4 },
    { selectedText: 'his fingers danced lazily but expertly over the strings of his kithara as he sang.', reaction: 'like', readerIdx: 2, versionIdx: 4 },
    { selectedText: "Did you eat a bees' nest? Is this belly filled with cleverness and honey?", reaction: 'like', readerIdx: 0, versionIdx: 4 },
    { selectedText: "Did you eat a bees' nest? Is this belly filled with cleverness and honey?", reaction: 'like', readerIdx: 1, versionIdx: 4 },
    { selectedText: "Did you eat a bees' nest? Is this belly filled with cleverness and honey?", reaction: 'like', readerIdx: 2, versionIdx: 4 },
    { selectedText: 'Night after night King Oeagrus, thunder-browed, watched the slender figure of his heir roam the banks of the Hebrus and sing.', reaction: 'like',    readerIdx: 0, versionIdx: 4 },
    { selectedText: 'Night after night King Oeagrus, thunder-browed, watched the slender figure of his heir roam the banks of the Hebrus and sing.', reaction: 'like',    readerIdx: 1, versionIdx: 4 },
    { selectedText: 'Night after night King Oeagrus, thunder-browed, watched the slender figure of his heir roam the banks of the Hebrus and sing.', reaction: 'dislike', readerIdx: 2, versionIdx: 4 },
    { selectedText: 'Good times pass in a blur; only in hindsight do you recognize them as happiness. It takes shock and misery and fear to pull life into sharp focus.', reaction: 'like', readerIdx: 0, versionIdx: 4 },
    { selectedText: 'Good times pass in a blur; only in hindsight do you recognize them as happiness. It takes shock and misery and fear to pull life into sharp focus.', reaction: 'like', readerIdx: 1, versionIdx: 4 },
    { selectedText: 'Good times pass in a blur; only in hindsight do you recognize them as happiness. It takes shock and misery and fear to pull life into sharp focus.', reaction: 'like', readerIdx: 2, versionIdx: 4 },
    { selectedText: 'He was quicksilver where the king was iron, with wrists like a lark\'s whistle and a body corded with lean muscle.', reaction: 'like',    readerIdx: 0, versionIdx: 4 },
    { selectedText: 'He was quicksilver where the king was iron, with wrists like a lark\'s whistle and a body corded with lean muscle.', reaction: 'like',    readerIdx: 2, versionIdx: 4 },
    { selectedText: 'He was quicksilver where the king was iron, with wrists like a lark\'s whistle and a body corded with lean muscle.', reaction: 'dislike', readerIdx: 1, versionIdx: 4 },
    { selectedText: 'simply happy he existed, that she breathed the same air as him, that she alone was welcome to go wherever he went, that she would spend the rest of her life listening to his voice echo in the river.', reaction: 'like',    readerIdx: 0, versionIdx: 4 },
    { selectedText: 'simply happy he existed, that she breathed the same air as him, that she alone was welcome to go wherever he went, that she would spend the rest of her life listening to his voice echo in the river.', reaction: 'like',    readerIdx: 2, versionIdx: 4 },
    { selectedText: 'simply happy he existed, that she breathed the same air as him, that she alone was welcome to go wherever he went, that she would spend the rest of her life listening to his voice echo in the river.', reaction: 'dislike', readerIdx: 1, versionIdx: 4 },
    { selectedText: 'The great joy the king would have surely taken in fatherhood was tainted before the prince was one day old.', reaction: 'like', readerIdx: 0, versionIdx: 4 },
    { selectedText: 'The great joy the king would have surely taken in fatherhood was tainted before the prince was one day old.', reaction: 'like', readerIdx: 1, versionIdx: 4 },
    { selectedText: 'The great joy the king would have surely taken in fatherhood was tainted before the prince was one day old.', reaction: 'like', readerIdx: 2, versionIdx: 4 },

    // ── v5 (4e81fb96): reader 3 (James) ─────────────────────────────────────
    { selectedText: 'A shadow should love who its owner loves and hate those who treat him badly.', reaction: 'dislike', readerIdx: 3, versionIdx: 5 },
    { selectedText: 'his fingers danced lazily but expertly over the strings of his kithara as he sang.', reaction: 'like', readerIdx: 3, versionIdx: 5 },
    { selectedText: "Did you eat a bees' nest? Is this belly filled with cleverness and honey?", reaction: 'dislike', readerIdx: 3, versionIdx: 5 },
    { selectedText: 'Night after night King Oeagrus, thunder-browed, watched the slender figure of his heir roam the banks of the Hebrus and sing.', reaction: 'dislike', readerIdx: 3, versionIdx: 5 },
    { selectedText: 'Good times pass in a blur; only in hindsight do you recognize them as happiness. It takes shock and misery and fear to pull life into sharp focus.', reaction: 'like', readerIdx: 3, versionIdx: 5 },
    { selectedText: 'He was quicksilver where the king was iron, with wrists like a lark\'s whistle and a body corded with lean muscle.', reaction: 'dislike', readerIdx: 3, versionIdx: 5 },
    { selectedText: 'simply happy he existed, that she breathed the same air as him, that she alone was welcome to go wherever he went, that she would spend the rest of her life listening to his voice echo in the river.', reaction: 'like', readerIdx: 3, versionIdx: 5 },
    { selectedText: 'The great joy the king would have surely taken in fatherhood was tainted before the prince was one day old.', reaction: 'like', readerIdx: 3, versionIdx: 5 },

    // ── v15 (3287d1c0): Diana and Marcus ─────────────────────────────────────
    { selectedText: 'Night after night King Oeagrus, thunder-browed, watched the slender figure of his heir roam the banks of the Hebrus and sing.', reaction: 'like', readerIdx: 0, versionIdx: 15 },
    { selectedText: 'Night after night King Oeagrus, thunder-browed, watched the slender figure of his heir roam the banks of the Hebrus and sing.', reaction: 'like', readerIdx: 1, versionIdx: 15 },
    { selectedText: 'Good times pass in a blur; only in hindsight do you recognize them as happiness. It takes shock and misery and fear to pull life into sharp focus.', reaction: 'like', readerIdx: 0, versionIdx: 15 },
    { selectedText: 'Good times pass in a blur; only in hindsight do you recognize them as happiness. It takes shock and misery and fear to pull life into sharp focus.', reaction: 'like', readerIdx: 1, versionIdx: 15 },
    { selectedText: 'One bare foot beat time against the wall as he sang.', reaction: 'like', readerIdx: 1, versionIdx: 15 },
    { selectedText: 'simply happy he existed, that she breathed the same air as him, that she alone was welcome to go wherever he went', reaction: 'like', readerIdx: 0, versionIdx: 15 },

    // ── v16 (114104d5): Sofia and James ──────────────────────────────────────
    { selectedText: 'A shadow should love whom its owner loves and hate those who treat him badly, but loyalty is rarely that easy.', reaction: 'like', readerIdx: 2, versionIdx: 16 },
    { selectedText: 'A shadow should love whom its owner loves and hate those who treat him badly, but loyalty is rarely that easy.', reaction: 'like', readerIdx: 3, versionIdx: 16 },
    { selectedText: 'Night after night King Oeagrus, thunder-browed, watched the slender figure of his heir roam the banks of the Hebrus and sing.', reaction: 'dislike', readerIdx: 3, versionIdx: 16 },
    { selectedText: 'Good times pass in a blur; only in hindsight do you recognize them as happiness. It takes shock and misery and fear to pull life into sharp focus.', reaction: 'like', readerIdx: 2, versionIdx: 16 },
    { selectedText: 'simply happy he existed, that she breathed the same air as him, that she alone was welcome to go wherever he went', reaction: 'like', readerIdx: 3, versionIdx: 16 },

    // ── v17 / LATEST (74c1ddfd): all readers + anonymous ─────────────────────
    { selectedText: 'A shadow should love whom its owner loves and hate those who treat him badly, but loyalty is rarely that easy.', reaction: 'like', readerIdx: 0, versionIdx: LATEST },
    { selectedText: 'A shadow should love whom its owner loves and hate those who treat him badly, but loyalty is rarely that easy.', reaction: 'like', readerIdx: 1, versionIdx: LATEST },
    { selectedText: 'A shadow should love whom its owner loves and hate those who treat him badly, but loyalty is rarely that easy.', reaction: 'like', readerIdx: 2, versionIdx: LATEST },
    { selectedText: 'A shadow should love whom its owner loves and hate those who treat him badly, but loyalty is rarely that easy.', reaction: 'dislike', readerIdx: 3, versionIdx: LATEST },
    { selectedText: 'He called her skioula, little shade, because he caught her peeping at him from behind a curtain.', reaction: 'like', readerIdx: 0, versionIdx: LATEST },
    { selectedText: 'He called her skioula, little shade, because he caught her peeping at him from behind a curtain.', reaction: 'like', readerIdx: 2, versionIdx: LATEST },
    { selectedText: 'Night after night King Oeagrus, thunder-browed, watched the slender figure of his heir roam the banks of the Hebrus and sing.', reaction: 'like', readerIdx: 1, versionIdx: LATEST },
    { selectedText: 'Night after night King Oeagrus, thunder-browed, watched the slender figure of his heir roam the banks of the Hebrus and sing.', reaction: 'dislike', readerIdx: 3, versionIdx: LATEST },
    { selectedText: 'Good times pass in a blur; only in hindsight do you recognize them as happiness. It takes shock and misery and fear to pull life into sharp focus.', reaction: 'like', readerIdx: 0, versionIdx: LATEST },
    { selectedText: 'Good times pass in a blur; only in hindsight do you recognize them as happiness. It takes shock and misery and fear to pull life into sharp focus.', reaction: 'like', readerIdx: 1, versionIdx: LATEST },
    { selectedText: 'Good times pass in a blur; only in hindsight do you recognize them as happiness. It takes shock and misery and fear to pull life into sharp focus.', reaction: 'like', readerIdx: 2, versionIdx: LATEST },
    { selectedText: 'Good times pass in a blur; only in hindsight do you recognize them as happiness. It takes shock and misery and fear to pull life into sharp focus.', reaction: 'like', readerIdx: 3, versionIdx: LATEST },
  ];

  // Anonymous reactions for latest version
  const c1AnonReactions: Array<{ selectedText: string; reaction: 'like' | 'dislike'; versionIdx: number }> = [
    { selectedText: 'Once upon a time, on the banks of the river Hebrus, in a land that would one day be known as Thrace, there lived a shadow. A shadow should love whom its owner loves and hate those who treat him badly, but loyalty is rarely that easy.', reaction: 'like', versionIdx: LATEST },
    { selectedText: 'Once upon a time,', reaction: 'dislike', versionIdx: LATEST },
    { selectedText: 'Once upon a time, on the banks of the river Hebrus, in a land that would one day be known as Thrace, there lived a shadow.', reaction: 'like', versionIdx: LATEST },
    { selectedText: 'A shadow should love whom its owner loves and hate those who treat him badly, but loyalty is rarely that easy.', reaction: 'like', versionIdx: LATEST },
    { selectedText: 'It had been a warm, windy night when the prince first turned to her with a smile and named her. He called her skioula, little shade, because he caught her peeping at him from behind a curtain.', reaction: 'like', versionIdx: LATEST },
    { selectedText: 'carelessly', reaction: 'dislike', versionIdx: LATEST },
    { selectedText: 'carelessly', reaction: 'dislike', versionIdx: LATEST },
    { selectedText: 'carelessly', reaction: 'dislike', versionIdx: LATEST },
    { selectedText: 'carelessly', reaction: 'dislike', versionIdx: LATEST },
    { selectedText: 'The sun died early\n\nThe moon cared little\n\nHe sang secrets to the sparrows\n\nShe overheard and stole them', reaction: 'like', versionIdx: LATEST },
    { selectedText: 'The sun died early\n\nThe moon cared little\n\nHe sang secrets to the sparrows\n\nShe overheard and stole them', reaction: 'like', versionIdx: LATEST },
    { selectedText: 'The sun died early\n\nThe moon cared little\n\nHe sang secrets to the sparrows\n\nShe overheard and stole them', reaction: 'like', versionIdx: LATEST },
    { selectedText: 'The sun died early\n\nThe moon cared little\n\nHe sang secrets to the sparrows\n\nShe overheard and stole them', reaction: 'like', versionIdx: LATEST },
    { selectedText: 'The moon cared little\n\nHe sang secrets to the sparrows\n\nShe overheard and stole them', reaction: 'like', versionIdx: LATEST },
    { selectedText: 'She overheard and stole them', reaction: 'dislike', versionIdx: LATEST },
    { selectedText: 'She\'d simply heard the music faintly from some distant hall and walked towards it in a trance.', reaction: 'like', versionIdx: LATEST },
  ];

  const c2Reactions: Reaction[] = [
    // ── v4 ──────────────────────────────────────────────────────────────────
    { selectedText: 'Everything about her was loud and undignified and careless. But she was easy to love', reaction: 'like', readerIdx: 0, versionIdx: 4 },
    { selectedText: 'Her moods were as unpredictable as storms in the spring: sudden sunshine and frightening temper.', reaction: 'like', readerIdx: 1, versionIdx: 4 },
    { selectedText: 'An odd scent hung about Eurydice wherever she went, a smell like crushed stems and darkened pools', reaction: 'like', readerIdx: 2, versionIdx: 4 },
    { selectedText: "A man couldn't get away from his shadow, could he, even if he wanted to? And I'd never want to.", reaction: 'like', readerIdx: 0, versionIdx: 4 },
    { selectedText: "A man couldn't get away from his shadow, could he, even if he wanted to? And I'd never want to.", reaction: 'like', readerIdx: 2, versionIdx: 4 },
    { selectedText: 'The moon hung heavy in the sky and the homelike Hebrus became a different river entirely, dark and seemingly endless.', reaction: 'like', readerIdx: 2, versionIdx: 4 },
    // ── v5 ──────────────────────────────────────────────────────────────────
    { selectedText: 'She burned against the darkness, her face tipped back to drink up the moon.', reaction: 'like', readerIdx: 3, versionIdx: 5 },
    { selectedText: 'She laid down her needlework and, almost without knowing what she was doing, walked over to join Eurydice.', reaction: 'dislike', readerIdx: 3, versionIdx: 5 },
    // ── v15 ─────────────────────────────────────────────────────────────────
    { selectedText: 'The Lady Olyxena was like no noblewoman Hesypera had ever met. Everything about her was loud and undignified and careless.', reaction: 'like', readerIdx: 0, versionIdx: 15 },
    { selectedText: 'An odd scent hung about Eurydice wherever she went, a smell like crushed stems and darkened pools', reaction: 'like', readerIdx: 1, versionIdx: 15 },
    // ── v16 ─────────────────────────────────────────────────────────────────
    { selectedText: 'Her moods were as unpredictable as storms in the spring: sudden sunshine and frightening temper.', reaction: 'dislike', readerIdx: 3, versionIdx: 16 },
    { selectedText: 'They whispered that her father was a wood-god, a servant of Pan, that there was bewitchment in her.', reaction: 'like', readerIdx: 2, versionIdx: 16 },
    // ── v17 / LATEST ────────────────────────────────────────────────────────
    { selectedText: 'The Lady Olyxena was like no noblewoman Hesypera had ever met. Everything about her was loud and undignified and careless.', reaction: 'like', readerIdx: 0, versionIdx: LATEST },
    { selectedText: 'They whispered that her father was a wood-god, a servant of Pan, that there was bewitchment in her.', reaction: 'like', readerIdx: 1, versionIdx: LATEST },
    { selectedText: 'An odd scent hung about Eurydice wherever she went, a smell like crushed stems and darkened pools', reaction: 'like', readerIdx: 2, versionIdx: LATEST },
    { selectedText: 'Her moods were as unpredictable as storms in the spring: sudden sunshine and frightening temper.', reaction: 'dislike', readerIdx: 3, versionIdx: LATEST },
  ];

  let totalReactions = 0, totalComments = 0, totalEdits = 0, totalReads = 0;

  console.log('\n💚 Seeding reactions, comments, edits, and reads for all versions…');

  for (const [dvIndex, dv] of allDocVersions.entries()) {
    const cvRows = await sql`
      SELECT cv.id, c.file_path
      FROM chapter_versions cv
      JOIN chapters c ON c.id = cv.chapter_id
      WHERE cv.document_version_id = ${dv.id}
      ORDER BY c.sort_order
    `;

    const c1Id = cvRows.find(v => v.file_path === 'chapter-01.md')?.id as string | undefined;
    const c2Id = cvRows.find(v => v.file_path === 'chapter-02.md')?.id as string | undefined;
    const c3Id = cvRows.find(v => v.file_path === 'chapter-03.md')?.id as string | undefined;
    const cXId = cvRows.find(v => v.file_path === 'chapter-X.md')?.id as string | undefined;

    console.log(`  commit ${(dv.commit_sha as string).slice(0, 8)}: c1=${c1Id?.slice(0,8) ?? 'missing'} c2=${c2Id?.slice(0,8) ?? 'missing'} c3=${c3Id?.slice(0,8) ?? 'missing'} cX=${cXId?.slice(0,8) ?? 'missing'}`);

    if (c1Id) {
      const [c1Ver] = await sql`SELECT rendered_html FROM chapter_versions WHERE id = ${c1Id}`;

      // Known-reader reactions
      const c1ReactionsToSeed = c1Reactions.filter(r => r.versionIdx === dvIndex);
      for (const r of c1ReactionsToSeed) {
        const ri = r.readerIdx;
        const wp = feedbackWordPos(c1Ver.rendered_html, r.selectedText);
        const cp = wp ? wordRangeToCharPos(c1Ver.rendered_html, wp.wordStart, wp.wordEnd) : null;
        await sql`
          INSERT INTO feedback_reactions (reader_session_id, chapter_version_id, reader_profile_id, reader_group_id, reader_invite_id, selected_text, word_start, word_end, char_start, char_length, reaction)
          VALUES (${sessionIds[ri]}, ${c1Id}, ${readerIds[ri]}, ${ri < 2 ? groupIds[0] : (ri === 2 ? groupIds[1] : null)}, ${inviteIds[ri]}, ${r.selectedText}, ${wp?.wordStart ?? null}, ${wp?.wordEnd ?? null}, ${cp?.charStart ?? null}, ${cp?.charLength ?? null}, ${r.reaction})
        `;
      }
      totalReactions += c1ReactionsToSeed.length;

      // Anonymous reactions
      const c1AnonReactionsToSeed = c1AnonReactions.filter(r => r.versionIdx === dvIndex);
      for (const r of c1AnonReactionsToSeed) {
        const wp = feedbackWordPos(c1Ver.rendered_html, r.selectedText);
        const cp = wp ? wordRangeToCharPos(c1Ver.rendered_html, wp.wordStart, wp.wordEnd) : null;
        await sql`
          INSERT INTO feedback_reactions (reader_session_id, chapter_version_id, selected_text, word_start, word_end, char_start, char_length, reaction)
          VALUES (${anonSessionIds[0]}, ${c1Id}, ${r.selectedText}, ${wp?.wordStart ?? null}, ${wp?.wordEnd ?? null}, ${cp?.charStart ?? null}, ${cp?.charLength ?? null}, ${r.reaction})
        `;
      }
      totalReactions += c1AnonReactionsToSeed.length;

      const c1CommentsToSeed = COMMENTS_C1.filter(c => c.versionIdx === dvIndex);
      for (const c of c1CommentsToSeed) {
        const ri = c.readerIdx;
        const wp = feedbackWordPos(c1Ver.rendered_html, c.selectedText);
        const cp = wp ? wordRangeToCharPos(c1Ver.rendered_html, wp.wordStart, wp.wordEnd) : null;
        await sql`
          INSERT INTO feedback_comments (reader_session_id, chapter_version_id, reader_profile_id, reader_group_id, reader_invite_id, selected_text, body, char_start, char_length, word_start, word_end)
          VALUES (${sessionIds[ri]}, ${c1Id}, ${readerIds[ri]}, ${ri < 2 ? groupIds[0] : (ri === 2 ? groupIds[1] : null)}, ${inviteIds[ri]}, ${c.selectedText}, ${c.body}, ${cp?.charStart ?? null}, ${cp?.charLength ?? null}, ${wp?.wordStart ?? null}, ${wp?.wordEnd ?? null})
        `;
      }
      totalComments += c1CommentsToSeed.length;

      const c1EditsToSeed = EDITS_C1.filter(e => e.versionIdx === dvIndex);
      for (const e of c1EditsToSeed) {
        const ri = e.readerIdx;
        const wp = feedbackWordPos(c1Ver.rendered_html, e.original);
        const cp = wp ? wordRangeToCharPos(c1Ver.rendered_html, wp.wordStart, wp.wordEnd) : null;
        await sql`
          INSERT INTO suggested_edits (reader_session_id, chapter_version_id, reader_profile_id, reader_group_id, reader_invite_id, original_text, suggested_text, rationale, char_start, char_length, word_start, word_end)
          VALUES (${sessionIds[ri]}, ${c1Id}, ${readerIds[ri]}, ${ri < 2 ? groupIds[0] : null}, ${inviteIds[ri]}, ${e.original}, ${e.suggested}, ${e.rationale}, ${cp?.charStart ?? null}, ${cp?.charLength ?? null}, ${wp?.wordStart ?? null}, ${wp?.wordEnd ?? null})
        `;
      }
      totalEdits += c1EditsToSeed.length;

      // Anonymous comments for c1
      const c1AnonCommentsToSeed = ANON_COMMENTS_C1.filter(c => c.versionIdx === dvIndex);
      for (const c of c1AnonCommentsToSeed) {
        const wp = feedbackWordPos(c1Ver.rendered_html, c.selectedText);
        const cp = wp ? wordRangeToCharPos(c1Ver.rendered_html, wp.wordStart, wp.wordEnd) : null;
        await sql`
          INSERT INTO feedback_comments (reader_session_id, chapter_version_id, selected_text, body, char_start, char_length, word_start, word_end)
          VALUES (${anonSessionIds[0]}, ${c1Id}, ${c.selectedText}, ${c.body}, ${cp?.charStart ?? null}, ${cp?.charLength ?? null}, ${wp?.wordStart ?? null}, ${wp?.wordEnd ?? null})
        `;
      }
      totalComments += c1AnonCommentsToSeed.length;

      // Anonymous edits for c1
      const c1AnonEditsToSeed = ANON_EDITS_C1.filter(e => e.versionIdx === dvIndex);
      for (const e of c1AnonEditsToSeed) {
        const wp = feedbackWordPos(c1Ver.rendered_html, e.original);
        const cp = wp ? wordRangeToCharPos(c1Ver.rendered_html, wp.wordStart, wp.wordEnd) : null;
        await sql`
          INSERT INTO suggested_edits (reader_session_id, chapter_version_id, original_text, suggested_text, rationale, char_start, char_length, word_start, word_end)
          VALUES (${anonSessionIds[0]}, ${c1Id}, ${e.original}, ${e.suggested}, ${e.rationale}, ${cp?.charStart ?? null}, ${cp?.charLength ?? null}, ${wp?.wordStart ?? null}, ${wp?.wordEnd ?? null})
        `;
      }
      totalEdits += c1AnonEditsToSeed.length;

      // Reads for c1 — known readers (only on their assigned version)
      const c1KnownReads: Array<{ sessionIdx: number; maxLine: number; maxScroll: number; activeSeconds: number; completionPct: number; completed: boolean }> = [
        { sessionIdx: 0, maxLine: 145, maxScroll: 98, activeSeconds: 1240, completionPct: 98, completed: true  },
        { sessionIdx: 1, maxLine: 148, maxScroll: 99, activeSeconds: 1560, completionPct: 99, completed: true  },
        { sessionIdx: 2, maxLine: 150, maxScroll: 99, activeSeconds: 1100, completionPct: 99, completed: true  },
        { sessionIdx: 3, maxLine: 72,  maxScroll: 47, activeSeconds: 620,  completionPct: 47, completed: false },
      ];
      const c1ReadVersions: Record<number, number> = { 0: 4, 1: 4, 2: 4, 3: 5 };
      const c1ReadsToSeed = c1KnownReads.filter(r => c1ReadVersions[r.sessionIdx] === dvIndex);
      for (const r of c1ReadsToSeed) {
        const completedAt = r.completed ? new Date(Date.now() - Math.random() * 86400000 * 7).toISOString() : null;
        await sql`
          INSERT INTO chapter_reads (reader_session_id, chapter_version_id, max_line_seen, max_scroll_percent, active_seconds, completion_percent, completed_at)
          VALUES (${sessionIds[r.sessionIdx]}, ${c1Id}, ${r.maxLine}, ${r.maxScroll}, ${r.activeSeconds}, ${r.completionPct}, ${completedAt})
          ON CONFLICT (reader_session_id, chapter_version_id) DO UPDATE SET
            max_line_seen = EXCLUDED.max_line_seen, max_scroll_percent = EXCLUDED.max_scroll_percent,
            active_seconds = EXCLUDED.active_seconds, completion_percent = EXCLUDED.completion_percent,
            completed_at = EXCLUDED.completed_at
        `;
      }
      totalReads += c1ReadsToSeed.length;

      // Anonymous reads for c1 — only on latest version (last dvIndex) for a rich drop-off curve
      if (dvIndex === allDocVersions.length - 1) {
        const c1AnonReads = [
          { anonIdx: 0, maxLine: 150, maxScroll: 99, activeSeconds: 1380, completionPct: 99, completed: true  },
          { anonIdx: 1, maxLine: 142, maxScroll: 95, activeSeconds: 1050, completionPct: 95, completed: true  },
          { anonIdx: 2, maxLine: 120, maxScroll: 80, activeSeconds: 880,  completionPct: 80, completed: false },
          { anonIdx: 3, maxLine: 95,  maxScroll: 63, activeSeconds: 640,  completionPct: 63, completed: false },
          { anonIdx: 4, maxLine: 60,  maxScroll: 40, activeSeconds: 420,  completionPct: 40, completed: false },
          { anonIdx: 5, maxLine: 35,  maxScroll: 23, activeSeconds: 210,  completionPct: 23, completed: false },
          { anonIdx: 6, maxLine: 12,  maxScroll: 8,  activeSeconds: 90,   completionPct: 8,  completed: false },
          { anonIdx: 7, maxLine: 5,   maxScroll: 3,  activeSeconds: 30,   completionPct: 3,  completed: false },
        ];
        for (const r of c1AnonReads) {
          const completedAt = r.completed ? new Date(Date.now() - Math.random() * 86400000 * 5).toISOString() : null;
          await sql`
            INSERT INTO chapter_reads (reader_session_id, chapter_version_id, max_line_seen, max_scroll_percent, active_seconds, completion_percent, completed_at)
            VALUES (${anonSessionIds[r.anonIdx]}, ${c1Id}, ${r.maxLine}, ${r.maxScroll}, ${r.activeSeconds}, ${r.completionPct}, ${completedAt})
            ON CONFLICT (reader_session_id, chapter_version_id) DO UPDATE SET
              max_line_seen = EXCLUDED.max_line_seen, max_scroll_percent = EXCLUDED.max_scroll_percent,
              active_seconds = EXCLUDED.active_seconds, completion_percent = EXCLUDED.completion_percent,
              completed_at = EXCLUDED.completed_at
          `;
        }
        totalReads += c1AnonReads.length;
      }
    }

    if (c2Id) {
      const [c2Ver] = await sql`SELECT rendered_html FROM chapter_versions WHERE id = ${c2Id}`;

      const c2ReactionsToSeed = c2Reactions.filter(r => r.versionIdx === dvIndex);
      for (const r of c2ReactionsToSeed) {
        const ri = r.readerIdx;
        const wp = feedbackWordPos(c2Ver.rendered_html, r.selectedText);
        const cp = wp ? wordRangeToCharPos(c2Ver.rendered_html, wp.wordStart, wp.wordEnd) : null;
        await sql`
          INSERT INTO feedback_reactions (reader_session_id, chapter_version_id, reader_profile_id, reader_group_id, reader_invite_id, selected_text, word_start, word_end, char_start, char_length, reaction)
          VALUES (${sessionIds[ri]}, ${c2Id}, ${readerIds[ri]}, ${ri < 2 ? groupIds[0] : (ri === 2 ? groupIds[1] : null)}, ${inviteIds[ri]}, ${r.selectedText}, ${wp?.wordStart ?? null}, ${wp?.wordEnd ?? null}, ${cp?.charStart ?? null}, ${cp?.charLength ?? null}, ${r.reaction})
        `;
      }
      totalReactions += c2ReactionsToSeed.length;

      // Only seed each reader's comments on their assigned version
      const c2CommentsToSeed = COMMENTS_C2.filter(c => c.versionIdx === dvIndex);
      for (const c of c2CommentsToSeed) {
        const ri = c.readerIdx;
        const wp = feedbackWordPos(c2Ver.rendered_html, c.selectedText);
        const cp = wp ? wordRangeToCharPos(c2Ver.rendered_html, wp.wordStart, wp.wordEnd) : null;
        await sql`
          INSERT INTO feedback_comments (reader_session_id, chapter_version_id, reader_profile_id, reader_group_id, reader_invite_id, selected_text, body, char_start, char_length, word_start, word_end)
          VALUES (${sessionIds[ri]}, ${c2Id}, ${readerIds[ri]}, ${ri < 2 ? groupIds[0] : (ri === 2 ? groupIds[1] : null)}, ${inviteIds[ri]}, ${c.selectedText}, ${c.body}, ${cp?.charStart ?? null}, ${cp?.charLength ?? null}, ${wp?.wordStart ?? null}, ${wp?.wordEnd ?? null})
        `;
      }
      totalComments += c2CommentsToSeed.length;

      // Reads for c2 — known readers (only on their assigned version)
      const c2KnownReads = [
        { sessionIdx: 0, maxLine: 108, maxScroll: 97, activeSeconds: 980,  completionPct: 97, completed: true  },
        { sessionIdx: 1, maxLine: 68,  maxScroll: 61, activeSeconds: 490,  completionPct: 61, completed: false },
        { sessionIdx: 2, maxLine: 44,  maxScroll: 40, activeSeconds: 320,  completionPct: 40, completed: false },
      ];
      const c2ReadVersions: Record<number, number> = { 0: 4, 1: 4, 2: 4 };
      const c2ReadsToSeed = c2KnownReads.filter(r => c2ReadVersions[r.sessionIdx] === dvIndex);
      for (const r of c2ReadsToSeed) {
        const completedAt = r.completed ? new Date(Date.now() - Math.random() * 86400000 * 7).toISOString() : null;
        await sql`
          INSERT INTO chapter_reads (reader_session_id, chapter_version_id, max_line_seen, max_scroll_percent, active_seconds, completion_percent, completed_at)
          VALUES (${sessionIds[r.sessionIdx]}, ${c2Id}, ${r.maxLine}, ${r.maxScroll}, ${r.activeSeconds}, ${r.completionPct}, ${completedAt})
          ON CONFLICT (reader_session_id, chapter_version_id) DO UPDATE SET
            max_line_seen = EXCLUDED.max_line_seen, max_scroll_percent = EXCLUDED.max_scroll_percent,
            active_seconds = EXCLUDED.active_seconds, completion_percent = EXCLUDED.completion_percent,
            completed_at = EXCLUDED.completed_at
        `;
      }
      totalReads += c2ReadsToSeed.length;

      // Anonymous reads for c2 — only on latest version
      if (dvIndex === allDocVersions.length - 1) {
        const c2AnonReads = [
          { anonIdx: 0, maxLine: 110, maxScroll: 99, activeSeconds: 920,  completionPct: 99, completed: true  },
          { anonIdx: 1, maxLine: 105, maxScroll: 95, activeSeconds: 870,  completionPct: 95, completed: true  },
          { anonIdx: 2, maxLine: 88,  maxScroll: 80, activeSeconds: 650,  completionPct: 80, completed: false },
          { anonIdx: 3, maxLine: 55,  maxScroll: 50, activeSeconds: 380,  completionPct: 50, completed: false },
          { anonIdx: 4, maxLine: 30,  maxScroll: 27, activeSeconds: 200,  completionPct: 27, completed: false },
          { anonIdx: 5, maxLine: 10,  maxScroll: 9,  activeSeconds: 70,   completionPct: 9,  completed: false },
        ];
        for (const r of c2AnonReads) {
          const completedAt = r.completed ? new Date(Date.now() - Math.random() * 86400000 * 5).toISOString() : null;
          await sql`
            INSERT INTO chapter_reads (reader_session_id, chapter_version_id, max_line_seen, max_scroll_percent, active_seconds, completion_percent, completed_at)
            VALUES (${anonSessionIds[r.anonIdx]}, ${c2Id}, ${r.maxLine}, ${r.maxScroll}, ${r.activeSeconds}, ${r.completionPct}, ${completedAt})
            ON CONFLICT (reader_session_id, chapter_version_id) DO UPDATE SET
              max_line_seen = EXCLUDED.max_line_seen, max_scroll_percent = EXCLUDED.max_scroll_percent,
              active_seconds = EXCLUDED.active_seconds, completion_percent = EXCLUDED.completion_percent,
              completed_at = EXCLUDED.completed_at
          `;
        }
        totalReads += c2AnonReads.length;
      }
    }

    // Reads for c3 — only on latest version
    if (c3Id && dvIndex === allDocVersions.length - 1) {
      const c3Reads = [
        // Known readers: Diana and Marcus continued; Sofia dropped off
        { sid: sessionIds[0], maxLine: 80, maxScroll: 95, activeSeconds: 760, completionPct: 95, completed: true  },
        { sid: sessionIds[1], maxLine: 75, maxScroll: 90, activeSeconds: 680, completionPct: 90, completed: true  },
        // Anonymous readers: gradual drop-off
        { sid: anonSessionIds[0], maxLine: 82, maxScroll: 98, activeSeconds: 810, completionPct: 98, completed: true  },
        { sid: anonSessionIds[1], maxLine: 70, maxScroll: 83, activeSeconds: 560, completionPct: 83, completed: false },
        { sid: anonSessionIds[2], maxLine: 45, maxScroll: 54, activeSeconds: 340, completionPct: 54, completed: false },
        { sid: anonSessionIds[3], maxLine: 20, maxScroll: 24, activeSeconds: 150, completionPct: 24, completed: false },
        { sid: anonSessionIds[4], maxLine: 8,  maxScroll: 10, activeSeconds: 60,  completionPct: 10, completed: false },
      ];
      for (const r of c3Reads) {
        const completedAt = r.completed ? new Date(Date.now() - Math.random() * 86400000 * 4).toISOString() : null;
        await sql`
          INSERT INTO chapter_reads (reader_session_id, chapter_version_id, max_line_seen, max_scroll_percent, active_seconds, completion_percent, completed_at)
          VALUES (${r.sid}, ${c3Id}, ${r.maxLine}, ${r.maxScroll}, ${r.activeSeconds}, ${r.completionPct}, ${completedAt})
          ON CONFLICT (reader_session_id, chapter_version_id) DO UPDATE SET
            max_line_seen = EXCLUDED.max_line_seen, max_scroll_percent = EXCLUDED.max_scroll_percent,
            active_seconds = EXCLUDED.active_seconds, completion_percent = EXCLUDED.completion_percent,
            completed_at = EXCLUDED.completed_at
        `;
      }
      totalReads += c3Reads.length;
    }

    // Reads for chapter X — only on latest version
    if (cXId && dvIndex === allDocVersions.length - 1) {
      const cXReads = [
        // Only Diana made it this far
        { sid: sessionIds[0], maxLine: 40, maxScroll: 92, activeSeconds: 420, completionPct: 92, completed: true  },
        { sid: anonSessionIds[0], maxLine: 38, maxScroll: 88, activeSeconds: 380, completionPct: 88, completed: true  },
        { sid: anonSessionIds[1], maxLine: 22, maxScroll: 51, activeSeconds: 200, completionPct: 51, completed: false },
        { sid: anonSessionIds[3], maxLine: 6,  maxScroll: 14, activeSeconds: 45,  completionPct: 14, completed: false },
      ];
      for (const r of cXReads) {
        const completedAt = r.completed ? new Date(Date.now() - Math.random() * 86400000 * 3).toISOString() : null;
        await sql`
          INSERT INTO chapter_reads (reader_session_id, chapter_version_id, max_line_seen, max_scroll_percent, active_seconds, completion_percent, completed_at)
          VALUES (${r.sid}, ${cXId}, ${r.maxLine}, ${r.maxScroll}, ${r.activeSeconds}, ${r.completionPct}, ${completedAt})
          ON CONFLICT (reader_session_id, chapter_version_id) DO UPDATE SET
            max_line_seen = EXCLUDED.max_line_seen, max_scroll_percent = EXCLUDED.max_scroll_percent,
            active_seconds = EXCLUDED.active_seconds, completion_percent = EXCLUDED.completion_percent,
            completed_at = EXCLUDED.completed_at
        `;
      }
      totalReads += cXReads.length;
    }
  }

  console.log(`  ✓ ${totalReactions} reactions across ${allDocVersions.length} commit(s)`);
  console.log(`  ✓ ${totalComments} comments`);
  console.log(`  ✓ ${totalEdits} suggested edits`);
  console.log(`  ✓ ${totalReads} chapter read records`);

  // ── Interest signups ─────────────────────────────────────────────────────────
  console.log('\n📧 Seeding interest signups…');
  const signups = [
    { email: 'diana@example.com',    readerIdx: 0 },
    { email: 'sofia@example.com',    readerIdx: 2 },
    { email: 'cassie.m@example.com', readerIdx: -1 }, // anonymous
    { email: 'theo@example.com',     readerIdx: -1 },
  ];
  for (const s of signups) {
    const sessionId = s.readerIdx >= 0 ? sessionIds[s.readerIdx] : null;
    const profileId = s.readerIdx >= 0 ? readerIds[s.readerIdx] : null;
    await sql`
      INSERT INTO interest_signups (work_id, reader_session_id, reader_profile_id, email, source)
      VALUES (${workId}, ${sessionId}, ${profileId}, ${s.email}, 'reader_cta')
      ON CONFLICT (work_id, email) DO NOTHING
    `;
  }
  console.log(`  ✓ ${signups.length} interest signups`);

  // ── Summary ─────────────────────────────────────────────────────────────────
  console.log('\n✅ Seed complete!\n');
  console.log('  Commits ingested :', orderedCommits.length);
  console.log('  Readers          :', READERS.length);
  console.log('  Groups           :', GROUPS.length);
  console.log('  Reactions        :', totalReactions);
  console.log('  Comments         :', totalComments);
  console.log('  Suggested edits  :', totalEdits);
  console.log('  Chapter reads    :', totalReads);
  console.log('  Interest signups :', signups.length);
  console.log('\nReader invite URLs (use NEXT_PUBLIC_BASE_URL/read/i/<token>):');
  for (const r of READERS) console.log(`  /read/i/${r.slug}  →  ${r.displayName}`);
  console.log(`  /read/i/early-readers  →  Early Readers group\n`);
}

main().catch(err => {
  console.error('\n❌ Seed failed:', err);
  process.exit(1);
});
