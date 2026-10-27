import { authClient } from "@/lib/auth";

export async function POST(req: Request) {
  const supabase = await authClient();
  await supabase.auth.signOut();
  return Response.redirect(new URL("/login", req.url), 303);
}
