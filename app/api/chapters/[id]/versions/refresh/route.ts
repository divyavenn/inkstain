import { NextResponse } from 'next/server';
import { clearGitCaches } from '@/lib/git';

export async function POST() {
  clearGitCaches();
  return NextResponse.json({ success: true });
}
