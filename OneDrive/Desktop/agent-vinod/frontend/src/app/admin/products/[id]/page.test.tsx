import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AdminProductDetailPage from "./page";

const adminApiMock = vi.hoisted(() => ({
  me: vi.fn(),
  getProduct: vi.fn(),
  listKnowledgeSources: vi.fn(),
  getProductConfig: vi.fn(),
  getProductSessionSettings: vi.fn(),
  getProductShare: vi.fn(),
  listSessions: vi.fn(),
  getSessionDetail: vi.fn(),
  updateProductConfig: vi.fn(),
  testAgent: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/products/ws-1",
  useParams: () => ({ id: "ws-1" }),
  useSearchParams: () => new URLSearchParams(""),
}));

vi.mock("@/lib/api", () => ({
  adminApi: adminApiMock,
}));

describe("AdminProductDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adminApiMock.me.mockResolvedValue({
      user: { id: "u1", email: "admin@demoagent.local", full_name: "Admin Owner" },
      organization: { id: "org-1", name: "DemoAgent", slug: "demoagent" },
      role: "owner",
    });
    adminApiMock.getProduct.mockResolvedValue({
      id: "ws-1",
      name: "Acme CRM",
      description: "Sales workspace",
      product_url: "https://app.example.com",
      allowed_domains: "app.example.com",
      browser_auth_mode: "credentials",
      is_active: true,
      public_token: "token-123",
      knowledge_count: 1,
      session_count: 1,
      live_link: "/meet/token-123",
      embed_code: "<iframe></iframe>",
      share_title: "Interactive product demo",
      share_description: "Try the demo",
    });
    adminApiMock.listKnowledgeSources.mockResolvedValue([
      {
        id: "source-1",
        source_type: "help_doc_url",
        title: "Reporting docs",
        status: "ready",
        sync_status: "ready",
        source_url: "https://help.example.com/reporting",
        file_name: null,
        jobs: [],
      },
    ]);
    adminApiMock.getProductConfig.mockResolvedValue({
      agent_name: "Avery",
      greeting_template: "Welcome",
      warmth: 70,
      enthusiasm: 75,
      formality: 30,
      response_length: "balanced",
      confidence_threshold: 60,
      citation_mode: "admin_only",
      navigation_style: "show_while_telling",
      model_provider: "auto",
      avoid_topics_json: "[]",
      escalation_message: "Escalate",
      escalation_destination: "sales@example.com",
    });
    adminApiMock.getProductSessionSettings.mockResolvedValue({
      time_limit_minutes: 20,
      welcome_flow: "guided",
      suggested_questions_json: '["Show me reporting"]',
      post_session_message: "Thanks",
      recording_enabled: true,
    });
    adminApiMock.getProductShare.mockResolvedValue({
      live_link: "/meet/token-123",
      embed_code: "<iframe></iframe>",
      share_title: "Interactive product demo",
      share_description: "Try the demo",
    });
    adminApiMock.listSessions.mockResolvedValue([
      {
        id: "sess-1",
        buyer_name: "Taylor Buyer",
        product_name: "Acme CRM",
        mode: "live",
        lead_intent_score: 74,
        started_at: "2026-03-17T00:00:00.000Z",
      },
    ]);
    adminApiMock.getSessionDetail.mockResolvedValue({
      session: { id: "sess-1", buyer_name: "Taylor Buyer", product_name: "Acme CRM", started_at: "2026-03-17T00:00:00.000Z" },
      summary: {
        lead_intent_score: 74,
        total_messages: 4,
        total_actions: 3,
        summary_text: "Taylor Buyer explored reporting and onboarding.",
        top_questions: JSON.stringify(["How does reporting work?"]),
        features_interest: JSON.stringify(["reporting"]),
        objections: JSON.stringify(["pricing"]),
      },
      messages: [
        { id: "m1", role: "user", content: "Show me reporting" },
        { id: "m2", role: "agent", content: "I'll open the analytics section." },
      ],
      actions: [{ id: "a1" }],
      recording: { video_path: "tmp/admin_uploads/recordings/ws-1/session.webm" },
      citations_used: [
        {
          document_id: "doc-1",
          title: "Reporting docs",
          source_type: "help_doc_url",
          excerpt: "Analytics includes reporting.",
        },
      ],
    });
    adminApiMock.updateProductConfig.mockResolvedValue({
      agent_name: "Nova",
      greeting_template: "Welcome",
      warmth: 70,
      enthusiasm: 75,
      formality: 30,
      response_length: "balanced",
      confidence_threshold: 60,
      citation_mode: "buyers",
      navigation_style: "show_while_telling",
      model_provider: "auto",
      avoid_topics_json: "[]",
      escalation_message: "Escalate",
      escalation_destination: "sales@example.com",
    });
    adminApiMock.testAgent.mockResolvedValue({
      decision: "answer_only",
      response_text: "Reporting is available in the analytics section.",
      citations: [
        {
          document_id: "doc-1",
          title: "Reporting docs",
          source_type: "help_doc_url",
          source_url: null,
          excerpt: "Reporting is available in analytics.",
        },
      ],
    });
  });

  it("renders the new product tabs and knowledge surface", async () => {
    render(<AdminProductDetailPage />);

    expect(await screen.findByText("Acme CRM")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Share" })).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Knowledge" }));
    expect((await screen.findAllByText("Reporting docs")).length).toBeGreaterThan(0);
    expect(screen.getByText("Dry-run a buyer question")).toBeInTheDocument();
  });

  it("updates agent config and renders citations in the test panel", async () => {
    render(<AdminProductDetailPage />);
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Agent" }));
    await user.clear(screen.getByLabelText("Agent Name"));
    await user.type(screen.getByLabelText("Agent Name"), "Nova");
    await user.click(screen.getByRole("button", { name: "Show to buyers" }));
    await user.click(screen.getByRole("button", { name: "Save agent settings" }));

    await waitFor(() => {
      expect(adminApiMock.updateProductConfig).toHaveBeenCalled();
    });

    await user.click(screen.getByRole("button", { name: "Knowledge" }));
    await user.click(screen.getByRole("button", { name: "Run test" }));
    expect(await screen.findByText("Reporting is available in the analytics section.")).toBeInTheDocument();
    expect(screen.getAllByText("Reporting docs").length).toBeGreaterThan(0);
  });
});
