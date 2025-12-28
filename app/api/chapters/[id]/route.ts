import { NextResponse } from 'next/server';
import { getChapterById, getABTestsForChapter, getOrCreateABTestAssignment } from '@/lib/db';
import { getChapterData } from '@/lib/chapters';

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const chapterId = parseInt(id);
    const { searchParams } = new URL(request.url);
    const readerId = searchParams.get('readerId');

    const chapter = getChapterById(chapterId);
    if (!chapter) {
      return NextResponse.json({ error: 'Chapter not found' }, { status: 404 });
    }

    // Get chapter content from file
    const chapterData = getChapterData(chapter.filename);
    if (!chapterData) {
      return NextResponse.json({ error: 'Chapter file not found' }, { status: 404 });
    }

    // Get A/B tests for this chapter
    const abTests = getABTestsForChapter(chapterId);

    // If reader ID is provided, get their assignments
    let assignments: Record<number, 'A' | 'B'> = {};
    if (readerId && abTests.length > 0) {
      abTests.forEach(test => {
        const assignment = getOrCreateABTestAssignment(test.id, readerId);
        assignments[test.id] = assignment.assignedVersion;
      });
    }

    return NextResponse.json({
      chapter,
      content: chapterData.content,
      html: chapterData.html,
      abTests,
      assignments,
    });
  } catch (error) {
    console.error('Error fetching chapter:', error);
    return NextResponse.json({ error: 'Failed to fetch chapter' }, { status: 500 });
  }
}
