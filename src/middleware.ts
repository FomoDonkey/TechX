import { type NextRequest, NextResponse } from "next/server";

const PROTECTED = [/^\/admin(\/|$)/, /^\/onboarding(\/|$)/, /^\/preview(\/|$)/];
const GUEST_ONLY = [/^\/login$/, /^\/registro$/, /^\/olvide$/];

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // Better-Auth firma su cookie como `csm.session_token` (cookiePrefix=csm).
  // Cookies grandes (OAuth con id_token) se chunkean en `.0/.1/.2…`.
  const isAuthed = req.cookies
    .getAll()
    .some((c) => c.name === "csm.session_token" || c.name.startsWith("csm.session_token."));

  if (PROTECTED.some((re) => re.test(pathname)) && !isAuthed) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }

  if (GUEST_ONLY.some((re) => re.test(pathname)) && isAuthed) {
    const url = req.nextUrl.clone();
    url.pathname = "/admin";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/onboarding/:path*",
    "/preview/:path*",
    "/login",
    "/registro",
    "/olvide",
  ],
};
