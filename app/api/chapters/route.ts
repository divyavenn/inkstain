import { NextResponse } from 'next/server';
import { getAllChapters } from '@/lib/chapters';
import { getAllChapters as getDBChapters, upsertChapter } from '@/lib/db';

export async function GET() {
  try {
    // Get chapters from markdown files
    const fileChapters = getAllChapters();

    // Sync with database
    const dbChapters = fileChapters.map(chapter => {
      return upsertChapter(chapter.filename, chapter.metadata.title, chapter.metadata.order);
    });

    return NextResponse.json({ chapters: dbChapters });
  } catch (error) {
    console.error('Error fetching chapters:', error);
    return NextResponse.json({ error: 'Failed to fetch chapters' }, { status: 500 });
  }
}
