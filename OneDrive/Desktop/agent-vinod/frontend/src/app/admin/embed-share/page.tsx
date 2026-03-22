"use client";

import { useEffect, useState } from "react";

import { AdminShell } from "@/components/admin-shell";
import { adminApi } from "@/lib/api";
import type { EmbedShareEntry } from "@/types/api";

export default function AdminEmbedSharePage() {
  const [entries, setEntries] = useState<EmbedShareEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    adminApi
      .listEmbedShare()
      .then((payload) => {
        if (!cancelled) {
          setEntries(payload);
          setError(null);
        }
      })
      .catch((cause: Error) => {
        if (!cancelled) {
          setError(cause.message);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AdminShell
      title="Embed & Share"
      description="Use the live meeting link or iframe snippet for each product."
    >
      {error ? <p className="text-sm text-[var(--error)]">{error}</p> : null}
      <div className="space-y-4">
        {entries.map((entry) => (
          <section
            key={entry.product_id}
            className="rounded-[24px] border border-[var(--border-subtle)] bg-[rgba(255,255,255,0.92)] px-5 py-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="admin-eyebrow">Product</p>
                <h2
                  className="admin-wrap mt-2 text-[1.45rem] font-medium tracking-[-0.04em] text-[var(--text-primary)]"
                  title={entry.product_name}
                >
                  {entry.product_name}
                </h2>
              </div>
              <span className="badge max-w-[260px]" title={entry.share_title}>
                {entry.share_title}
              </span>
            </div>
            <div className="mt-5 grid gap-4">
              <div>
                <label className="mb-2 block text-sm text-[var(--text-primary)]">Meeting link</label>
                <code className="admin-code">{entry.live_link}</code>
              </div>
              <div>
                <label className="mb-2 block text-sm text-[var(--text-primary)]">Embed code</label>
                <textarea className="textarea font-mono text-sm" rows={4} readOnly value={entry.embed_code} />
              </div>
            </div>
          </section>
        ))}
        {!entries.length && !error ? (
          <div className="admin-empty px-8 py-14 text-center text-sm text-[var(--text-secondary)]">
            No shareable products yet.
          </div>
        ) : null}
      </div>
    </AdminShell>
  );
}
