import { NextResponse } from 'next/server';
import { getChapterById, getFeedbackForChapter } from '@/lib/db';
import { getChapterVersions } from '@/lib/git';

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const chapterId = parseInt(id);

    const chapter = getChapterById(chapterId);
    if (!chapter) {
      return NextResponse.json({ error: 'Chapter not found' }, { status: 404 });
    }

    // Get all versions from git history
    const versions = await getChapterVersions(chapter.filename);

    // Get feedback counts for each version
    const allFeedback = getFeedbackForChapter(chapterId);

    // Enrich versions with feedback counts
    const enrichedVersions = versions.map(version => {
      // Count feedback created at this commit
      const feedbackCount = allFeedback.filter(
        f => f.createdAtCommit === version.commitSha
      ).length;

      return {
        commitSha: version.commitSha,
        commitShortSha: version.commitShortSha,
        date: version.date,
        author: version.authorName,
        message: version.message,
        feedbackCount
      };
    });

    return NextResponse.json({
      versions: enrichedVersions
    });
  } catch (error) {
    console.error('Error fetching chapter versions:', error);
    return NextResponse.json({ error: 'Failed to fetch versions' }, { status: 500 });
  }
}
