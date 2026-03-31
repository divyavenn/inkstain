import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db/client';
import { isDashboardAuthed } from '@/lib/auth/dashboard';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await isDashboardAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type'); // 'comment' or 'suggestion'

  try {
    if (type === 'suggestion') {
      await sql`DELETE FROM suggested_edits WHERE id = ${id}`;
    } else {
      await sql`DELETE FROM feedback_comments WHERE id = ${id}`;
    }
    return NextResponse.json({ deleted: true });
  } catch (err) {
    console.error('Dashboard delete feedback error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
