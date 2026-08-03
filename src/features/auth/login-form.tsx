"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { recordLogin } from "@/features/users/actions";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const configured = isSupabaseConfigured();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (!configured) {
      setError("Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local");
      return;
    }
    setBusy(true);
    try {
      const supabase = createClient();
      if (mode === "signin") {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
        try {
          await recordLogin({
            userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
            referrer: typeof document !== "undefined" ? document.referrer || undefined : undefined,
          });
        } catch {
          /* activity table may not exist yet */
        }
        window.location.href = "/boards/catalog";
      } else {
        const { error: err } = await supabase.auth.signUp({ email, password });
        if (err) throw err;
        setMessage("Check your email to confirm, or sign in if confirmations are disabled.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Auth failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>OAS Pin Library</h1>
        <p>
          Sign in to sync pins with Supabase. Without auth, the app still runs on local seed
          data.
        </p>
        <form onSubmit={onSubmit}>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Sign up"}
          </button>
        </form>
        {error ? <p className="login-error">{error}</p> : null}
        {message ? <p className="auth-hint">{message}</p> : null}
        <p className="auth-hint">
          {mode === "signin" ? (
            <>
              No account?{" "}
              <button type="button" className="btn btn-ghost" onClick={() => setMode("signup")}>
                Sign up
              </button>
            </>
          ) : (
            <>
              Have an account?{" "}
              <button type="button" className="btn btn-ghost" onClick={() => setMode("signin")}>
                Sign in
              </button>
            </>
          )}
        </p>
        <p className="auth-hint">
          <Link href="/boards/catalog">Continue without signing in →</Link>
        </p>
      </div>
    </div>
  );
}
