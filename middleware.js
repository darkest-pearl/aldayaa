export const runtime = "nodejs";            // << — THIS IS THE FIX
// DO NOT PUT THIS INSIDE config {}

import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";

const COOKIE_NAME = "aldayaa_admin";
const JWT_SECRET = process.env.ADMIN_JWT_SECRET || "aldayaa-secret";

const PUBLIC_PATHS = [
  "/admin/login",
  "/api/admin/login",
  "/admin/logout",
  "/api/admin/logout",
];

function isPublic(pathname) {
  return PUBLIC_PATHS.includes(pathname) || 
         PUBLIC_PATHS.some((p) => pathname.startsWith(p + "/"));
}

export function middleware(request) {
  console.log("=== MIDDLEWARE START ===");
  const { pathname } = request.nextUrl;
  console.log("PATHNAME:", pathname);

  const token = request.cookies.get(COOKIE_NAME)?.value;
  console.log("RAW TOKEN:", token);

  const isAdminSection =
    pathname.startsWith("/admin") || pathname.startsWith("/api/admin");

  if (!isAdminSection) {
    console.log("NOT ADMIN → ALLOW");
    return NextResponse.next();
  }

  let session = null;

  if (token) {
    try {
      session = jwt.verify(token, JWT_SECRET);
      console.log("TOKEN VERIFIED:", session);
    } catch (e) {
      console.log("TOKEN INVALID:", e.message);
    }
  }

  if (isPublic(pathname)) {
    if (session && pathname.startsWith("/admin/login")) {
      console.log("AUTHENTICATED → REDIRECT TO DASHBOARD");
      return NextResponse.redirect(new URL("/admin/dashboard", request.url));
    }
    console.log("PUBLIC PAGE → ALLOW");
    return NextResponse.next();
  }

  if (!session) {
    console.log("NOT LOGGED IN → REDIRECT");
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  console.log("AUTHORIZED → ALLOW");
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
