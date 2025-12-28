import { NextResponse } from 'next/server';
import { getAllFeedback, getFeedbackForChapter } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const chapterId = searchParams.get('chapterId');

    let feedback;
    if (chapterId) {
      feedback = getFeedbackForChapter(parseInt(chapterId));
    } else {
      feedback = getAllFeedback();
    }

    return NextResponse.json({ feedback });
  } catch (error) {
    console.error('Error fetching feedback:', error);
    return NextResponse.json({ error: 'Failed to fetch feedback' }, { status: 500 });
  }
}
