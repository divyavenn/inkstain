import { NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { createReader, getReader } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const { name } = await request.json();

    // Generate unique reader ID
    const readerId = nanoid(10);
    const reader = createReader(readerId, name);

    return NextResponse.json({ reader });
  } catch (error) {
    console.error('Error creating reader:', error);
    return NextResponse.json({ error: 'Failed to create reader' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const readerId = searchParams.get('id');

    if (!readerId) {
      return NextResponse.json({ error: 'Reader ID required' }, { status: 400 });
    }

    const reader = getReader(readerId);
    if (!reader) {
      return NextResponse.json({ error: 'Reader not found' }, { status: 404 });
    }

    return NextResponse.json({ reader });
  } catch (error) {
    console.error('Error fetching reader:', error);
    return NextResponse.json({ error: 'Failed to fetch reader' }, { status: 500 });
  }
}
