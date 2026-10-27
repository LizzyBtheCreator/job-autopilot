"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }
    window.location.href = "/";
  }

  return (
    <div className="mx-auto mt-16 max-w-sm">
      <h1 className="mb-4 text-xl font-semibold">Sign in</h1>
      <form onSubmit={submit} className="card space-y-3">
        <label className="block text-sm">
          Email
          <input className="input mt-1" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label className="block text-sm">
          Password
          <input className="input mt-1" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="btn-primary w-full" disabled={busy}>{busy ? "Signing in..." : "Sign in"}</button>
      </form>
      <p className="mt-3 text-xs text-stone-500">
        If you sign in and end up back on this page, the ALLOWED_EMAIL setting in Vercel does not match your sign-in email.
      </p>
    </div>
  );
}
