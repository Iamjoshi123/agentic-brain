"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { adminApi } from "@/lib/api";
import type { AdminProduct, AdminSessionInfo } from "@/types/api";

type AdminShellProps = {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
};

type NavItem = {
  href: string;
  label: string;
  section: string;
  icon: "dashboard" | "products" | "sessions" | "share" | "branding" | "settings";
  matches: (pathname: string | null) => boolean;
};

const PRODUCT_STORAGE_KEY = "agent-vinod-admin-product";

const NAV_ITEMS: NavItem[] = [
  {
    href: "/admin",
    label: "Dashboard",
    section: "Overview",
    icon: "dashboard",
    matches: (pathname) => pathname === "/admin",
  },
  {
    href: "/admin/products",
    label: "Products",
    section: "Overview",
    icon: "products",
    matches: (pathname) =>
      pathname === "/admin/products" ||
      pathname?.startsWith("/admin/products/") === true,
  },
  {
    href: "/admin/sessions",
    label: "Sessions",
    section: "Overview",
    icon: "sessions",
    matches: (pathname) => pathname === "/admin/sessions" || pathname?.startsWith("/admin/sessions/") === true,
  },
  {
    href: "/admin/embed-share",
    label: "Embed & Share",
    section: "Configure",
    icon: "share",
    matches: (pathname) => pathname === "/admin/embed-share" || pathname?.startsWith("/admin/embed-share/") === true,
  },
  {
    href: "/admin/branding",
    label: "Branding",
    section: "Configure",
    icon: "branding",
    matches: (pathname) => pathname === "/admin/branding" || pathname?.startsWith("/admin/branding/") === true,
  },
  {
    href: "/admin/settings",
    label: "Settings",
    section: "Configure",
    icon: "settings",
    matches: (pathname) => pathname === "/admin/settings" || pathname?.startsWith("/admin/settings/") === true,
  },
];

function Icon({ name, active }: { name: NavItem["icon"]; active: boolean }) {
  const color = active ? "var(--text-primary)" : "var(--text-secondary)";

  const paths: Record<NavItem["icon"], React.ReactNode> = {
    dashboard: (
      <>
        <rect x="4.5" y="4.5" width="6.75" height="6.75" rx="1.5" />
        <rect x="12.75" y="4.5" width="6.75" height="10.5" rx="1.5" />
        <rect x="4.5" y="12.75" width="6.75" height="6.75" rx="1.5" />
        <rect x="12.75" y="16.5" width="6.75" height="3.75" rx="1.5" />
      </>
    ),
    products: (
      <>
        <path d="M4.5 6.75h15" />
        <path d="M4.5 12h15" />
        <path d="M4.5 17.25h15" />
        <path d="M7.5 4.5v15" />
      </>
    ),
    sessions: (
      <>
        <rect x="4.5" y="5.25" width="15" height="13.5" rx="2.25" />
        <path d="M8.25 9h7.5" />
        <path d="M8.25 12.75h7.5" />
        <path d="M8.25 16.5h4.5" />
      </>
    ),
    share: (
      <>
        <path d="M8.625 12a3 3 0 0 0 0 4.243l1.125 1.125a3 3 0 0 0 4.243 0l2.25-2.25a3 3 0 0 0 0-4.243" />
        <path d="M15.375 12a3 3 0 0 0 0-4.243L14.25 6.632a3 3 0 0 0-4.243 0l-2.25 2.25a3 3 0 0 0 0 4.243" />
        <path d="M9.75 14.25 14.25 9.75" />
      </>
    ),
    branding: (
      <>
        <path d="M12 4.5c2.79 0 5.25 2.19 5.25 4.875 0 1.02-.36 1.905-1.08 2.67-.555.6-.84 1.17-.84 1.71v.12c0 1.005-.81 1.875-1.875 1.875H9.375A1.88 1.88 0 0 1 7.5 13.875v-.12c0-.54-.285-1.11-.84-1.71-.72-.765-1.08-1.65-1.08-2.67C5.58 6.69 8.04 4.5 10.83 4.5H12Z" />
        <path d="M9 19.125h6" />
      </>
    ),
    settings: (
      <>
        <path d="M12 8.625a3.375 3.375 0 1 0 0 6.75 3.375 3.375 0 0 0 0-6.75Z" />
        <path d="M19.125 12a7.143 7.143 0 0 0-.09-1.095l1.89-1.47-1.8-3.12-2.28.705a7.36 7.36 0 0 0-1.89-1.095L14.625 3h-3.75l-.33 2.925a7.36 7.36 0 0 0-1.89 1.095l-2.28-.705-1.8 3.12 1.89 1.47a7.143 7.143 0 0 0 0 2.19l-1.89 1.47 1.8 3.12 2.28-.705a7.36 7.36 0 0 0 1.89 1.095l.33 2.925h3.75l.33-2.925a7.36 7.36 0 0 0 1.89-1.095l2.28.705 1.8-3.12-1.89-1.47c.06-.36.09-.726.09-1.095Z" />
      </>
    ),
  };

  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[18px] w-[18px] shrink-0"
      fill="none"
      stroke={color}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

function buildProductHref(pathname: string | null, searchParams: URLSearchParams, productId: string) {
  if (!pathname || pathname === "/admin" || pathname === "/admin/products") {
    return `/admin/products/${productId}`;
  }

  if (pathname.startsWith("/admin/products/")) {
    return `/admin/products/${productId}`;
  }

  if (pathname === "/admin/sessions") {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("workspaceId", productId);
    const query = nextParams.toString();
    return query ? `/admin/sessions?${query}` : "/admin/sessions";
  }

  return `/admin/products/${productId}`;
}

export function AdminShell({ title, description, actions, children }: AdminShellProps) {
  const pathname = usePathname();
  const [session, setSession] = useState<AdminSessionInfo | null>(null);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [preferredProductId, setPreferredProductId] = useState<string | null>(null);
  const [searchString, setSearchString] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currentSection = useMemo(
    () => NAV_ITEMS.find((item) => item.matches(pathname)),
    [pathname],
  );

  const groupedItems = useMemo(
    () =>
      ["Overview", "Configure"].map((section) => ({
        section,
        items: NAV_ITEMS.filter((item) => item.section === section),
      })),
    [],
  );

  const routeProductId = useMemo(() => {
    if (!pathname?.startsWith("/admin/products/")) return null;
    return pathname.split("/")[3] ?? null;
  }, [pathname]);

  const queryProductId = useMemo(
    () => new URLSearchParams(searchString).get("workspaceId"),
    [searchString],
  );
  const selectedProductId = routeProductId ?? queryProductId ?? preferredProductId ?? products[0]?.id ?? null;
  const selectedProduct = products.find((product) => product.id === selectedProductId) ?? null;

  useEffect(() => {
    if (typeof window === "undefined") return;
    setSearchString(window.location.search);
  }, [pathname]);

  useEffect(() => {
    try {
      setPreferredProductId(window.localStorage.getItem(PRODUCT_STORAGE_KEY));
    } catch {
      setPreferredProductId(null);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadShell() {
      setLoading(true);

      const [sessionResult, productResult] = await Promise.allSettled([
        adminApi.me(),
        adminApi.listProducts(),
      ]);

      if (cancelled) return;

      if (sessionResult.status === "fulfilled") {
        setSession(sessionResult.value);
        setError(null);
      } else {
        const reason = sessionResult.reason;
        setSession(null);
        setError(reason instanceof Error ? reason.message : "Failed to load admin session");
      }

      if (productResult.status === "fulfilled") {
        setProducts(productResult.value);
      } else {
        setProducts([]);
      }

      setLoading(false);
    }

    void loadShell();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedProductId) return;
    try {
      window.localStorage.setItem(PRODUCT_STORAGE_KEY, selectedProductId);
    } catch {
      // Ignore local storage failures.
    }
  }, [selectedProductId]);

  function handleProductChange(nextProductId: string) {
    setPreferredProductId(nextProductId);
    if (typeof window === "undefined") return;
    window.location.assign(buildProductHref(pathname, new URLSearchParams(searchString), nextProductId));
  }

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
      <div className="mx-auto max-w-[1500px] px-4 py-4 lg:px-6 lg:py-5">
        <div className="grid gap-6 lg:grid-cols-[264px_minmax(0,1fr)]">
          <aside className="admin-sidebar rounded-[24px] p-4 lg:sticky lg:top-5 lg:h-[calc(100vh-2.5rem)]">
            <div className="flex h-full flex-col">
              <div className="space-y-3 px-3 py-2">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-[12px] bg-[var(--surface-accent)] text-sm font-medium text-[var(--accent-primary)]">
                    {session.organization.name.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="admin-truncate text-sm text-[var(--text-primary)]">DemoAgent</p>
                    <p className="admin-truncate text-sm text-[var(--text-secondary)]" title={session.organization.name}>
                      {session.organization.name}
                    </p>
                  </div>
                </div>
                <span className="admin-command-pill max-w-full self-start">{session.role}</span>
              </div>

              <nav className="mt-6 space-y-5">
                {groupedItems.map((group) => (
                  <div key={group.section}>
                    <p className="admin-eyebrow px-3">{group.section}</p>
                    <div className="mt-2 space-y-1">
                      {group.items.map((item) => {
                        const active = item.matches(pathname);
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            className="admin-nav-link"
                            data-active={active ? "true" : "false"}
                          >
                            <div className="flex items-center gap-3">
                              <Icon name={item.icon} active={active} />
                              <span>{item.label}</span>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </nav>

              <div className="mt-auto space-y-4 border-t border-[var(--border-subtle)] pt-4">
                <div className="space-y-2">
                  <p className="admin-eyebrow px-3">Product context</p>
                  <div className="rounded-[12px] border border-[var(--border-subtle)] bg-[var(--surface-overlay)] px-3 py-3">
                    <label className="mb-2 block text-sm text-[var(--text-secondary)]" htmlFor="product-switcher">
                      Selected product
                    </label>
                    <select
                      id="product-switcher"
                      className="input"
                      value={selectedProductId ?? ""}
                      onChange={(event) => handleProductChange(event.target.value)}
                      disabled={!products.length}
                    >
                      {products.length ? (
                        products.map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.name}
                          </option>
                        ))
                      ) : (
                        <option value="">No products available</option>
                      )}
                    </select>
                    <p
                      className="admin-wrap mt-2 text-sm text-[var(--text-tertiary)]"
                      title={selectedProduct?.product_url || "Switch to jump into a product or filter sessions by product."}
                    >
                      {selectedProduct?.product_url || "Switch to jump into a product or filter sessions by product."}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 px-3 py-2">
                  <div className="min-w-0">
                    <p className="admin-truncate text-sm text-[var(--text-primary)]" title={session.user.full_name}>
                      {session.user.full_name}
                    </p>
                    <p className="admin-truncate text-sm text-[var(--text-secondary)]" title={session.user.email}>
                      {session.user.email}
                    </p>
                  </div>
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--surface-accent)] text-sm text-[var(--accent-primary)]">
                    {session.user.full_name.slice(0, 1).toUpperCase()}
                  </div>
                </div>
              </div>
            </div>
          </aside>

          <main className="admin-main">
            <div className="admin-header-card rounded-[26px] px-6 py-6 lg:px-7">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="min-w-0 max-w-4xl">
                  <p className="admin-eyebrow">{currentSection?.label || "Admin"}</p>
                  <h1 className="mt-3 text-[2.6rem] font-medium leading-none tracking-[-0.045em] text-[var(--text-primary)] sm:text-[3rem]">
                    {title}
                  </h1>
                  {description ? (
                    <p className="mt-3 max-w-3xl text-[15px] leading-7 text-[var(--text-secondary)]">{description}</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-3 lg:justify-end">
                  {selectedProduct ? (
                    <span className="badge max-w-[220px]" title={selectedProduct.name}>
                      {selectedProduct.name}
                    </span>
                  ) : null}
                  <span className="badge max-w-[160px]" title={session.organization.slug}>
                    {session.organization.slug}
                  </span>
                  {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
                </div>
              </div>
            </div>

            <div className="mt-6 space-y-4">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
