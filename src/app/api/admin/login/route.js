import { NextResponse } from 'next/server';
import { authenticateAdmin, setSessionCookie } from '../../../../lib/auth';

export async function POST(request) {
  try {
    const { email, password } = await request.json();
    const admin = await authenticateAdmin(email, password);

    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    const response = NextResponse.json({ success: true });
    setSessionCookie(response, admin);
    return response;
  } catch (error) {
    console.error("Admin login error:", error);
    return NextResponse.json(
      { success: false, error: 'Server error' },
      { status: 500 }
    );
  }
}
