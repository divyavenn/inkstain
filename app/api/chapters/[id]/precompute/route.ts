import { NextResponse } from 'next/server';
import { getChapterById } from '@/lib/db';
import { preComputeAllVersions, isPreComputeComplete } from '@/lib/words/change-tracker';

/**
 * Trigger pre-computation of all versions for a chapter
 * This is called by the dashboard to enable instant version switching
 */
export async function POST(
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

    // Check if already computed
    if (isPreComputeComplete(chapterId)) {
      return NextResponse.json({
        status: 'complete',
        message: 'Versions already pre-computed'
      });
    }

    // Start pre-computation (this may take a while)
    await preComputeAllVersions(chapterId, chapter.filename);

    return NextResponse.json({
      status: 'complete',
      message: 'Pre-computation finished'
    });
  } catch (error) {
    console.error('Error during pre-computation:', error);
    return NextResponse.json({
      error: 'Pre-computation failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * Check pre-computation status
 */
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

    const isComplete = isPreComputeComplete(chapterId);

    return NextResponse.json({
      status: isComplete ? 'complete' : 'idle',
      chapterId
    });
  } catch (error) {
    console.error('Error checking pre-compute status:', error);
    return NextResponse.json({
      error: 'Failed to check status'
    }, { status: 500 });
  }
}
