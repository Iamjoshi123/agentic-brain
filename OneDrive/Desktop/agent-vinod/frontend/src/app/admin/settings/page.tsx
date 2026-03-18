"use client";

import { useEffect, useState } from "react";

import { AdminShell } from "@/components/admin-shell";
import { adminApi } from "@/lib/api";

export default function AdminSettingsPage() {
  const [account, setAccount] = useState<any>(null);
  const [billing, setBilling] = useState<any>(null);
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [branding, setBranding] = useState({
    company_name: "",
    logo_url: "",
    primary_color: "#D4963E",
    accent_color: "#1A1A1A",
  });
  const [apiKeyForm, setApiKeyForm] = useState({ provider: "openai", label: "Org default", api_key: "", workspace_id: "" });
  const [saving, setSaving] = useState<string | null>(null);

  async function loadAll() {
    const [accountData, billingData, keysData, brandingData] = await Promise.all([
      adminApi.getAccountSettings().catch(() => null),
      adminApi.getBilling().catch(() => null),
      adminApi.getApiKeys().catch(() => []),
      adminApi.getBranding().catch(() => null),
    ]);
    setAccount(accountData);
    setBilling(billingData);
    setApiKeys(keysData);
    if (brandingData) {
      setBranding({
        company_name: brandingData.company_name,
        logo_url: brandingData.logo_url || "",
        primary_color: brandingData.primary_color,
        accent_color: brandingData.accent_color,
      });
    }
  }

  useEffect(() => {
    void loadAll();
  }, []);

  async function handleBranding(event: React.FormEvent) {
    event.preventDefault();
    setSaving("branding");
    try {
      const updated = await adminApi.updateBranding(branding);
      setBranding({
        company_name: updated.company_name,
        logo_url: updated.logo_url || "",
        primary_color: updated.primary_color,
        accent_color: updated.accent_color,
      });
    } finally {
      setSaving(null);
    }
  }

  async function handleApiKey(event: React.FormEvent) {
    event.preventDefault();
    setSaving("api");
    try {
      await adminApi.saveApiKey({
        ...apiKeyForm,
        workspace_id: apiKeyForm.workspace_id || null,
      });
      setApiKeyForm({ provider: "openai", label: "Org default", api_key: "", workspace_id: "" });
      await loadAll();
    } finally {
      setSaving(null);
    }
  }

  return (
    <AdminShell
      title="Settings"
      description="Account-level configuration should stay minimal: identity, API keys, billing state, and a few global brand defaults."
    >
      <div className="space-y-4">
        <div className="grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
          <div className="rounded-[24px] border border-[var(--border-subtle)] bg-[rgba(255,255,255,0.92)] px-5 py-5">
            <p className="admin-eyebrow">Account</p>
            <h2 className="mt-2 text-[1.45rem] font-medium tracking-[-0.04em] text-[var(--text-primary)]">Workspace owner</h2>
            {account ? (
              <div className="mt-5 space-y-3 text-sm text-[var(--text-secondary)]">
                <p><span className="text-[var(--text-primary)]">Organization:</span> {account.organization.name}</p>
                <p><span className="text-[var(--text-primary)]">Owner:</span> {account.user.full_name}</p>
                <p><span className="text-[var(--text-primary)]">Email:</span> {account.user.email}</p>
                <p><span className="text-[var(--text-primary)]">Role:</span> {account.role}</p>
              </div>
            ) : (
              <p className="mt-4 text-sm text-[var(--text-secondary)]">Loading account details...</p>
            )}
          </div>

          <form onSubmit={handleBranding} className="rounded-[24px] border border-[var(--border-subtle)] bg-[rgba(255,255,255,0.92)] px-5 py-5">
            <p className="admin-eyebrow">Brand</p>
            <h2 className="mt-2 text-[1.45rem] font-medium tracking-[-0.04em] text-[var(--text-primary)]">Global identity</h2>
            <div className="mt-5 grid gap-4">
              <div>
                <label className="mb-2 block text-sm text-[var(--text-primary)]">Organization name</label>
                <input className="input" value={branding.company_name} onChange={(event) => setBranding({ ...branding, company_name: event.target.value })} />
              </div>
              <div>
                <label className="mb-2 block text-sm text-[var(--text-primary)]">Logo URL</label>
                <input className="input" value={branding.logo_url} onChange={(event) => setBranding({ ...branding, logo_url: event.target.value })} />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm text-[var(--text-primary)]">Primary color</label>
                  <input className="input" value={branding.primary_color} onChange={(event) => setBranding({ ...branding, primary_color: event.target.value })} />
                </div>
                <div>
                  <label className="mb-2 block text-sm text-[var(--text-primary)]">Accent color</label>
                  <input className="input" value={branding.accent_color} onChange={(event) => setBranding({ ...branding, accent_color: event.target.value })} />
                </div>
              </div>
            </div>
            <div className="mt-5 flex justify-end">
              <button type="submit" className="btn-primary" disabled={saving === "branding"}>
                {saving === "branding" ? "Saving..." : "Save brand"}
              </button>
            </div>
          </form>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-[24px] border border-[var(--border-subtle)] bg-[rgba(255,255,255,0.92)] px-5 py-5">
            <p className="admin-eyebrow">API</p>
            <h2 className="mt-2 text-[1.45rem] font-medium tracking-[-0.04em] text-[var(--text-primary)]">Provider keys</h2>
            <form onSubmit={handleApiKey} className="mt-5 grid gap-4">
              <div className="grid gap-4 md:grid-cols-2">
                <select className="input" value={apiKeyForm.provider} onChange={(event) => setApiKeyForm({ ...apiKeyForm, provider: event.target.value })}>
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="openrouter">OpenRouter</option>
                  <option value="livekit">LiveKit</option>
                </select>
                <input className="input" placeholder="Label" value={apiKeyForm.label} onChange={(event) => setApiKeyForm({ ...apiKeyForm, label: event.target.value })} />
              </div>
              <input className="input" placeholder="Product override workspace id (optional)" value={apiKeyForm.workspace_id} onChange={(event) => setApiKeyForm({ ...apiKeyForm, workspace_id: event.target.value })} />
              <input className="input" placeholder="Secret key" value={apiKeyForm.api_key} onChange={(event) => setApiKeyForm({ ...apiKeyForm, api_key: event.target.value })} />
              <div className="flex justify-end">
                <button type="submit" className="btn-primary" disabled={saving === "api"}>
                  {saving === "api" ? "Saving..." : "Save key"}
                </button>
              </div>
            </form>
            <div className="mt-5 space-y-3">
              {apiKeys.map((key) => (
                <div key={key.id} className="rounded-[18px] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-[var(--text-secondary)]">
                  <p className="text-[var(--text-primary)]">{key.provider} · {key.label}</p>
                  <p className="mt-1">{key.masked_key}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-[24px] border border-[var(--border-subtle)] bg-[rgba(255,255,255,0.92)] px-5 py-5">
              <p className="admin-eyebrow">Billing</p>
              <h2 className="mt-2 text-[1.45rem] font-medium tracking-[-0.04em] text-[var(--text-primary)]">Plan snapshot</h2>
              {billing ? (
                <div className="mt-5 space-y-3 text-sm text-[var(--text-secondary)]">
                  <p><span className="text-[var(--text-primary)]">Plan:</span> {billing.plan}</p>
                  <p><span className="text-[var(--text-primary)]">Status:</span> {billing.status}</p>
                  <p><span className="text-[var(--text-primary)]">Billing email:</span> {billing.billing_email || "Not set"}</p>
                  <p><span className="text-[var(--text-primary)]">Seats:</span> {billing.seats}</p>
                </div>
              ) : (
                <p className="mt-4 text-sm text-[var(--text-secondary)]">Billing is not configured for this environment.</p>
              )}
            </div>

            <div className="rounded-[24px] border border-[var(--border-subtle)] bg-[rgba(255,255,255,0.92)] px-5 py-5">
              <p className="admin-eyebrow">Danger zone</p>
              <h2 className="mt-2 text-[1.45rem] font-medium tracking-[-0.04em] text-[var(--text-primary)]">Destructive actions</h2>
              <p className="mt-4 text-sm leading-7 text-[var(--text-secondary)]">
                Account deletion is intentionally not exposed in this POC. Remove products individually from the backend only after exporting any session data you want to keep.
              </p>
            </div>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
