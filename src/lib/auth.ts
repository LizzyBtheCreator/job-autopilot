import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function authClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(toSet) {
          try {
            toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Called from a Server Component, where cookies are read-only. proxy.ts refreshes them.
          }
        },
      },
    },
  );
}

// Returns the signed-in user's email, or null. Only the address in ALLOWED_EMAIL is let in, so a
// stranger who signs up through Supabase still sees nothing.
export async function currentUserEmail(): Promise<string | null> {
  const supabase = await authClient();
  const { data } = await supabase.auth.getUser();
  const email = data.user?.email?.toLowerCase() ?? null;
  if (!email) return null;
  const allowed = process.env.ALLOWED_EMAIL?.trim().toLowerCase();
  if (!allowed || email !== allowed) return null;
  return email;
}

export function unauthorized() {
  return Response.json({ error: "Not signed in" }, { status: 401 });
}
