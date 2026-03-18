import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db/client';
import { feedbackCharPos } from '@/lib/db/charPos';

export async function POST(req: NextRequest) {
  try {
    const { sessionId, chapterVersionId, startLine, endLine, body, selectedText } = await req.json();

    if (!sessionId || !chapterVersionId || startLine == null || endLine == null || !body?.trim()) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const sessions = await sql`SELECT reader_profile_id, reader_group_id, reader_invite_id FROM reader_sessions WHERE id = ${sessionId}`;
    if (sessions.length === 0) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    const session = sessions[0];

    let charStart: number | null = null;
    let charLength: number | null = null;
    if (selectedText) {
      const [ver] = await sql`SELECT rendered_html FROM chapter_versions WHERE id = ${chapterVersionId}`;
      if (ver) {
        const pos = feedbackCharPos(ver.rendered_html, selectedText);
        if (pos) { charStart = pos.charStart; charLength = pos.charLength; }
      }
    }

    const [c] = await sql`
      INSERT INTO feedback_comments (reader_session_id, chapter_version_id, reader_profile_id, reader_group_id, reader_invite_id, start_line, end_line, selected_text, body, char_start, char_length)
      VALUES (${sessionId}, ${chapterVersionId}, ${session.reader_profile_id}, ${session.reader_group_id}, ${session.reader_invite_id}, ${startLine}, ${endLine}, ${selectedText ?? null}, ${body}, ${charStart}, ${charLength})
      RETURNING id
    `;

    return NextResponse.json({ id: c.id });
  } catch (err) {
    console.error('Comment error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
