import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Supabase often redirects email links (recovery, etc.) to Site URL with
 * `?code=` on `/`. Without this, the PKCE code is never exchanged and the user
 * stays on the marketing home. Forward to the auth callback so cookies are set
 * and the user lands on the new-password page.
 */
export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === "/" && request.nextUrl.searchParams.has("code")) {
    const code = request.nextUrl.searchParams.get("code");
    if (code) {
      const target = new URL("/auth/callback", request.url);
      target.searchParams.set("code", code);
      target.searchParams.set("next", "/auth/reset-password");
      return NextResponse.redirect(target);
    }
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
