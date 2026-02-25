"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/context/auth-context";

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    const result = await register(name, email, password);

    if (result.success) {
      router.push("/");
    } else {
      setError(result.error ?? "Something went wrong.");
    }

    setLoading(false);
  };

  const inputClass =
    "border border-[var(--border)] focus:border-[var(--foreground)] outline-none px-4 py-3 w-full text-sm bg-transparent text-[var(--foreground)] transition-colors placeholder:text-[var(--foreground-subtle)]";

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: "var(--background)" }}
    >
      {/* Logo */}
      <div className="mb-10">
        <Link
          href="/"
          className="font-display text-2xl tracking-[0.2em] uppercase text-[var(--foreground)]"
        >
          GOO
        </Link>
      </div>

      {/* Card */}
      <div
        className="w-full max-w-sm border border-[var(--border)] p-10"
        style={{ background: "var(--surface)" }}
      >
        {/* Title */}
        <h1 className="font-display text-3xl font-light text-[var(--foreground)] mb-2">
          Create account.
        </h1>
        <p className="text-xs text-[var(--foreground-muted)] tracking-wide mb-8">
          Join GOO and discover your personal style.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-[10px] uppercase tracking-[0.14em] text-[var(--foreground-muted)] mb-1.5">
              Full Name
            </label>
            <input
              type="text"
              required
              autoComplete="name"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-[0.14em] text-[var(--foreground-muted)] mb-1.5">
              Email
            </label>
            <input
              type="email"
              required
              autoComplete="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-[0.14em] text-[var(--foreground-muted)] mb-1.5">
              Password
            </label>
            <input
              type="password"
              required
              autoComplete="new-password"
              placeholder="Min. 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
          </div>

          {error && (
            <p className="text-xs text-red-500 leading-relaxed">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full bg-[var(--foreground)] text-[var(--background)] py-3.5 text-xs tracking-[0.14em] uppercase transition-opacity disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
          >
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </form>

        <p className="mt-6 text-xs text-[var(--foreground-muted)] text-center">
          Already have an account?{" "}
          <Link
            href="/login"
            className="text-[var(--foreground)] underline underline-offset-2"
          >
            Sign in &rarr;
          </Link>
        </p>
      </div>
    </div>
  );
}
