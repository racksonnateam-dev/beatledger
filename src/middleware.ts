import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/login" || pathname === "/register" || pathname.startsWith("/api/auth/login") || pathname.startsWith("/api/auth/register")) {
    const url = request.nextUrl.clone();
    url.pathname = "/scanner";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon).*)"],
};
