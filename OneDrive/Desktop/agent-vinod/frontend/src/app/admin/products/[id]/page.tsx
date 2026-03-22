"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { AdminShell } from "@/components/admin-shell";
import { adminApi } from "@/lib/api";
import type {
  AdminProduct,
  Citation,
  KnowledgeSource,
  ProductConfig,
  ProductSessionSettings,
  ProductShareSettings,
} from "@/types/api";

type ProductTab = "overview" | "knowledge" | "agent" | "sessions" | "share";
type AddSourceMode = "help_doc_url" | "video" | "file" | "custom_entry" | null;
type SessionListItem = {
  id: string;
  buyer_name?: string | null;
  product_name?: string | null;
  mode?: string;
  lead_intent_score?: number;
  recording_available?: boolean;
  started_at?: string | null;
  ended_at?: string | null;
};
type TestAgentResponse = {
  decision: string;
  response_text: string;
  citations: Citation[];
};

const TABS: { key: ProductTab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "knowledge", label: "Knowledge" },
  { key: "agent", label: "Agent" },
  { key: "sessions", label: "Sessions" },
  { key: "share", label: "Share" },
];

const SOURCE_FILTERS = [
  { key: "all", label: "All" },
  { key: "help_doc_url", label: "Web pages" },
  { key: "video", label: "Video" },
  { key: "file", label: "File" },
  { key: "custom_entry", label: "Manual" },
] as const;

function parseList(source: string | null | undefined): string[] {
  if (!source) return [];
  try {
    const value = JSON.parse(source);
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
  } catch {
    return [];
  }
}

function stringifyList(value: string[]) {
  return JSON.stringify(value.filter((item) => item.trim().length > 0));
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

function productState(product: AdminProduct) {
  if (product.is_active) return "Live";
  if (product.knowledge_count > 0) return "Ready";
  if (product.product_url) return "Configuring";
  return "Draft";
}

function toneValue(value: number) {
  return Math.max(1, Math.min(5, Math.round(value / 25) + 1));
}

function toneSliderValue(value: number) {
  return (toneValue(value) - 1) * 25;
}

export default function AdminProductDetailPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const productId = params?.id ?? "";
  const requestedTab = searchParams?.get("tab");
  const requestedSession = searchParams?.get("session");

  const [product, setProduct] = useState<AdminProduct | null>(null);
  const [knowledge, setKnowledge] = useState<KnowledgeSource[]>([]);
  const [config, setConfig] = useState<ProductConfig | null>(null);
  const [sessionSettings, setSessionSettings] = useState<ProductSessionSettings | null>(null);
  const [share, setShare] = useState<ProductShareSettings | null>(null);
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [sessionDetail, setSessionDetail] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<ProductTab>("overview");
  const [selectedKnowledgeId, setSelectedKnowledgeId] = useState<string | null>(null);
  const [knowledgeFilter, setKnowledgeFilter] = useState<(typeof SOURCE_FILTERS)[number]["key"]>("all");
  const [knowledgeSearch, setKnowledgeSearch] = useState("");
  const [addSourceMode, setAddSourceMode] = useState<AddSourceMode>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [testMessage, setTestMessage] = useState("How do I show reporting to a buyer?");
  const [testResult, setTestResult] = useState<TestAgentResponse | null>(null);
  const [helpDocForm, setHelpDocForm] = useState({ title: "", source_url: "", content_text: "" });
  const [customEntryForm, setCustomEntryForm] = useState({ title: "", question: "", answer: "" });
  const [newQuestion, setNewQuestion] = useState("");

  useEffect(() => {
    if (requestedTab && TABS.some((tab) => tab.key === requestedTab)) {
      setActiveTab(requestedTab as ProductTab);
    }
  }, [requestedTab]);

  useEffect(() => {
    if (requestedSession) {
      setSelectedSessionId(requestedSession);
      setActiveTab("sessions");
    }
  }, [requestedSession]);

  useEffect(() => {
    async function loadAll() {
      try {
        const [productData, knowledgeData, configData, sessionData, shareData, sessionsData] = await Promise.all([
          adminApi.getProduct(productId),
          adminApi.listKnowledgeSources(productId),
          adminApi.getProductConfig(productId),
          adminApi.getProductSessionSettings(productId),
          adminApi.getProductShare(productId),
          adminApi.listSessions(productId),
        ]);
        setProduct(productData);
        setKnowledge(knowledgeData);
        setConfig(configData);
        setSessionSettings(sessionData);
        setShare(shareData);
        setSessions(sessionsData);
        setSelectedKnowledgeId((current) => current ?? knowledgeData[0]?.id ?? null);
        setSelectedSessionId((current) => current ?? requestedSession ?? sessionsData[0]?.id ?? null);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load product");
      }
    }

    void loadAll();
  }, [productId, requestedSession]);

  useEffect(() => {
    if (!selectedSessionId) return;
    void adminApi.getSessionDetail(selectedSessionId).then(setSessionDetail).catch(() => setSessionDetail(null));
  }, [selectedSessionId]);

  const filteredKnowledge = useMemo(() => {
    return knowledge.filter((item) => {
      const matchesType = knowledgeFilter === "all" || item.source_type === knowledgeFilter;
      const haystack = `${item.title} ${item.source_url || ""} ${item.file_name || ""}`.toLowerCase();
      const matchesSearch = !knowledgeSearch.trim() || haystack.includes(knowledgeSearch.trim().toLowerCase());
      return matchesType && matchesSearch;
    });
  }, [knowledge, knowledgeFilter, knowledgeSearch]);

  const selectedKnowledge = useMemo(
    () => filteredKnowledge.find((item) => item.id === selectedKnowledgeId) ?? filteredKnowledge[0] ?? null,
    [filteredKnowledge, selectedKnowledgeId],
  );

  const starterQuestions = useMemo(
    () => parseList(sessionSettings?.suggested_questions_json),
    [sessionSettings?.suggested_questions_json],
  );

  async function refreshProductSurface() {
    const [knowledgeData, sessionsData, shareData, sessionData] = await Promise.all([
      adminApi.listKnowledgeSources(productId),
      adminApi.listSessions(productId),
      adminApi.getProductShare(productId),
      adminApi.getProductSessionSettings(productId),
    ]);
    setKnowledge(knowledgeData);
    setSessions(sessionsData);
    setShare(shareData);
    setSessionSettings(sessionData);
    setSelectedKnowledgeId((current) => current ?? knowledgeData[0]?.id ?? null);
    setSelectedSessionId((current) => current ?? sessionsData[0]?.id ?? null);
  }

  async function saveOverview(event: React.FormEvent) {
    event.preventDefault();
    if (!product) return;
    setSaving("overview");
    try {
      const updated = await adminApi.updateProduct(productId, {
        name: product.name,
        description: product.description,
        product_url: product.product_url,
        allowed_domains: product.allowed_domains,
        browser_auth_mode: product.browser_auth_mode,
        is_active: product.is_active,
      });
      setProduct(updated);
    } finally {
      setSaving(null);
    }
  }

  async function saveAgent(event: React.FormEvent) {
    event.preventDefault();
    if (!config) return;
    setSaving("agent");
    try {
      const updated = await adminApi.updateProductConfig(productId, config);
      setConfig(updated);
    } finally {
      setSaving(null);
    }
  }

  async function saveShare(event: React.FormEvent) {
    event.preventDefault();
    if (!share || !sessionSettings) return;
    setSaving("share");
    try {
      const [updatedShare, updatedSessionSettings] = await Promise.all([
        adminApi.updateProductShare(productId, share),
        adminApi.updateProductSessionSettings(productId, sessionSettings),
      ]);
      setShare(updatedShare);
      setSessionSettings(updatedSessionSettings);
    } finally {
      setSaving(null);
    }
  }

  async function addHelpDoc(event: React.FormEvent) {
    event.preventDefault();
    await adminApi.addHelpDoc(productId, helpDocForm);
    setHelpDocForm({ title: "", source_url: "", content_text: "" });
    setAddSourceMode(null);
    await refreshProductSurface();
  }

  async function addCustomEntry(event: React.FormEvent) {
    event.preventDefault();
    await adminApi.addCustomEntry(productId, {
      title: customEntryForm.title,
      metadata_json: JSON.stringify({
        question: customEntryForm.question,
        answer: customEntryForm.answer,
      }),
      content_text: customEntryForm.answer,
    });
    setCustomEntryForm({ title: "", question: "", answer: "" });
    setAddSourceMode(null);
    await refreshProductSurface();
  }

  async function uploadFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("title", file.name);
    formData.append("file_type", file.name.endsWith(".pdf") ? "pdf" : "txt");
    formData.append("content_text", "");
    formData.append("file", file);
    await adminApi.addFileSource(productId, formData);
    event.target.value = "";
    setAddSourceMode(null);
    await refreshProductSurface();
  }

  async function uploadVideo(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("title", file.name);
    formData.append("transcript_text", "");
    formData.append("file", file);
    await adminApi.addVideoSource(productId, formData);
    event.target.value = "";
    setAddSourceMode(null);
    await refreshProductSurface();
  }

  async function runTestAgent(event: React.FormEvent) {
    event.preventDefault();
    setTestResult(await adminApi.testAgent(productId, testMessage));
  }

  function setQuestions(nextQuestions: string[]) {
    if (!sessionSettings) return;
    setSessionSettings({
      ...sessionSettings,
      suggested_questions_json: stringifyList(nextQuestions),
    });
  }

  function addStarterQuestion() {
    if (!newQuestion.trim()) return;
    setQuestions([...starterQuestions, newQuestion.trim()]);
    setNewQuestion("");
  }

  const setupItems = useMemo(() => {
    if (!product) return [];
    return [
      { label: "Product details added", done: Boolean(product.name && product.product_url), tab: "overview" as ProductTab },
      { label: "Demo connection configured", done: Boolean(product.product_url), tab: "overview" as ProductTab },
      { label: `Knowledge base has ${knowledge.length} entries`, done: knowledge.length > 0, tab: "knowledge" as ProductTab },
      { label: "Test your agent", done: Boolean(testResult), tab: "knowledge" as ProductTab },
    ];
  }, [knowledge.length, product, testResult]);

  if (!product || !config || !sessionSettings || !share) {
    return (
      <AdminShell
        title="Product"
        description="Loading product configuration..."
        actions={<Link href="/admin/products" className="btn-secondary">Back to products</Link>}
      >
        {error ? <p className="text-sm text-[var(--error)]">{error}</p> : <p className="text-sm text-[var(--text-secondary)]">Loading product workspace...</p>}
      </AdminShell>
    );
  }

  return (
    <AdminShell
      title={product.name}
        description="Configure the product, ground the agent in knowledge, and shape the prospect experience from one place."
        actions={(
          <>
          <a href={product.live_link} target="_blank" rel="noreferrer" className="btn-secondary">
            Open meeting
          </a>
          <Link href="/admin/products" className="btn-secondary">
            Back to products
          </Link>
        </>
      )}
    >
      {error ? <p className="text-sm text-[var(--error)]">{error}</p> : null}
      <div className="rounded-[22px] border border-[var(--border-subtle)] bg-[rgba(255,255,255,0.82)] px-2 py-2">
        <div className="flex flex-wrap gap-1.5">
          {TABS.map((tab) => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} className="admin-segment" data-active={activeTab === tab.key ? "true" : "false"}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      {activeTab === "overview" ? (
        <div className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_360px]">
            <form onSubmit={saveOverview} className="rounded-[24px] border border-[var(--border-subtle)] bg-[rgba(255,255,255,0.92)] px-5 py-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="admin-eyebrow">Product identity</p>
                  <h2 className="mt-2 text-[1.8rem] font-medium tracking-[-0.04em] text-[var(--text-primary)]">Overview</h2>
                </div>
                <span className="badge">{productState(product)}</span>
              </div>
              <div className="mt-5 grid gap-4">
                <div>
                  <label className="mb-2 block text-sm text-[var(--text-primary)]">Product name</label>
                  <input aria-label="Product Name" className="input" value={product.name} onChange={(event) => setProduct({ ...product, name: event.target.value })} />
                </div>
                <div>
                  <label className="mb-2 block text-sm text-[var(--text-primary)]">Website URL</label>
                  <input aria-label="Product URL" className="input" value={product.product_url || ""} onChange={(event) => setProduct({ ...product, product_url: event.target.value })} />
                </div>
                <div>
                  <label className="mb-2 block text-sm text-[var(--text-primary)]">One-line description</label>
                  <textarea aria-label="Description" className="textarea" rows={3} value={product.description || ""} onChange={(event) => setProduct({ ...product, description: event.target.value })} />
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm text-[var(--text-primary)]">Allowed domains</label>
                    <input aria-label="Allowed Domains" className="input" value={product.allowed_domains} onChange={(event) => setProduct({ ...product, allowed_domains: event.target.value })} />
                  </div>
                  <label className="admin-radio flex items-center gap-3" data-active={product.is_active ? "true" : "false"}>
                    <input type="checkbox" checked={product.is_active} onChange={(event) => setProduct({ ...product, is_active: event.target.checked })} />
                    <span className="text-sm text-[var(--text-primary)]">Product is live and shareable</span>
                  </label>
                </div>
              </div>
              <div className="mt-5 flex justify-end">
                <button type="submit" className="btn-primary" disabled={saving === "overview"}>
                  {saving === "overview" ? "Saving..." : "Save changes"}
                </button>
              </div>
            </form>

            <div className="space-y-4">
              <div className="rounded-[24px] border border-[var(--border-subtle)] bg-[rgba(255,255,255,0.92)] px-5 py-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="admin-eyebrow">Setup</p>
                    <h2 className="mt-2 text-[1.45rem] font-medium tracking-[-0.04em] text-[var(--text-primary)]">Readiness</h2>
                  </div>
                  <span className="badge">{productState(product)}</span>
                </div>
                <div className="mt-4 space-y-3">
                  {setupItems.map((item) => (
                    <button key={item.label} type="button" onClick={() => setActiveTab(item.tab)} className="flex w-full items-center justify-between rounded-[18px] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-4 py-3 text-left">
                      <span className="text-sm text-[var(--text-primary)]">{item.done ? "✓" : "○"} {item.label}</span>
                      <span className="text-xs uppercase tracking-[0.14em] text-[var(--text-tertiary)]">{item.tab}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-[24px] border border-[var(--border-subtle)] bg-[rgba(255,255,255,0.92)] px-5 py-5">
                <p className="admin-eyebrow">Quick stats</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div>
                    <p className="text-[1.6rem] font-medium tracking-[-0.04em] text-[var(--text-primary)]">{product.session_count || 0}</p>
                    <p className="mt-1 text-sm text-[var(--text-secondary)]">Sessions</p>
                  </div>
                  <div>
                    <p className="text-[1.6rem] font-medium tracking-[-0.04em] text-[var(--text-primary)]">{knowledge.length}</p>
                    <p className="mt-1 text-sm text-[var(--text-secondary)]">Knowledge entries</p>
                  </div>
                  <div>
                    <p className="text-[1.6rem] font-medium tracking-[-0.04em] text-[var(--text-primary)]">{config.navigation_style === "show_while_telling" ? "Auto" : "Explain first"}</p>
                    <p className="mt-1 text-sm text-[var(--text-secondary)]">Navigation mode</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[24px] border border-[var(--border-subtle)] bg-[rgba(255,255,255,0.92)] px-5 py-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="admin-eyebrow">Meeting connection</p>
                <h2 className="mt-2 text-[1.45rem] font-medium tracking-[-0.04em] text-[var(--text-primary)]">How the agent enters the product</h2>
              </div>
              <a href={product.live_link} target="_blank" rel="noreferrer" className="btn-secondary">
                Test meeting
              </a>
            </div>
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <button type="button" className="admin-radio text-left" data-active={product.browser_auth_mode === "credentials" ? "true" : "false"} onClick={() => setProduct({ ...product, browser_auth_mode: "credentials" })}>
                <p className="text-sm text-[var(--text-primary)]">Login with credentials</p>
                <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">Use the demo environment managed by the backend for authenticated walkthroughs.</p>
              </button>
              <button type="button" className="admin-radio text-left" data-active={product.browser_auth_mode === "none" ? "true" : "false"} onClick={() => setProduct({ ...product, browser_auth_mode: "none" })}>
                <p className="text-sm text-[var(--text-primary)]">Public URL</p>
                <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">Use the public website flow when no login is needed.</p>
              </button>
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div>
                <label className="mb-2 block text-sm text-[var(--text-primary)]">Start URL</label>
                <input className="input" value={product.product_url || ""} onChange={(event) => setProduct({ ...product, product_url: event.target.value })} />
              </div>
              <div>
                <label className="mb-2 block text-sm text-[var(--text-primary)]">Restricted areas</label>
                <input className="input" value={product.allowed_domains} onChange={(event) => setProduct({ ...product, allowed_domains: event.target.value })} placeholder="/admin, /settings/billing" />
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-[var(--text-secondary)]">Credential storage and verification are handled on the backend in this build. The UI here controls the navigation mode, allowed destinations, and live availability.</p>
          </div>
        </div>
      ) : null}

      {activeTab === "knowledge" ? (
        <div className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
            <div className="rounded-[24px] border border-[var(--border-subtle)] bg-[rgba(255,255,255,0.92)] px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="admin-eyebrow">Knowledge</p>
                  <h2 className="mt-2 text-[1.35rem] font-medium tracking-[-0.04em] text-[var(--text-primary)]">Sources</h2>
                </div>
                <span className="badge">{filteredKnowledge.length}</span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {SOURCE_FILTERS.map((filter) => (
                  <button key={filter.key} onClick={() => setKnowledgeFilter(filter.key)} className="admin-segment" data-active={knowledgeFilter === filter.key ? "true" : "false"}>
                    {filter.label}
                  </button>
                ))}
              </div>
              <input className="input mt-4" placeholder="Search knowledge" value={knowledgeSearch} onChange={(event) => setKnowledgeSearch(event.target.value)} />
              <div className="mt-4 space-y-2">
                {filteredKnowledge.length ? filteredKnowledge.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setSelectedKnowledgeId(item.id)}
                    className="w-full rounded-[18px] border px-3 py-3 text-left"
                    style={{ borderColor: selectedKnowledge?.id === item.id ? "var(--border-active)" : "var(--border-subtle)", background: selectedKnowledge?.id === item.id ? "rgba(252,248,239,0.98)" : "var(--surface-muted)" }}
                  >
                    <p className="text-sm text-[var(--text-primary)]">{item.title}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.14em] text-[var(--text-tertiary)]">{item.source_type} · {item.sync_status}</p>
                  </button>
                )) : (
                  <div className="admin-empty px-4 py-8 text-center text-sm text-[var(--text-secondary)]">No knowledge sources match this filter.</div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-[24px] border border-[var(--border-subtle)] bg-[rgba(255,255,255,0.92)] px-5 py-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="admin-eyebrow">Content</p>
                    <h2
                      className="admin-wrap mt-2 text-[1.45rem] font-medium tracking-[-0.04em] text-[var(--text-primary)]"
                      title={selectedKnowledge?.title || "Knowledge detail"}
                    >
                      {selectedKnowledge?.title || "Knowledge detail"}
                    </h2>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {([
                      ["help_doc_url", "Web pages"],
                      ["video", "Video"],
                      ["file", "File"],
                      ["custom_entry", "Write manually"],
                    ] as const).map(([mode, label]) => (
                      <button key={mode} type="button" onClick={() => setAddSourceMode((current) => current === mode ? null : mode)} className="btn-secondary">
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {addSourceMode ? (
                  <div className="mt-5 rounded-[20px] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-4 py-4">
                    {addSourceMode === "help_doc_url" ? (
                      <form onSubmit={addHelpDoc} className="space-y-4">
                        <input aria-label="Help Doc Title" className="input" placeholder="Source title" value={helpDocForm.title} onChange={(event) => setHelpDocForm({ ...helpDocForm, title: event.target.value })} />
                        <input aria-label="Help Doc URL" className="input" placeholder="https://help.example.com/article" value={helpDocForm.source_url} onChange={(event) => setHelpDocForm({ ...helpDocForm, source_url: event.target.value })} />
                        <textarea aria-label="Help Doc Content" className="textarea" rows={4} placeholder="Optional pasted content" value={helpDocForm.content_text} onChange={(event) => setHelpDocForm({ ...helpDocForm, content_text: event.target.value })} />
                        <div className="flex gap-3">
                          <button type="submit" className="btn-primary">Import</button>
                          <button type="button" className="btn-secondary" onClick={() => setAddSourceMode(null)}>Cancel</button>
                        </div>
                      </form>
                    ) : null}

                    {addSourceMode === "custom_entry" ? (
                      <form onSubmit={addCustomEntry} className="space-y-4">
                        <input aria-label="Entry Title" className="input" placeholder="Entry title" value={customEntryForm.title} onChange={(event) => setCustomEntryForm({ ...customEntryForm, title: event.target.value })} />
                        <textarea aria-label="Custom Question" className="textarea" rows={3} placeholder="Question" value={customEntryForm.question} onChange={(event) => setCustomEntryForm({ ...customEntryForm, question: event.target.value })} />
                        <textarea aria-label="Custom Answer" className="textarea" rows={5} placeholder="Answer" value={customEntryForm.answer} onChange={(event) => setCustomEntryForm({ ...customEntryForm, answer: event.target.value })} />
                        <div className="flex gap-3">
                          <button type="submit" className="btn-primary">Save entry</button>
                          <button type="button" className="btn-secondary" onClick={() => setAddSourceMode(null)}>Cancel</button>
                        </div>
                      </form>
                    ) : null}

                    {addSourceMode === "file" ? (
                      <label className="block cursor-pointer">
                        <span className="text-sm text-[var(--text-primary)]">Upload a PDF or text file</span>
                        <input className="mt-4 block text-sm text-[var(--text-secondary)]" type="file" onChange={uploadFile} />
                      </label>
                    ) : null}

                    {addSourceMode === "video" ? (
                      <label className="block cursor-pointer">
                        <span className="text-sm text-[var(--text-primary)]">Upload a product video to transcribe</span>
                        <input className="mt-4 block text-sm text-[var(--text-secondary)]" type="file" accept="video/*" onChange={uploadVideo} />
                      </label>
                    ) : null}
                  </div>
                ) : null}

                {selectedKnowledge ? (
                  <div className="mt-5 space-y-4">
                    <div className="grid gap-4 lg:grid-cols-2">
                      <div>
                        <p className="admin-eyebrow">Source</p>
                        <p className="mt-2 text-sm text-[var(--text-primary)]">{selectedKnowledge.source_type}</p>
                      </div>
                      <div>
                        <p className="admin-eyebrow">Status</p>
                        <p className="mt-2 text-sm text-[var(--text-primary)]">{selectedKnowledge.status}</p>
                      </div>
                    </div>
                    {selectedKnowledge.source_url ? <div><p className="admin-eyebrow">URL</p><p className="admin-wrap mt-2 text-sm text-[var(--text-secondary)]">{selectedKnowledge.source_url}</p></div> : null}
                    {selectedKnowledge.file_name ? <div><p className="admin-eyebrow">File</p><p className="admin-wrap mt-2 text-sm text-[var(--text-secondary)]">{selectedKnowledge.file_name}</p></div> : null}
                    <div>
                      <p className="admin-eyebrow">Jobs</p>
                      <div className="mt-3 space-y-2">
                        {selectedKnowledge.jobs.length ? selectedKnowledge.jobs.map((job) => (
                          <div key={job.id} className="rounded-[16px] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-[var(--text-secondary)]">
                            {job.job_type} · {job.status}{job.error_message ? ` · ${job.error_message}` : ""}
                          </div>
                        )) : <div className="rounded-[16px] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-[var(--text-secondary)]">No background jobs recorded for this source.</div>}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="admin-empty mt-5 px-4 py-10 text-center text-sm text-[var(--text-secondary)]">Select a source to inspect its metadata and processing status.</div>
                )}
              </div>

              <div className="rounded-[24px] border border-[var(--border-subtle)] bg-[rgba(255,255,255,0.92)] px-5 py-5">
                <p className="admin-eyebrow">Test Agent</p>
                <h2 className="mt-2 text-[1.35rem] font-medium tracking-[-0.04em] text-[var(--text-primary)]">Dry-run a buyer question</h2>
                <form onSubmit={runTestAgent} className="mt-4 space-y-4">
                  <textarea aria-label="Test Agent Message" className="textarea" rows={4} value={testMessage} onChange={(event) => setTestMessage(event.target.value)} />
                  <button type="submit" className="btn-primary">Run test</button>
                </form>
                {testResult ? (
                  <div className="mt-5 space-y-3">
                    <div className="rounded-[18px] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-4 py-3">
                      <p className="admin-eyebrow">Decision</p>
                      <p className="admin-wrap mt-2 text-sm text-[var(--text-primary)]">{testResult.decision}</p>
                    </div>
                    <div className="rounded-[18px] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-4 py-3">
                      <p className="admin-eyebrow">Response</p>
                      <p className="admin-wrap mt-2 text-sm leading-6 text-[var(--text-primary)]">{testResult.response_text}</p>
                    </div>
                    <div className="rounded-[18px] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-4 py-3">
                      <p className="admin-eyebrow">Citations</p>
                      <div className="mt-3 space-y-2">
                        {testResult.citations.length ? testResult.citations.map((citation) => (
                          <div key={citation.document_id} className="rounded-[16px] bg-[rgba(255,255,255,0.88)] px-4 py-3">
                            <p className="text-sm text-[var(--text-primary)]">{citation.title}</p>
                            <p className="mt-1 text-xs uppercase tracking-[0.14em] text-[var(--text-tertiary)]">{citation.source_type}</p>
                            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{citation.excerpt}</p>
                          </div>
                        )) : <p className="text-sm text-[var(--text-secondary)]">No citations returned.</p>}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {activeTab === "agent" ? (
        <form onSubmit={saveAgent} className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="rounded-[24px] border border-[var(--border-subtle)] bg-[rgba(255,255,255,0.92)] px-5 py-5">
              <p className="admin-eyebrow">Persona</p>
              <h2 className="mt-2 text-[1.45rem] font-medium tracking-[-0.04em] text-[var(--text-primary)]">How the agent presents itself</h2>
              <div className="mt-5 space-y-4">
                <div>
                  <label className="mb-2 block text-sm text-[var(--text-primary)]">Agent name</label>
                  <input aria-label="Agent Name" className="input" value={config.agent_name} onChange={(event) => setConfig({ ...config, agent_name: event.target.value })} />
                </div>
                <div>
                  <label className="mb-2 block text-sm text-[var(--text-primary)]">Greeting message</label>
                  <textarea aria-label="Greeting" className="textarea" rows={4} value={config.greeting_template} onChange={(event) => setConfig({ ...config, greeting_template: event.target.value })} />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-[18px] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <label className="text-sm text-[var(--text-primary)]">Warmth</label>
                      <span className="badge">{toneValue(config.warmth)}/5</span>
                    </div>
                    <input className="admin-slider mt-4" type="range" min={0} max={100} step={25} value={toneSliderValue(config.warmth)} onChange={(event) => setConfig({ ...config, warmth: Number(event.target.value) })} />
                  </div>
                  <div className="rounded-[18px] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <label className="text-sm text-[var(--text-primary)]">Formality</label>
                      <span className="badge">{toneValue(config.formality)}/5</span>
                    </div>
                    <input className="admin-slider mt-4" type="range" min={0} max={100} step={25} value={toneSliderValue(config.formality)} onChange={(event) => setConfig({ ...config, formality: Number(event.target.value) })} />
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[24px] border border-[var(--border-subtle)] bg-[rgba(255,255,255,0.92)] px-5 py-5">
              <p className="admin-eyebrow">Response behavior</p>
              <h2 className="mt-2 text-[1.45rem] font-medium tracking-[-0.04em] text-[var(--text-primary)]">How the agent answers</h2>
              <div className="mt-5 space-y-4">
                <div>
                  <label className="mb-3 block text-sm text-[var(--text-primary)]">Answer length</label>
                  <div className="grid gap-3">
                    {([
                      ["short", "Concise"],
                      ["balanced", "Balanced"],
                      ["detailed", "Detailed"],
                    ] as const).map(([value, label]) => (
                      <button key={value} type="button" className="admin-radio text-left" data-active={config.response_length === value ? "true" : "false"} onClick={() => setConfig({ ...config, response_length: value })}>
                        <p className="text-sm text-[var(--text-primary)]">{label}</p>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="mb-3 block text-sm text-[var(--text-primary)]">Show navigation in product</label>
                  <div className="grid gap-3">
                    {([
                      ["show_while_telling", "Automatically"],
                      ["explain_then_show", "Only after explanation"],
                    ] as const).map(([value, label]) => (
                      <button key={value} type="button" className="admin-radio text-left" data-active={config.navigation_style === value ? "true" : "false"} onClick={() => setConfig({ ...config, navigation_style: value })}>
                        <p className="text-sm text-[var(--text-primary)]">{label}</p>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="mb-3 block text-sm text-[var(--text-primary)]">Citations</label>
                  <div className="grid gap-3">
                    {([
                      ["admin_only", "Admin and test only"],
                      ["buyers", "Show to buyers"],
                      ["disabled", "Disable"],
                    ] as const).map(([value, label]) => (
                      <button key={value} type="button" className="admin-radio text-left" data-active={config.citation_mode === value ? "true" : "false"} onClick={() => setConfig({ ...config, citation_mode: value })}>
                        <p className="text-sm text-[var(--text-primary)]">{label}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[24px] border border-[var(--border-subtle)] bg-[rgba(255,255,255,0.92)] px-5 py-5">
            <p className="admin-eyebrow">Guardrails</p>
            <h2 className="mt-2 text-[1.45rem] font-medium tracking-[-0.04em] text-[var(--text-primary)]">Deflection and escalation</h2>
            <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div>
                <label className="mb-2 block text-sm text-[var(--text-primary)]">Topics to deflect</label>
                <textarea aria-label="Avoid Topics JSON" className="textarea font-mono text-sm" rows={5} value={config.avoid_topics_json} onChange={(event) => setConfig({ ...config, avoid_topics_json: event.target.value })} />
              </div>
              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm text-[var(--text-primary)]">Escalation destination</label>
                  <input aria-label="Escalation Destination" className="input" value={config.escalation_destination} onChange={(event) => setConfig({ ...config, escalation_destination: event.target.value })} />
                </div>
                <div>
                  <label className="mb-2 block text-sm text-[var(--text-primary)]">Escalation message</label>
                  <textarea aria-label="Escalation Message" className="textarea" rows={4} value={config.escalation_message} onChange={(event) => setConfig({ ...config, escalation_message: event.target.value })} />
                </div>
              </div>
            </div>
            <div className="mt-5 flex justify-end">
              <button type="submit" className="btn-primary" disabled={saving === "agent"}>
                {saving === "agent" ? "Saving..." : "Save agent settings"}
              </button>
            </div>
          </div>
        </form>
      ) : null}

      {activeTab === "sessions" ? (
        <div className="grid gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
          <div className="rounded-[24px] border border-[var(--border-subtle)] bg-[rgba(255,255,255,0.92)] px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="admin-eyebrow">Sessions</p>
                <h2 className="mt-2 text-[1.35rem] font-medium tracking-[-0.04em] text-[var(--text-primary)]">This product</h2>
              </div>
              <span className="badge">{sessions.length}</span>
            </div>
            <div className="mt-4 space-y-2">
              {sessions.length ? sessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => setSelectedSessionId(session.id)}
                  className="w-full rounded-[18px] border px-4 py-3 text-left"
                  style={{ borderColor: selectedSessionId === session.id ? "var(--border-active)" : "var(--border-subtle)", background: selectedSessionId === session.id ? "rgba(252,248,239,0.98)" : "var(--surface-muted)" }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm text-[var(--text-primary)]">{session.buyer_name || "Anonymous prospect"}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.14em] text-[var(--text-tertiary)]">{session.mode || "session"} · {formatDate(session.started_at)}</p>
                    </div>
                    <span className="badge">intent {session.lead_intent_score ?? 0}</span>
                  </div>
                </button>
              )) : <div className="admin-empty px-4 py-8 text-center text-sm text-[var(--text-secondary)]">No sessions captured for this product yet.</div>}
            </div>
          </div>

          <div className="space-y-4">
            {!sessionDetail ? (
              <div className="admin-empty px-6 py-14 text-center text-sm text-[var(--text-secondary)]">Select a session to inspect the transcript and insights.</div>
            ) : (
              <>
                <div className="rounded-[24px] border border-[var(--border-subtle)] bg-[rgba(255,255,255,0.92)] px-5 py-5">
                  <div className="grid gap-4 md:grid-cols-4">
                    <div><p className="admin-eyebrow">Intent</p><p className="mt-3 text-[1.8rem] font-medium tracking-[-0.04em] text-[var(--text-primary)]">{sessionDetail.summary?.lead_intent_score ?? 0}</p></div>
                    <div><p className="admin-eyebrow">Messages</p><p className="mt-3 text-[1.8rem] font-medium tracking-[-0.04em] text-[var(--text-primary)]">{sessionDetail.summary?.total_messages ?? sessionDetail.messages?.length ?? 0}</p></div>
                    <div><p className="admin-eyebrow">Actions</p><p className="mt-3 text-[1.8rem] font-medium tracking-[-0.04em] text-[var(--text-primary)]">{sessionDetail.summary?.total_actions ?? sessionDetail.actions?.length ?? 0}</p></div>
                    <div><p className="admin-eyebrow">Replay</p><p className="mt-3 text-sm text-[var(--text-primary)]">{sessionDetail.recording?.video_path ? "Recorded" : "Not recorded"}</p></div>
                  </div>
                </div>

                <div className="rounded-[24px] border border-[var(--border-subtle)] bg-[rgba(255,255,255,0.92)] px-5 py-5">
                  <p className="admin-eyebrow">Transcript</p>
                  <h2 className="mt-2 text-[1.45rem] font-medium tracking-[-0.04em] text-[var(--text-primary)]">Conversation</h2>
                  <div className="mt-5 space-y-3">
                    {sessionDetail.messages?.map((message: any) => (
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
                    <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">{sessionDetail.summary?.summary_text || "No summary captured for this session."}</p>
                    <div className="mt-4 grid gap-4 md:grid-cols-3">
                      <div><p className="admin-eyebrow">Top questions</p><div className="mt-2 flex flex-wrap gap-2">{parseList(sessionDetail.summary?.top_questions).map((item) => <span key={item} className="badge">{item}</span>)}</div></div>
                      <div><p className="admin-eyebrow">Features interest</p><div className="mt-2 flex flex-wrap gap-2">{parseList(sessionDetail.summary?.features_interest).map((item) => <span key={item} className="badge">{item}</span>)}</div></div>
                      <div><p className="admin-eyebrow">Objections</p><div className="mt-2 flex flex-wrap gap-2">{parseList(sessionDetail.summary?.objections).map((item) => <span key={item} className="badge">{item}</span>)}</div></div>
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-[var(--border-subtle)] bg-[rgba(255,255,255,0.92)] px-5 py-5">
                    <p className="admin-eyebrow">Sources used</p>
                    <h2 className="mt-2 text-[1.35rem] font-medium tracking-[-0.04em] text-[var(--text-primary)]">Citations</h2>
                    <div className="mt-4 space-y-3">
                      {sessionDetail.citations_used?.length ? sessionDetail.citations_used.map((citation: any) => (
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
          </div>
        </div>
      ) : null}

      {activeTab === "share" ? (
        <form onSubmit={saveShare} className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="rounded-[24px] border border-[var(--border-subtle)] bg-[rgba(255,255,255,0.92)] px-5 py-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="admin-eyebrow">Share</p>
                  <h2 className="mt-2 text-[1.45rem] font-medium tracking-[-0.04em] text-[var(--text-primary)]">Launch surface</h2>
                </div>
                <span className="badge">{product.is_active ? "Live" : "Paused"}</span>
              </div>
              <div className="mt-5 space-y-4">
                <div><label className="mb-2 block text-sm text-[var(--text-primary)]">Meeting link</label><code className="admin-code">{share.live_link}</code></div>
                <div><label className="mb-2 block text-sm text-[var(--text-primary)]">Embed code</label><textarea className="textarea font-mono text-sm" rows={4} value={share.embed_code} readOnly /></div>
              </div>
            </div>

            <div className="rounded-[24px] border border-[var(--border-subtle)] bg-[rgba(255,255,255,0.92)] px-5 py-5">
              <p className="admin-eyebrow">Appearance</p>
              <div className="mt-4 rounded-[20px] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-4 py-4">
                <p className="admin-wrap text-sm text-[var(--text-primary)]">{share.share_title || product.name}</p>
                <p className="admin-wrap mt-2 text-sm leading-6 text-[var(--text-secondary)]">{share.share_description || "A clean prospect-facing entry point for this product demo."}</p>
              </div>
              <p className="mt-4 text-sm leading-6 text-[var(--text-secondary)]">Global brand settings live in Settings. This product surface controls the wording prospects see before and after the demo.</p>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="rounded-[24px] border border-[var(--border-subtle)] bg-[rgba(255,255,255,0.92)] px-5 py-5">
              <p className="admin-eyebrow">Starter questions</p>
              <h2 className="mt-2 text-[1.45rem] font-medium tracking-[-0.04em] text-[var(--text-primary)]">Prospect prompts</h2>
              <div className="mt-4 space-y-3">
                {starterQuestions.map((question, index) => (
                  <div key={`${question}-${index}`} className="flex items-start justify-between gap-3 rounded-[18px] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-4 py-3">
                    <p className="admin-wrap min-w-0 text-sm text-[var(--text-primary)]">{question}</p>
                    <button type="button" onClick={() => setQuestions(starterQuestions.filter((_, itemIndex) => itemIndex !== index))} className="shrink-0 text-sm text-[var(--text-secondary)]">Remove</button>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex gap-3">
                <input className="input" placeholder="Add starter question" value={newQuestion} onChange={(event) => setNewQuestion(event.target.value)} />
                <button type="button" className="btn-secondary" onClick={addStarterQuestion}>Add</button>
              </div>
            </div>

            <div className="rounded-[24px] border border-[var(--border-subtle)] bg-[rgba(255,255,255,0.92)] px-5 py-5">
              <p className="admin-eyebrow">Session settings</p>
              <h2 className="mt-2 text-[1.45rem] font-medium tracking-[-0.04em] text-[var(--text-primary)]">What the prospect experiences</h2>
              <div className="mt-5 space-y-4">
                <div>
                  <label className="mb-3 block text-sm text-[var(--text-primary)]">Session time limit</label>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {[10, 20, 30].map((minutes) => (
                      <button key={minutes} type="button" className="admin-radio text-left" data-active={sessionSettings.time_limit_minutes === minutes ? "true" : "false"} onClick={() => setSessionSettings({ ...sessionSettings, time_limit_minutes: minutes })}>
                        <p className="text-sm text-[var(--text-primary)]">{minutes} minutes</p>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="mb-3 block text-sm text-[var(--text-primary)]">Welcome flow</label>
                  <div className="grid gap-3">
                    {([
                      ["guided", "Show a guided walkthrough first"],
                      ["self_serve", "Let the prospect steer immediately"],
                    ] as const).map(([value, label]) => (
                      <button key={value} type="button" className="admin-radio text-left" data-active={sessionSettings.welcome_flow === value ? "true" : "false"} onClick={() => setSessionSettings({ ...sessionSettings, welcome_flow: value })}>
                        <p className="text-sm text-[var(--text-primary)]">{label}</p>
                      </button>
                    ))}
                  </div>
                </div>
                <div><label className="mb-2 block text-sm text-[var(--text-primary)]">Share title</label><input className="input" value={share.share_title} onChange={(event) => setShare({ ...share, share_title: event.target.value })} /></div>
                <div><label className="mb-2 block text-sm text-[var(--text-primary)]">Share description</label><textarea className="textarea" rows={3} value={share.share_description} onChange={(event) => setShare({ ...share, share_description: event.target.value })} /></div>
                <div><label className="mb-2 block text-sm text-[var(--text-primary)]">Post-session message</label><textarea aria-label="Post Session Message" className="textarea" rows={4} value={sessionSettings.post_session_message} onChange={(event) => setSessionSettings({ ...sessionSettings, post_session_message: event.target.value })} /></div>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button type="submit" className="btn-primary" disabled={saving === "share"}>
              {saving === "share" ? "Saving..." : "Save share settings"}
            </button>
          </div>
        </form>
      ) : null}
    </AdminShell>
  );
}
