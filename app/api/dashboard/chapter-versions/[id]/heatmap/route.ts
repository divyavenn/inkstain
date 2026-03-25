import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db/client';
import { isDashboardAuthed } from '@/lib/auth/dashboard';
import { wordRangeToCharPos } from '@/lib/db/wordPos';
import { resolveWordRange } from '@/lib/db/resolveWordRange';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await isDashboardAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: chapterVersionId } = await params;
  const { searchParams } = new URL(req.url);
  const readerProfileId = searchParams.get('readerProfileId');
  const readerGroupId = searchParams.get('readerGroupId');
  const readerInviteId = searchParams.get('readerInviteId');

  // Get current chapter version info
  const [currentVer] = await sql`
    SELECT cv.id, cv.rendered_html, cv.word_count, c.id as chapter_id
    FROM chapter_versions cv
    JOIN chapters c ON c.id = cv.chapter_id
    WHERE cv.id = ${chapterVersionId}
  `;
  if (!currentVer) return NextResponse.json({ error: 'Version not found' }, { status: 404 });

  const chapterId = currentVer.chapter_id as string;
  const currentHtml = currentVer.rendered_html as string;
  const wordCount = Number(currentVer.word_count);

  // Get all chapter versions for this chapter (for cross-version aggregation)
  const allVersions = await sql`
    SELECT cv.id, cv.version_number
    FROM chapter_versions cv
    WHERE cv.chapter_id = ${chapterId}
    ORDER BY cv.version_number
  `;

  // Get all diffs for cross-version word resolution
  const diffs = await sql`
    SELECT cd.chapter_version_id, cd.previous_chapter_version_id, cd.word_map
    FROM chapter_diffs cd
    JOIN chapter_versions cv ON cv.id = cd.chapter_version_id
    WHERE cv.chapter_id = ${chapterId}
  `;

  // ── Collect ranges: one entry per individual reaction/comment ─────────────

  interface RawRange {
    charStart: number;
    charLength: number;
    type: 'like' | 'dislike' | 'comment';
    readerName: string | null;
  }

  const rawRanges: RawRange[] = [];

  for (const ver of allVersions) {
    // Reactions with reader names
    const reactions = await sql`
      SELECT fr.word_start, fr.word_end, fr.reaction,
             rp.display_name as reader_name
      FROM feedback_reactions fr
      LEFT JOIN reader_profiles rp ON rp.id = fr.reader_profile_id
      WHERE fr.chapter_version_id = ${ver.id}
        AND fr.word_start IS NOT NULL AND fr.word_end IS NOT NULL
        ${readerProfileId ? sql`AND fr.reader_profile_id = ${readerProfileId}` : sql``}
        ${readerGroupId ? sql`AND fr.reader_group_id = ${readerGroupId}` : sql``}
        ${readerInviteId ? sql`AND fr.reader_invite_id = ${readerInviteId}` : sql``}
    `;

    for (const r of reactions) {
      const mapped = ver.id === chapterVersionId
        ? { wordStart: Number(r.word_start), wordEnd: Number(r.word_end) }
        : resolveWordRange(diffs as any[], ver.id as string, chapterVersionId, Number(r.word_start), Number(r.word_end));
      if (!mapped) continue;
      if (mapped.wordStart < 0 || mapped.wordEnd >= wordCount) continue;

      const cp = wordRangeToCharPos(currentHtml, mapped.wordStart, mapped.wordEnd);
      if (!cp) continue;

      rawRanges.push({
        charStart: cp.charStart,
        charLength: cp.charLength,
        type: r.reaction as 'like' | 'dislike',
        readerName: r.reader_name as string | null,
      });
    }

    // Comments with reader names
    const comments = await sql`
      SELECT fc.word_start, fc.word_end,
             rp.display_name as reader_name
      FROM feedback_comments fc
      LEFT JOIN reader_profiles rp ON rp.id = fc.reader_profile_id
      WHERE fc.chapter_version_id = ${ver.id}
        AND fc.word_start IS NOT NULL AND fc.word_end IS NOT NULL
        ${readerProfileId ? sql`AND fc.reader_profile_id = ${readerProfileId}` : sql``}
        ${readerGroupId ? sql`AND fc.reader_group_id = ${readerGroupId}` : sql``}
        ${readerInviteId ? sql`AND fc.reader_invite_id = ${readerInviteId}` : sql``}
    `;

    for (const c of comments) {
      const mapped = ver.id === chapterVersionId
        ? { wordStart: Number(c.word_start), wordEnd: Number(c.word_end) }
        : resolveWordRange(diffs as any[], ver.id as string, chapterVersionId, Number(c.word_start), Number(c.word_end));
      if (!mapped) continue;
      if (mapped.wordStart < 0 || mapped.wordEnd >= wordCount) continue;

      const cp = wordRangeToCharPos(currentHtml, mapped.wordStart, mapped.wordEnd);
      if (!cp) continue;

      rawRanges.push({
        charStart: cp.charStart,
        charLength: cp.charLength,
        type: 'comment',
        readerName: c.reader_name as string | null,
      });
    }
  }

  // ── Group identical ranges (same position + type) ────────────────────────

  const groupKey = (r: RawRange) => `${r.charStart}:${r.charLength}:${r.type}`;
  const grouped = new Map<string, { charStart: number; charLength: number; type: string; count: number; readerNames: string[] }>();
  for (const r of rawRanges) {
    const k = groupKey(r);
    const existing = grouped.get(k);
    if (existing) {
      existing.count++;
      if (r.readerName && !existing.readerNames.includes(r.readerName)) {
        existing.readerNames.push(r.readerName);
      }
    } else {
      grouped.set(k, {
        charStart: r.charStart,
        charLength: r.charLength,
        type: r.type,
        count: 1,
        readerNames: r.readerName ? [r.readerName] : [],
      });
    }
  }

  const ranges = Array.from(grouped.values());

  // ── Line-level data for reader reach (retention is still line-based) ─────

  const lines = await sql`
    SELECT line_number, line_text FROM chapter_version_lines
    WHERE chapter_version_id = ${chapterVersionId}
    ORDER BY line_number
  `;
  const totalReaders = await sql`
    SELECT COUNT(DISTINCT reader_session_id) as cnt FROM chapter_reads
    WHERE chapter_version_id = ${chapterVersionId}
  `;
  const totalReaderCount = parseInt(totalReaders[0]?.cnt as string || '0', 10);

  const retention = await sql`
    SELECT max_line_seen, COUNT(*) as reader_count
    FROM chapter_reads WHERE chapter_version_id = ${chapterVersionId}
    GROUP BY max_line_seen
  `;
  const retentionMap: Record<number, number> = {};
  for (const r of retention) {
    for (let i = 1; i <= Number(r.max_line_seen); i++) {
      retentionMap[i] = (retentionMap[i] || 0) + Number(r.reader_count);
    }
  }
  const heatmap = lines.map(line => {
    const ln = line.line_number as number;
    return {
      lineNumber: ln,
      lineText: line.line_text,
      likeCount: 0,
      dislikeCount: 0,
      netScore: 0,
      commentCount: 0,
      readerReachPercent: totalReaderCount > 0 ? Math.round(((retentionMap[ln] || 0) / totalReaderCount) * 100) : 0,
    };
  });

  // ── Total reaction counts for the stats header ───────────────────────────

  const reactionTotals = await sql`
    SELECT reaction, COUNT(*) as cnt
    FROM feedback_reactions
    WHERE chapter_version_id = ${chapterVersionId}
      AND word_start IS NOT NULL
      ${readerProfileId ? sql`AND reader_profile_id = ${readerProfileId}` : sql``}
      ${readerGroupId ? sql`AND reader_group_id = ${readerGroupId}` : sql``}
      ${readerInviteId ? sql`AND reader_invite_id = ${readerInviteId}` : sql``}
    GROUP BY reaction
  `;
  const likesTotal = Number(reactionTotals.find(r => r.reaction === 'like')?.cnt ?? 0);
  const dislikesTotal = Number(reactionTotals.find(r => r.reaction === 'dislike')?.cnt ?? 0);

  return NextResponse.json({
    chapterVersionId,
    ranges,
    heatmap,
    totalReaders: totalReaderCount,
    totalLikes: likesTotal,
    totalDislikes: dislikesTotal,
  });
}
