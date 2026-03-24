import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db/client';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });

    const result = await sql`
      DELETE FROM feedback_reactions
      WHERE id = ${id} AND reader_session_id = ${sessionId}
      RETURNING id
    `;

    if (result.length === 0) {
      return NextResponse.json({ error: 'Not found or not authorized' }, { status: 404 });
    }

    return NextResponse.json({ deleted: true });
  } catch (err) {
    console.error('Delete reaction error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
