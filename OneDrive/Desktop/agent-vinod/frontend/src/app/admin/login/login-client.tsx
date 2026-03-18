"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { adminApi } from "@/lib/api";

export default function AdminLoginClient({ inviteToken }: { inviteToken?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("admin@demoagent.local");
  const [password, setPassword] = useState("demo1234");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await adminApi.login(email, password);
      router.push("/admin");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="admin-theme min-h-screen px-6 py-8 lg:px-8 lg:py-10">
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-[1220px] items-stretch gap-5 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="flex flex-col justify-between rounded-[36px] border border-[var(--border-subtle)] bg-[var(--surface-overlay)] p-8 shadow-[var(--shadow-panel)] lg:p-10">
          <div>
            <p className="admin-eyebrow">Product Demo Console</p>
            <h1 className="mt-4 max-w-xl font-display text-5xl leading-[0.96] text-[var(--text-primary)]">
              Operate demos, knowledge, and buyer insight from one calm workspace.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-[var(--text-secondary)]">
              The admin side should feel like an actual product surface, not a debug panel. This console keeps product setup, session review, and knowledge operations in one place.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {[
              ["Knowledge", "Docs, files, videos, and custom entries become agent-ready context."],
              ["Sessions", "Review transcripts, replay metadata, and positive intent after every run."],
              ["Control", "Tune voice, behavior, share flows, and branding without touching buyer routes."],
            ].map(([label, detail]) => (
              <div key={label} className="rounded-[24px] border border-[var(--border-subtle)] bg-[rgba(255,255,255,0.72)] p-4">
                <p className="text-sm font-medium text-[var(--text-primary)]">{label}</p>
                <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{detail}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[36px] border border-[var(--border-subtle)] bg-[rgba(255,255,255,0.88)] p-8 shadow-[var(--shadow-panel)] lg:p-10">
          <p className="admin-eyebrow">Admin Access</p>
          <h2 className="mt-3 font-display text-4xl text-[var(--text-primary)]">Sign in</h2>
          <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
            Use the bootstrap owner account to configure products, knowledge sources, and session insights.
          </p>
          {inviteToken ? (
            <div className="mt-5 rounded-2xl border border-[var(--border-active)] bg-[var(--accent-primary-muted)] px-4 py-3 text-sm leading-6 text-[var(--text-primary)]">
              Invite token detected. Sign in first, then add this teammate from Settings.
            </div>
          ) : null}
          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--text-primary)]">Email</label>
              <input className="input" value={email} onChange={(event) => setEmail(event.target.value)} />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--text-primary)]">Password</label>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
            {error ? <p className="text-sm text-[var(--error)]">{error}</p> : null}
            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? "Signing in..." : "Enter Admin Console"}
            </button>
          </form>
          <div className="admin-divider my-7" />
          <div className="grid gap-3 text-sm text-[var(--text-secondary)]">
            <div className="flex items-center justify-between rounded-2xl bg-[var(--surface-muted)] px-4 py-3">
              <span>Default owner</span>
              <span className="font-medium text-[var(--text-primary)]">admin@demoagent.local</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-[var(--surface-muted)] px-4 py-3">
              <span>Environment</span>
              <span className="font-medium text-[var(--text-primary)]">Local development</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
