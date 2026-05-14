import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function safeNextPath(raw: string | null): string {
  const fallback = "/auth/reset-password";
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return fallback;
  return raw;
}

export async function GET(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const nextPath = safeNextPath(requestUrl.searchParams.get("next"));
  const redirectTarget = new URL(nextPath, requestUrl.origin);

  if (code) {
    const response = NextResponse.redirect(redirectTarget);
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: object }[]) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2])
          );
        },
      },
    });
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return response;
    }
  }

  return NextResponse.redirect(new URL("/auth/auth-code-error", request.url));
}
