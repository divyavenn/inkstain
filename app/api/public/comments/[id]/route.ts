import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db/client';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });

    const [comment] = await sql`
      SELECT id, body, selected_text, char_start, char_length, word_start, word_end, created_at
      FROM feedback_comments
      WHERE id = ${id} AND reader_session_id = ${sessionId}
    `;

    if (!comment) return NextResponse.json({ error: 'Not found or not authorized' }, { status: 404 });

    return NextResponse.json({ comment });
  } catch (err) {
    console.error('Get comment error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { sessionId, body } = await req.json();

    if (!sessionId || !body?.trim()) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const result = await sql`
      UPDATE feedback_comments
      SET body = ${body}
      WHERE id = ${id} AND reader_session_id = ${sessionId}
      RETURNING id, body
    `;

    if (result.length === 0) {
      return NextResponse.json({ error: 'Not found or not authorized' }, { status: 404 });
    }

    return NextResponse.json({ comment: result[0] });
  } catch (err) {
    console.error('Update comment error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

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
      DELETE FROM feedback_comments
      WHERE id = ${id} AND reader_session_id = ${sessionId}
      RETURNING id
    `;

    if (result.length === 0) {
      return NextResponse.json({ error: 'Not found or not authorized' }, { status: 404 });
    }

    return NextResponse.json({ deleted: true });
  } catch (err) {
    console.error('Delete comment error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
