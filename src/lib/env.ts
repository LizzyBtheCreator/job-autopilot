// Settings the app cannot start without. Names only; values are never shown.
export const REQUIRED_ENV = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SERPER_API_KEY",
  "ANTHROPIC_API_KEY",
  "ALLOWED_EMAIL",
] as const;

export function missingEnv(): string[] {
  return REQUIRED_ENV.filter((k) => !process.env[k]?.trim());
}
