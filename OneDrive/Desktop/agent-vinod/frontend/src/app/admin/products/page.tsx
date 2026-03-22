"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { AdminShell } from "@/components/admin-shell";
import { adminApi } from "@/lib/api";
import type { AdminProduct } from "@/types/api";

const EMPTY_PRODUCT = {
  name: "",
  description: "",
  product_url: "",
  allowed_domains: "",
  browser_auth_mode: "credentials",
  is_active: false,
};

function formatTimestamp(source?: string | null) {
  if (!source) return "Just now";
  const date = new Date(source);
  if (Number.isNaN(date.getTime())) return "Just now";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function productState(product: AdminProduct) {
  if (product.is_active) return "Live";
  if (product.knowledge_count > 0) return "Ready";
  if (product.product_url) return "Configuring";
  return "Draft";
}

function ProductsIndexPage({ initialTitle = "Products" }: { initialTitle?: string }) {
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(EMPTY_PRODUCT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadProducts() {
    setLoading(true);
    try {
      setProducts(await adminApi.listProducts());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load products");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadProducts();
  }, []);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await adminApi.createProduct({
        ...form,
        name: form.name.trim(),
        description: "",
        product_url: form.product_url.trim(),
      });
      setForm(EMPTY_PRODUCT);
      setShowCreate(false);
      await loadProducts();
    } finally {
      setSaving(false);
    }
  }

  const stats = useMemo(() => ({
    products: products.length,
    live: products.filter((product) => product.is_active).length,
    sessions: products.reduce((sum, product) => sum + (product.session_count || 0), 0),
  }), [products]);

  return (
    <AdminShell
      title={initialTitle}
      description="Products are the SaaS environments your AI agent can demo. Keep setup simple, then go deeper inside each product."
      actions={(
        <button onClick={() => setShowCreate((value) => !value)} className="btn-primary">
          {showCreate ? "Close" : "+ New"}
        </button>
      )}
    >
      <section className="grid gap-4 md:grid-cols-3">
        <div className="admin-kpi rounded-[24px] px-5 py-4">
          <p className="admin-eyebrow">Products</p>
          <p className="mt-3 text-[2rem] font-medium tracking-[-0.04em] text-[var(--text-primary)]">{stats.products}</p>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">Configured products in this workspace.</p>
        </div>
        <div className="admin-kpi rounded-[24px] px-5 py-4">
          <p className="admin-eyebrow">Live</p>
          <p className="mt-3 text-[2rem] font-medium tracking-[-0.04em] text-[var(--text-primary)]">{stats.live}</p>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">Products currently available to prospects.</p>
        </div>
        <div className="admin-kpi rounded-[24px] px-5 py-4">
          <p className="admin-eyebrow">Sessions</p>
          <p className="mt-3 text-[2rem] font-medium tracking-[-0.04em] text-[var(--text-primary)]">{stats.sessions}</p>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">Lifetime demo sessions across every product.</p>
        </div>
      </section>

      {showCreate ? (
        <form onSubmit={handleCreate} className="rounded-[24px] border border-[var(--border-subtle)] bg-[rgba(255,255,255,0.92)] px-5 py-5">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
            <div>
              <label className="mb-2 block text-sm text-[var(--text-primary)]">Product name</label>
              <input
                aria-label="Product Name"
                className="input"
                placeholder="Saleshandy"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                required
              />
            </div>
            <div>
              <label className="mb-2 block text-sm text-[var(--text-primary)]">Website URL</label>
              <input
                aria-label="Product URL"
                className="input"
                placeholder="https://app.example.com"
                value={form.product_url}
                onChange={(event) => setForm({ ...form, product_url: event.target.value })}
              />
            </div>
            <div className="flex gap-3">
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? "Creating..." : "Create"}
              </button>
              <button type="button" className="btn-secondary" onClick={() => setShowCreate(false)}>
                Cancel
              </button>
            </div>
          </div>
          <p className="mt-3 text-sm text-[var(--text-secondary)]">
            New products start in draft. Add knowledge, tune the agent, then share the live link.
          </p>
        </form>
      ) : null}

      {error ? <p className="text-sm text-[var(--error)]">{error}</p> : null}

      {loading ? (
        <div className="rounded-[24px] border border-[var(--border-subtle)] bg-[rgba(255,255,255,0.9)] px-5 py-6 text-sm text-[var(--text-secondary)]">
          Loading products...
        </div>
      ) : products.length === 0 ? (
        <div className="admin-empty px-8 py-14 text-center">
          <p className="admin-eyebrow">No products yet</p>
          <h2 className="mt-4 text-[2rem] font-medium tracking-[-0.04em] text-[var(--text-primary)]">Add your first product</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-[var(--text-secondary)]">
            A product is the SaaS application you want your AI agent to demo. Start with the name and URL, then configure knowledge and behavior inside it.
          </p>
          <button onClick={() => setShowCreate(true)} className="btn-primary mt-6">
            + New
          </button>
        </div>
      ) : (
        <section className="overflow-hidden rounded-[24px] border border-[var(--border-subtle)] bg-[rgba(255,255,255,0.92)]">
          <div className="hidden grid-cols-[minmax(0,1.45fr)_minmax(0,0.9fr)_108px_108px_132px] gap-4 px-5 py-3 text-xs uppercase tracking-[0.18em] text-[var(--text-tertiary)] md:grid">
            <span>Product</span>
            <span>URL</span>
            <span>State</span>
            <span>Sessions</span>
            <span>Last activity</span>
          </div>
          {products.map((product) => (
            <Link
              key={product.id}
              href={`/admin/products/${product.id}`}
              className="admin-table-row block px-5 py-4"
            >
              <div className="grid gap-3 md:grid-cols-[minmax(0,1.45fr)_minmax(0,0.9fr)_108px_108px_132px] md:items-start md:gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <span className="h-2.5 w-2.5 rounded-full bg-[var(--accent-primary)]" />
                    <p className="admin-truncate text-[1.05rem] text-[var(--text-primary)]" title={product.name}>
                      {product.name}
                    </p>
                  </div>
                  {product.description ? (
                    <p className="admin-wrap mt-2 text-sm leading-6 text-[var(--text-secondary)]" title={product.description}>
                      {product.description}
                    </p>
                  ) : null}
                </div>
                <div className="min-w-0 text-sm text-[var(--text-secondary)]">
                  <span className="admin-wrap" title={product.product_url || "Not set yet"}>
                    {product.product_url || "Not set yet"}
                  </span>
                </div>
                <div className="min-w-0">
                  <span className="badge">{productState(product)}</span>
                </div>
                <div className="text-sm text-[var(--text-primary)]">{product.session_count || 0}</div>
                <div className="text-sm text-[var(--text-secondary)]">{formatTimestamp(product.updated_at)}</div>
              </div>
            </Link>
          ))}
        </section>
      )}
    </AdminShell>
  );
}

export default function AdminProductsPage() {
  return <ProductsIndexPage />;
}
