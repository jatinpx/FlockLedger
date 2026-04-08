"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch, getToken, setToken } from "@/lib/api";
import { toastError } from "@/lib/toast";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (getToken()) router.replace("/dashboard");
  }, [router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "register") {
        await apiFetch("/auth/register", {
          auth: false,
          method: "POST",
          body: JSON.stringify({ name, email, password }),
        });
      }
      const tok = await apiFetch<{ access_token: string }>("/auth/login", {
        auth: false,
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setToken(tok.access_token);
      router.replace("/dashboard");
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-100 px-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-emerald-900">FlockLedger</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {mode === "login" ? "Sign in to your farm dashboard" : "Create an account"}
        </p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          {mode === "register" && (
            <div>
              <label className="block text-sm font-medium text-zinc-700">
                Name
              </label>
              <input
                className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required={mode === "register"}
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-zinc-700">
              Email
            </label>
            <input
              type="email"
              className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700">
              Password
            </label>
            <input
              type="password"
              className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-md bg-emerald-700 py-2.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
          >
            {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Register"}
          </button>
        </form>
        <button
          type="button"
          className="mt-4 w-full text-center text-sm text-emerald-700"
          onClick={() => {
            setMode(mode === "login" ? "register" : "login");
          }}
        >
          {mode === "login"
            ? "Need an account? Register"
            : "Have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}
