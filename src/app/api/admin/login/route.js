import { NextResponse } from "next/server";
import { authenticateAdmin, setSessionCookie } from "../../../../lib/auth";

export async function POST(request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: "Email and password are required" },
        { status: 400 }
      );
    }

    const admin = await authenticateAdmin(email, password);

    if (!admin) {
      return NextResponse.json(
        { success: false, error: "Invalid credentials" },
        { status: 401 }
      );
    }
    console.log("LOGIN ROUTE SECRET:", process.env.ADMIN_JWT_SECRET);
    const response = NextResponse.json({ success: true });
    setSessionCookie(response, admin);

    return response;

  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Server error" },
      { status: 500 }
    );
  }
}
