import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db/client';
import { isDashboardAuthed } from '@/lib/auth/dashboard';
import { htmlToWords, wordRangeToCharPos } from '@/lib/db/wordPos';
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

  // Get all chapter versions for this chapter (for cross-version aggregation)
  const allVersions = await sql`
    SELECT cv.id, cv.version_number
    FROM chapter_versions cv
    JOIN chapters c ON c.id = cv.chapter_id
    WHERE c.id = ${chapterId}
    ORDER BY cv.version_number
  `;

  // Get all diffs for cross-version word resolution
  const diffs = await sql`
    SELECT cd.chapter_version_id, cd.previous_chapter_version_id, cd.word_map
    FROM chapter_diffs cd
    JOIN chapter_versions cv ON cv.id = cd.chapter_version_id
    WHERE cv.chapter_id = ${chapterId}
  `;

  // Build per-word counts for the CURRENT version by aggregating across all versions
  const wordCount = Number(currentVer.word_count);
  const likeMap: Record<number, number> = {};
  const dislikeMap: Record<number, number> = {};
  const commentMap: Record<number, number> = {};

  for (const ver of allVersions) {
    // Get reactions for this version (word-anchored only)
    const reactions = await sql`
      SELECT word_start, word_end, reaction, COUNT(*) as cnt
      FROM feedback_reactions
      WHERE chapter_version_id = ${ver.id}
        AND word_start IS NOT NULL AND word_end IS NOT NULL
        ${readerProfileId ? sql`AND reader_profile_id = ${readerProfileId}` : sql``}
        ${readerGroupId ? sql`AND reader_group_id = ${readerGroupId}` : sql``}
        ${readerInviteId ? sql`AND reader_invite_id = ${readerInviteId}` : sql``}
      GROUP BY word_start, word_end, reaction
    `;

    for (const r of reactions) {
      // Map this version's word range to the current version
      const mapped = ver.id === chapterVersionId
        ? { wordStart: Number(r.word_start), wordEnd: Number(r.word_end) }
        : resolveWordRange(diffs as any[], ver.id as string, chapterVersionId, Number(r.word_start), Number(r.word_end));

      if (!mapped) continue;

      const cnt = Number(r.cnt);
      for (let wi = mapped.wordStart; wi <= mapped.wordEnd; wi++) {
        if (wi < 0 || wi >= wordCount) continue;
        if (r.reaction === 'like') likeMap[wi] = (likeMap[wi] || 0) + cnt;
        else dislikeMap[wi] = (dislikeMap[wi] || 0) + cnt;
      }
    }

    // Get comments for this version
    const comments = await sql`
      SELECT word_start, word_end, COUNT(*) as cnt
      FROM feedback_comments
      WHERE chapter_version_id = ${ver.id}
        AND word_start IS NOT NULL AND word_end IS NOT NULL
        ${readerProfileId ? sql`AND reader_profile_id = ${readerProfileId}` : sql``}
        ${readerGroupId ? sql`AND reader_group_id = ${readerGroupId}` : sql``}
        ${readerInviteId ? sql`AND reader_invite_id = ${readerInviteId}` : sql``}
      GROUP BY word_start, word_end
    `;

    for (const c of comments) {
      const mapped = ver.id === chapterVersionId
        ? { wordStart: Number(c.word_start), wordEnd: Number(c.word_end) }
        : resolveWordRange(diffs as any[], ver.id as string, chapterVersionId, Number(c.word_start), Number(c.word_end));

      if (!mapped) continue;

      const cnt = Number(c.cnt);
      for (let wi = mapped.wordStart; wi <= mapped.wordEnd; wi++) {
        if (wi < 0 || wi >= wordCount) continue;
        commentMap[wi] = (commentMap[wi] || 0) + cnt;
      }
    }
  }

  // Build per-word output with char positions for client-side rendering
  const words = htmlToWords(currentHtml);
  const wordData = words.map((word, wi) => {
    const likes = likeMap[wi] || 0;
    const dislikes = dislikeMap[wi] || 0;
    const comments = commentMap[wi] || 0;
    const cp = wordRangeToCharPos(currentHtml, wi, wi);
    return {
      wordIndex: wi,
      word,
      charStart: cp?.charStart ?? null,
      charLength: cp?.charLength ?? null,
      likeCount: likes,
      dislikeCount: dislikes,
      netScore: likes - dislikes,
      commentCount: comments,
    };
  });

  // Also return line-level data for reader reach (retention still line-based)
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

  // Total reaction counts: direct count query (not per-word sums which overcounts spans)
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
    words: wordData,
    heatmap,
    totalReaders: totalReaderCount,
    totalLikes: likesTotal,
    totalDislikes: dislikesTotal,
  });
}
