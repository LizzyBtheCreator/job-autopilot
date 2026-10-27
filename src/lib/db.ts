import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let admin: SupabaseClient | null = null;

// Service-role client. Only used on the server, after requireUser() has passed.
export function db(): SupabaseClient {
  if (!admin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set in Vercel");
    admin = createClient(url, key, { auth: { persistSession: false } });
  }
  return admin;
}
