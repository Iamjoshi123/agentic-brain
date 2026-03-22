"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { AdminShell } from "@/components/admin-shell";
import { adminApi } from "@/lib/api";
import type { DashboardPayload } from "@/types/api";

function StatCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <div className="admin-kpi rounded-[24px] px-5 py-5">
      <p className="admin-eyebrow">{label}</p>
      <p className="mt-3 text-[2rem] font-medium tracking-[-0.04em] text-[var(--text-primary)]">{value}</p>
      <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{detail}</p>
    </div>
  );
}

function SignalList({
  title,
  items,
  empty,
}: {
  title: string;
  items: string[];
  empty: string;
}) {
  return (
    <div className="rounded-[24px] border border-[var(--border-subtle)] bg-[rgba(255,255,255,0.92)] px-5 py-5">
      <p className="admin-eyebrow">{title}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {items.length ? (
          items.map((item) => (
            <span key={item} className="badge">
              {item}
            </span>
          ))
        ) : (
          <p className="text-sm text-[var(--text-secondary)]">{empty}</p>
        )}
      </div>
    </div>
  );
}

export default function AdminDashboardPage() {
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    adminApi
      .getDashboard()
      .then((payload) => {
        if (!cancelled) {
          setDashboard(payload);
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
      title="Dashboard"
      description="Keep an eye on live demo activity, buyer intent, and which products need more knowledge work."
      actions={
        <Link href="/admin/products" className="btn-primary">
          Manage products
        </Link>
      }
    >
      {error ? <p className="text-sm text-[var(--error)]">{error}</p> : null}
      {!dashboard ? (
        <div className="rounded-[24px] border border-[var(--border-subtle)] bg-[rgba(255,255,255,0.92)] px-5 py-6 text-sm text-[var(--text-secondary)]">
          Loading dashboard...
        </div>
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Demos taken"
              value={dashboard.stats.demos_taken}
              detail="All buyer sessions captured across live and text demos."
            />
            <StatCard
              label="Completed demos"
              value={dashboard.stats.completed_demos}
              detail="Sessions that reached a meaningful end state."
            />
            <StatCard
              label="Positive intent"
              value={dashboard.stats.positive_intent_sessions}
              detail="Sessions currently worth follow-up from a sales perspective."
            />
            <StatCard
              label="Average intent"
              value={dashboard.stats.average_intent_score}
              detail="Mean lead score across completed sessions."
            />
          </section>

          <section className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
            <div className="rounded-[24px] border border-[var(--border-subtle)] bg-[rgba(255,255,255,0.92)] px-5 py-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="admin-eyebrow">Products</p>
                  <h2 className="mt-2 text-[1.45rem] font-medium tracking-[-0.04em] text-[var(--text-primary)]">
                    Product overview
                  </h2>
                </div>
                <Link href="/admin/products" className="btn-secondary">
                  Open products
                </Link>
              </div>
              <div className="mt-5 overflow-hidden rounded-[18px] border border-[var(--border-subtle)]">
                <div className="grid grid-cols-[minmax(0,1.2fr)_110px_110px] gap-3 bg-[var(--surface-muted)] px-4 py-3 text-[11px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
                  <span>Product</span>
                  <span>Sources</span>
                  <span>Sessions</span>
                </div>
                {dashboard.products.length ? (
                  dashboard.products.map((product) => (
                    <Link
                      key={product.id}
                      href={`/admin/products/${product.id}`}
                      className="admin-table-row grid grid-cols-[minmax(0,1.2fr)_110px_110px] gap-3 px-4 py-4"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm text-[var(--text-primary)]">{product.name}</p>
                        <p className="mt-1 truncate text-sm text-[var(--text-secondary)]">
                          {product.description || product.product_url || "No product summary yet."}
                        </p>
                      </div>
                      <p className="text-sm text-[var(--text-primary)]">{product.knowledge_count}</p>
                      <p className="text-sm text-[var(--text-primary)]">{product.session_count}</p>
                    </Link>
                  ))
                ) : (
                  <div className="px-4 py-8 text-sm text-[var(--text-secondary)]">No products have been configured yet.</div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <SignalList
                title="Top questions"
                items={dashboard.reports.top_questions}
                empty="No questions have been captured yet."
              />
              <SignalList
                title="Objections"
                items={dashboard.reports.objections}
                empty="No objections have been captured yet."
              />
              <SignalList
                title="Feature interest"
                items={dashboard.reports.features_interest}
                empty="No feature signals have been captured yet."
              />
            </div>
          </section>
        </>
      )}
    </AdminShell>
  );
}
