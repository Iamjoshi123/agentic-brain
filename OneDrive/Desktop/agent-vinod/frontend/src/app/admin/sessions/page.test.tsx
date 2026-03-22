import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AdminSessionsPage from "./page";

const adminApiMock = vi.hoisted(() => ({
  me: vi.fn(),
  listProducts: vi.fn(),
  listSessions: vi.fn(),
  getSessionDetail: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/sessions",
}));

vi.mock("@/lib/api", () => ({
  adminApi: adminApiMock,
}));

describe("AdminSessionsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adminApiMock.me.mockResolvedValue({
      user: { id: "u1", email: "admin@demoagent.local", full_name: "Admin Owner" },
      organization: { id: "org-1", name: "DemoAgent", slug: "demoagent" },
      role: "owner",
    });
    adminApiMock.listProducts.mockResolvedValue([
      {
        id: "ws-1",
        name: "Acme CRM",
        description: "Sales workspace",
        product_url: "https://app.example.com",
        allowed_domains: "app.example.com",
        browser_auth_mode: "credentials",
        public_token: "demo-acme-crm-001",
        is_active: true,
        knowledge_count: 4,
        session_count: 7,
        created_at: "2026-03-17T00:00:00.000Z",
        updated_at: "2026-03-17T00:00:00.000Z",
      },
    ]);
    adminApiMock.listSessions.mockResolvedValue([
      {
        id: "sess-1",
        buyer_name: "Taylor Buyer",
        product_name: "Acme CRM",
        mode: "live",
        lead_intent_score: 74,
        started_at: "2026-03-17T00:00:00.000Z",
      },
      {
        id: "sess-2",
        buyer_name: "Jordan Prospect",
        product_name: "Saleshandy",
        mode: "text",
        lead_intent_score: 41,
        started_at: "2026-03-17T01:00:00.000Z",
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
      citations_used: [
        {
          document_id: "doc-1",
          title: "Reporting docs",
          source_type: "help_doc_url",
          excerpt: "Analytics includes reporting.",
        },
      ],
    });
  });

  it("renders transcript, insights, and citations", async () => {
    render(<AdminSessionsPage searchParams={{ session: "sess-1" }} />);

    expect((await screen.findAllByText("Taylor Buyer")).length).toBeGreaterThan(0);
    expect(await screen.findByText("Conversation")).toBeInTheDocument();
    expect(screen.getByText("Taylor Buyer explored reporting and onboarding.")).toBeInTheDocument();
    expect(screen.getByText("Show me reporting")).toBeInTheDocument();
    expect(screen.getByText("Reporting docs")).toBeInTheDocument();
  });

  it("loads another session when selected from the table", async () => {
    render(<AdminSessionsPage searchParams={{ session: "sess-1" }} />);
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: /Jordan Prospect/i }));

    await waitFor(() => {
      expect(adminApiMock.getSessionDetail).toHaveBeenCalledWith("sess-2");
    });
  });
});
