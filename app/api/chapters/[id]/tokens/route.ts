import { NextResponse } from 'next/server';
import { getChapterById } from '@/lib/db';
import { getCurrentCommitForFile } from '@/lib/git';
import { computeFromGitHistory } from '@/lib/words/change-tracker';

/**
 * Get word tokens for current version of a chapter
 * This allows frontend to match selections to word IDs
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const chapterId = parseInt(id);
    const { searchParams } = new URL(request.url);
    const commitSha = searchParams.get('commitSha');

    const chapter = getChapterById(chapterId);
    if (!chapter) {
      return NextResponse.json({ error: 'Chapter not found' }, { status: 404 });
    }

    // Get commit SHA (use provided or fetch current)
    let targetCommit = commitSha;
    if (!targetCommit) {
      try {
        targetCommit = await getCurrentCommitForFile(chapter.filename);
      } catch (error) {
        return NextResponse.json({
          error: 'Git repository not available',
          tokens: [] // Return empty tokens if no git
        }, { status: 200 });
      }
    }

    // Compute word tokens for this version
    const wordTokens = await computeFromGitHistory(
      chapterId,
      chapter.filename,
      targetCommit
    );

    return NextResponse.json({
      commitSha: targetCommit,
      tokens: wordTokens
    });
  } catch (error) {
    console.error('Error fetching word tokens:', error);
    return NextResponse.json({
      error: 'Failed to fetch word tokens',
      tokens: []
    }, { status: 500 });
  }
}
