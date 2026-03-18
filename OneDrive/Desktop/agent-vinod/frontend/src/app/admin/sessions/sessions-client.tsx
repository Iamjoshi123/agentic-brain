"use client";

import { useEffect, useMemo, useState } from "react";

import { AdminShell } from "@/components/admin-shell";
import { adminApi } from "@/lib/api";

function parseList(source?: string | null) {
  if (!source) return [];
  try {
    const value = JSON.parse(source);
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function formatDate(source?: string | null) {
  if (!source) return "Recently";
  const date = new Date(source);
  if (Number.isNaN(date.getTime())) return "Recently";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function AdminSessionsClient({
  initialWorkspaceId,
  initialSessionId,
}: {
  initialWorkspaceId?: string;
  initialSessionId?: string;
}) {
  const [sessions, setSessions] = useState<any[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(initialSessionId ?? null);
  const [detail, setDetail] = useState<any>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    void adminApi.listSessions(initialWorkspaceId).then((data) => {
      setSessions(data);
      setSelectedSessionId((current) => current ?? data[0]?.id ?? null);
    });
  }, [initialWorkspaceId]);

  useEffect(() => {
    if (!selectedSessionId) return;
    void adminApi.getSessionDetail(selectedSessionId).then(setDetail);
  }, [selectedSessionId]);

  const filteredSessions = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return sessions;
    return sessions.filter((session) => `${session.buyer_name || ""} ${session.product_name || ""}`.toLowerCase().includes(term));
  }, [search, sessions]);

  return (
    <AdminShell
      title="Sessions"
      description="Review what happened in every demo, then use the transcript and unanswered questions to improve the next one."
    >
      <div className="grid gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
        <aside className="rounded-[24px] border border-[var(--border-subtle)] bg-[rgba(255,255,255,0.92)] px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="admin-eyebrow">Sessions</p>
              <h2 className="mt-2 text-[1.35rem] font-medium tracking-[-0.04em] text-[var(--text-primary)]">All products</h2>
            </div>
            <span className="badge">{filteredSessions.length}</span>
          </div>
          <input
            className="input mt-4"
            placeholder="Search by prospect or product"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <div className="mt-4 overflow-hidden rounded-[18px] border border-[var(--border-subtle)]">
            <div className="grid grid-cols-[1.15fr_0.9fr_90px] gap-3 bg-[var(--surface-muted)] px-4 py-3 text-[11px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
              <span>Prospect</span>
              <span>Product</span>
              <span>Intent</span>
            </div>
            {filteredSessions.length ? filteredSessions.map((session) => (
              <button
                key={session.id}
                onClick={() => setSelectedSessionId(session.id)}
                className="admin-table-row grid w-full grid-cols-[1.15fr_0.9fr_90px] gap-3 px-4 py-3 text-left"
                style={{ background: selectedSessionId === session.id ? "rgba(252,248,239,0.98)" : undefined }}
              >
                <div>
                  <p className="text-sm text-[var(--text-primary)]">{session.buyer_name || "Anonymous prospect"}</p>
                  <p className="mt-1 text-xs text-[var(--text-tertiary)]">{formatDate(session.started_at)}</p>
                </div>
                <p className="text-sm text-[var(--text-secondary)]">{session.product_name || "Unknown product"}</p>
                <p className="text-sm text-[var(--text-primary)]">{session.lead_intent_score ?? 0}</p>
              </button>
            )) : (
              <div className="px-4 py-8 text-center text-sm text-[var(--text-secondary)]">No sessions match this search.</div>
            )}
          </div>
        </aside>

        <section className="space-y-4">
          {!detail ? (
            <div className="admin-empty px-6 py-14 text-center text-sm text-[var(--text-secondary)]">
              Select a session to inspect the transcript and the questions it surfaced.
            </div>
          ) : (
            <>
              <div className="rounded-[24px] border border-[var(--border-subtle)] bg-[rgba(255,255,255,0.92)] px-5 py-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="admin-eyebrow">Session</p>
                    <h2 className="mt-2 text-[1.5rem] font-medium tracking-[-0.04em] text-[var(--text-primary)]">
                      {detail.session?.buyer_name || "Anonymous prospect"}
                    </h2>
                    <p className="mt-2 text-sm text-[var(--text-secondary)]">
                      {detail.session?.product_name || "Product"} · {formatDate(detail.session?.started_at)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="badge">intent {detail.summary?.lead_intent_score ?? 0}</span>
                    <span className="badge">{detail.summary?.total_messages ?? detail.messages?.length ?? 0} messages</span>
                    <span className="badge">{detail.summary?.total_actions ?? detail.actions?.length ?? 0} actions</span>
                  </div>
                </div>
              </div>

              <div className="rounded-[24px] border border-[var(--border-subtle)] bg-[rgba(255,255,255,0.92)] px-5 py-5">
                <p className="admin-eyebrow">Transcript</p>
                <h2 className="mt-2 text-[1.35rem] font-medium tracking-[-0.04em] text-[var(--text-primary)]">Conversation</h2>
                <div className="mt-5 space-y-3">
                  {detail.messages?.map((message: any) => (
                    <div key={message.id} className="rounded-[18px] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.14em] text-[var(--text-tertiary)]">{message.role}</p>
                      <p className="mt-2 text-sm leading-6 text-[var(--text-primary)]">{message.content}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <div className="rounded-[24px] border border-[var(--border-subtle)] bg-[rgba(255,255,255,0.92)] px-5 py-5">
                  <p className="admin-eyebrow">Insights</p>
                  <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">
                    {detail.summary?.summary_text || "No summary available for this session."}
                  </p>
                  <div className="mt-4 grid gap-4 md:grid-cols-3">
                    <div>
                      <p className="admin-eyebrow">Top questions</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {parseList(detail.summary?.top_questions).map((item) => <span key={item} className="badge">{item}</span>)}
                      </div>
                    </div>
                    <div>
                      <p className="admin-eyebrow">Features interest</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {parseList(detail.summary?.features_interest).map((item) => <span key={item} className="badge">{item}</span>)}
                      </div>
                    </div>
                    <div>
                      <p className="admin-eyebrow">Objections</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {parseList(detail.summary?.objections).map((item) => <span key={item} className="badge">{item}</span>)}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-[24px] border border-[var(--border-subtle)] bg-[rgba(255,255,255,0.92)] px-5 py-5">
                  <p className="admin-eyebrow">Sources used</p>
                  <h2 className="mt-2 text-[1.35rem] font-medium tracking-[-0.04em] text-[var(--text-primary)]">Citations</h2>
                  <div className="mt-4 space-y-3">
                    {detail.citations_used?.length ? detail.citations_used.map((citation: any) => (
                      <div key={citation.document_id} className="rounded-[18px] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-4 py-3">
                        <p className="text-sm text-[var(--text-primary)]">{citation.title}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.14em] text-[var(--text-tertiary)]">{citation.source_type}</p>
                        <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{citation.excerpt}</p>
                      </div>
                    )) : <p className="text-sm text-[var(--text-secondary)]">No citations were captured for this session.</p>}
                  </div>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </AdminShell>
  );
}
