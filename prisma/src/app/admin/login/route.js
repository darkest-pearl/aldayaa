import { NextResponse } from 'next/server';
import { authenticateAdmin, setSessionCookie } from '../../../../lib/auth';

export async function POST(request) {
  try {
    const { email, password } = await request.json();
    const admin = await authenticateAdmin(email, password);
    if (!admin) return NextResponse.json({ success: false, error: 'Invalid credentials' }, { status: 401 });
    const response = NextResponse.json({ success: true });
    setSessionCookie(response, admin);
    return response;
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}