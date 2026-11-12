import { NextResponse, type NextRequest } from "next/server";
import { readSessionToken, SESSION_COOKIE } from "@/lib/session-token";

const PROTECTED_PAGES = ["/overview", "/beats", "/scanner", "/licenses", "/customers", "/payments", "/settings"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = await readSessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  const isProtectedPage = PROTECTED_PAGES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  const isProtectedApi =
    pathname.startsWith("/api/") &&
    pathname !== "/api/auth/login" &&
    pathname !== "/api/auth/register";

  if ((isProtectedPage || isProtectedApi) && !session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (session && (pathname === "/login" || pathname === "/register" || pathname === "/")) {
    const url = request.nextUrl.clone();
    url.pathname = "/overview";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon).*)"],
};
