import { NextResponse } from 'next/server';
import { clearGitCaches } from '@/lib/git';

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Clear git caches to force fresh data
    clearGitCaches();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error clearing git cache:', error);
    return NextResponse.json({ error: 'Failed to clear cache' }, { status: 500 });
  }
}
