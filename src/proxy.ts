import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_PUBLIC_KEY, SUPABASE_URL } from "@/lib/supabase/env";

// Keeps the staff sign-in fresh and sends signed-out visitors from /app to /login.
// Performer pages (/, /c/...) never need an account and are not matched here.
export async function proxy(request: NextRequest) {
  if (!SUPABASE_URL || !SUPABASE_PUBLIC_KEY) {
    return new NextResponse(
      "Audition Room isn’t connected to its database yet. In Vercel, add NEXT_PUBLIC_SUPABASE_URL and " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY under Settings → Environment Variables, then redeploy.",
      { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } },
    );
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    SUPABASE_URL,
    SUPABASE_PUBLIC_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  const { data } = await supabase.auth.getUser();

  if (!data.user && request.nextUrl.pathname.startsWith("/app")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(request.nextUrl.pathname)}`;
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ["/app/:path*", "/login"],
};
