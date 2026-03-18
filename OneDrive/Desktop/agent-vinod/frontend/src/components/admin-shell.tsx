"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { adminApi } from "@/lib/api";
import type { AdminSessionInfo } from "@/types/api";

type AdminShellProps = {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
};

const NAV_ITEMS = [
  {
    href: "/admin/products",
    label: "Products",
    hint: "Demo setup, knowledge, behavior",
    matches: (pathname: string | null) => pathname === "/admin" || pathname === "/admin/products" || pathname?.startsWith("/admin/products/"),
  },
  {
    href: "/admin/sessions",
    label: "Sessions",
    hint: "Review transcripts and patterns",
    matches: (pathname: string | null) => pathname === "/admin/sessions" || pathname?.startsWith("/admin/sessions/"),
  },
  {
    href: "/admin/settings",
    label: "Settings",
    hint: "Account, API, billing, brand",
    matches: (pathname: string | null) => pathname === "/admin/settings" || pathname?.startsWith("/admin/settings/"),
  },
];

export function AdminShell({ title, description, actions, children }: AdminShellProps) {
  const pathname = usePathname();
  const [session, setSession] = useState<AdminSessionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currentSection = useMemo(
    () => NAV_ITEMS.find((item) => item.matches(pathname)),
    [pathname],
  );

  useEffect(() => {
    let cancelled = false;

    adminApi
      .me()
      .then((data) => {
        if (!cancelled) {
          setSession(data);
          setError(null);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="admin-theme min-h-screen px-6 py-14">
        <div className="mx-auto max-w-4xl rounded-[28px] border border-[var(--border-subtle)] bg-[var(--surface-overlay)] px-8 py-6 text-sm text-[var(--text-secondary)]">
          Loading admin console...
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="admin-theme min-h-screen px-6 py-16">
        <div className="mx-auto max-w-xl rounded-[28px] border border-[var(--border-subtle)] bg-[var(--surface-overlay)] p-8 text-center">
          <p className="admin-eyebrow">Admin Access</p>
          <h1 className="mt-4 text-[2rem] font-medium tracking-[-0.03em] text-[var(--text-primary)]">Sign in required</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
            The admin console is protected. Sign in to manage products, knowledge, and session history.
          </p>
          <Link href="/admin/login" className="btn-primary mt-6">
            Open Admin Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-theme min-h-screen">
      <div className="admin-shell-grid mx-auto max-w-[1400px] px-4 py-4 lg:px-5 lg:py-5">
        <div className="grid gap-4 lg:grid-cols-[228px_minmax(0,1fr)]">
          <aside className="admin-sidebar rounded-[26px] p-4 lg:sticky lg:top-5 lg:h-[calc(100vh-2.5rem)]">
            <div className="flex h-full flex-col">
              <div className="rounded-[22px] border border-[var(--border-subtle)] bg-[rgba(255,255,255,0.82)] px-4 py-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-[var(--surface-accent)] text-base text-[var(--accent-primary)]">
                    {session.organization.name.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="admin-eyebrow">DemoAgent</p>
                    <p className="truncate text-lg text-[var(--text-primary)]">{session.organization.name}</p>
                  </div>
                </div>
                <div className="mt-4 space-y-1">
                  <p className="text-sm text-[var(--text-primary)]">{session.user.full_name}</p>
                  <p className="truncate text-sm text-[var(--text-secondary)]">{session.user.email}</p>
                </div>
                <div className="mt-4">
                  <span className="badge">{session.role}</span>
                </div>
              </div>

              <nav className="mt-6 space-y-1.5">
                {NAV_ITEMS.map((item) => {
                  const active = item.matches(pathname);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="admin-nav-link"
                      data-active={active ? "true" : "false"}
                    >
                      <span className="block text-sm font-medium text-[var(--text-primary)]">{item.label}</span>
                      <span className="admin-nav-kicker">{item.hint}</span>
                    </Link>
                  );
                })}
              </nav>

              <div className="mt-auto rounded-[20px] border border-[var(--border-subtle)] bg-[rgba(255,255,255,0.72)] px-4 py-4">
                <p className="admin-eyebrow">Principle</p>
                <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                  Keep the setup clear, the agent grounded in product knowledge, and every session easy to review.
                </p>
              </div>
            </div>
          </aside>

          <main className="admin-main">
            <div className="admin-header-card rounded-[26px] px-6 py-6 lg:px-7">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-4xl">
                  <p className="admin-eyebrow">{currentSection?.label || "Admin"}</p>
                  <h1 className="mt-3 text-[2.6rem] font-medium leading-none tracking-[-0.045em] text-[var(--text-primary)] sm:text-[3rem]">
                    {title}
                  </h1>
                  {description ? (
                    <p className="mt-3 max-w-3xl text-[15px] leading-7 text-[var(--text-secondary)]">{description}</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-3 lg:justify-end">
                  <span className="badge">{session.organization.slug}</span>
                  {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-4">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
