// Deprecated: Stream Chat has been removed.
import { NextResponse } from 'next/server';
export async function POST() {
  return NextResponse.json({ error: 'Stream Chat removed' }, { status: 410 });
}
