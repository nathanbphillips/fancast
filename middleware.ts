import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Simple password gate for the /dev-docs handoff page (HTTP Basic auth — the
 * browser prompts; enter any username + the password). Defaults to the value
 * below so it works out of the box; override with DEV_DOCS_PASSWORD in the env
 * (do that if the repo is public — the page is non-secret architecture docs, so
 * the fallback is intentionally low-stakes).
 */
const DEV_DOCS_PASSWORD = process.env.DEV_DOCS_PASSWORD ?? "fuck-man-city-4eva";

function devDocsAuthorized(request: NextRequest): boolean {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Basic ")) return false;
  try {
    const decoded = atob(header.slice(6)); // "username:password"
    return decoded.slice(decoded.indexOf(":") + 1) === DEV_DOCS_PASSWORD;
  } catch {
    return false;
  }
}

/**
 * Keeps Supabase auth sessions fresh: re-issues expiring auth cookies on
 * every matched request so server components always see a valid session.
 */
export async function middleware(request: NextRequest) {
  if (
    request.nextUrl.pathname.startsWith("/dev-docs") &&
    !devDocsAuthorized(request)
  ) {
    return new NextResponse("Authentication required.", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="dev-docs", charset="UTF-8"' },
    });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // triggers token refresh when needed; do not remove
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    // everything except static assets
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
