import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const body = await request.json();
    const { name, email, message } = body;
    if (!name || !message) return NextResponse.json({ success: false, error: 'Missing fields' }, { status: 400 });
    console.log('Contact message', { name, email, message });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}