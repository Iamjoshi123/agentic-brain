"use client";

import { useEffect, useState } from "react";

import { AdminShell } from "@/components/admin-shell";
import { adminApi } from "@/lib/api";
import type { BrandingSettings } from "@/types/api";

const DEFAULT_BRANDING: BrandingSettings = {
  company_name: "DemoAgent",
  logo_url: "",
  primary_color: "#D4963E",
  accent_color: "#1A1A1A",
};

export default function AdminBrandingPage() {
  const [branding, setBranding] = useState<BrandingSettings>(DEFAULT_BRANDING);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    adminApi
      .getBranding()
      .then((payload) => {
        if (!cancelled) {
          setBranding({
            company_name: payload.company_name,
            logo_url: payload.logo_url || "",
            primary_color: payload.primary_color,
            accent_color: payload.accent_color,
          });
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

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = await adminApi.updateBranding(branding);
      setBranding({
        company_name: payload.company_name,
        logo_url: payload.logo_url || "",
        primary_color: payload.primary_color,
        accent_color: payload.accent_color,
      });
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save branding.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminShell
      title="Branding"
      description="Set the global company identity and default colors used by the admin console and shared demo surfaces."
    >
      {error ? <p className="text-sm text-[var(--error)]">{error}</p> : null}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <form onSubmit={handleSubmit} className="rounded-[24px] border border-[var(--border-subtle)] bg-[rgba(255,255,255,0.92)] px-5 py-5">
          <p className="admin-eyebrow">Identity</p>
          <h2 className="mt-2 text-[1.45rem] font-medium tracking-[-0.04em] text-[var(--text-primary)]">
            Brand settings
          </h2>
          <div className="mt-5 grid gap-4">
            <div>
              <label className="mb-2 block text-sm text-[var(--text-primary)]">Company name</label>
              <input
                className="input"
                value={branding.company_name}
                onChange={(event) => setBranding({ ...branding, company_name: event.target.value })}
              />
            </div>
            <div>
              <label className="mb-2 block text-sm text-[var(--text-primary)]">Logo URL</label>
              <input
                className="input"
                value={branding.logo_url}
                onChange={(event) => setBranding({ ...branding, logo_url: event.target.value })}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm text-[var(--text-primary)]">Primary color</label>
                <input
                  className="input"
                  value={branding.primary_color}
                  onChange={(event) => setBranding({ ...branding, primary_color: event.target.value })}
                />
              </div>
              <div>
                <label className="mb-2 block text-sm text-[var(--text-primary)]">Accent color</label>
                <input
                  className="input"
                  value={branding.accent_color}
                  onChange={(event) => setBranding({ ...branding, accent_color: event.target.value })}
                />
              </div>
            </div>
          </div>
          <div className="mt-5 flex justify-end">
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Saving..." : "Save branding"}
            </button>
          </div>
        </form>

        <section className="rounded-[24px] border border-[var(--border-subtle)] bg-[rgba(255,255,255,0.92)] px-5 py-5">
          <p className="admin-eyebrow">Preview</p>
          <div className="mt-5 rounded-[20px] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-5 py-6">
            <div className="flex items-center gap-3">
              <div
                className="flex h-11 w-11 items-center justify-center rounded-[14px] text-base"
                style={{ background: `${branding.primary_color}18`, color: branding.primary_color }}
              >
                {branding.company_name.slice(0, 1).toUpperCase() || "D"}
              </div>
              <div>
                <p className="text-sm text-[var(--text-secondary)]">Global brand</p>
                <p className="text-lg text-[var(--text-primary)]">{branding.company_name || "DemoAgent"}</p>
              </div>
            </div>
            <div className="mt-5 flex gap-2">
              <span className="badge" style={{ borderColor: `${branding.primary_color}33`, color: branding.primary_color }}>
                Primary
              </span>
              <span className="badge" style={{ borderColor: `${branding.accent_color}33`, color: branding.accent_color }}>
                Accent
              </span>
            </div>
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
