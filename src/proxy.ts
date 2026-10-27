import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { missingEnv } from "@/lib/env";

function plainError(message: string) {
  return new NextResponse(`${message}\n\nOpen /health on this site for a full check.`, {
    status: 500,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

// Keeps the Supabase session cookie fresh and sends signed-out visitors to /login.
// Pages and API routes still check the user themselves; this is only the first gate.
export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (path === "/health") return NextResponse.next();

  const missing = missingEnv().filter((k) => k.startsWith("NEXT_PUBLIC_SUPABASE"));
  if (missing.length) {
    return plainError(`Job Autopilot can't start. These Vercel environment variables are missing for this deployment: ${missing.join(", ")}`);
  }

  let response = NextResponse.next({ request });
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(toSet) {
            toSet.forEach(({ name, value }) => request.cookies.set(name, value));
            response = NextResponse.next({ request });
            toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          },
        },
      },
    );

    const { data } = await supabase.auth.getUser();
    if (!data.user && path !== "/login" && !path.startsWith("/api/") && !path.startsWith("/auth/")) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
    return response;
  } catch (e) {
    return plainError(`Job Autopilot could not reach Supabase: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
