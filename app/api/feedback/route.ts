import { NextResponse } from 'next/server';
import { createFeedback, getReader, createReader } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const {
      readerId,
      chapterId,
      snippetText,
      snippetStart,
      snippetEnd,
      feedbackType,
      comment,
      suggestedEdit,
      abTestId,
      abTestVersion,
    } = await request.json();

    // Validate required fields
    if (!readerId || !chapterId || !snippetText || snippetStart === undefined || snippetEnd === undefined || !feedbackType) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Ensure reader exists in database (create if needed)
    let reader = getReader(readerId);
    if (!reader) {
      reader = createReader(readerId);
    }

    const feedback = createFeedback(
      readerId,
      chapterId,
      snippetText,
      snippetStart,
      snippetEnd,
      feedbackType,
      comment,
      suggestedEdit,
      abTestId,
      abTestVersion
    );

    return NextResponse.json({ feedback });
  } catch (error) {
    console.error('Error creating feedback:', error);
    return NextResponse.json({ error: 'Failed to create feedback' }, { status: 500 });
  }
}
