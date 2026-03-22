import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AdminPage from "./page";

const adminApiMock = vi.hoisted(() => ({
  me: vi.fn(),
  listProducts: vi.fn(),
  getDashboard: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin",
}));

vi.mock("@/lib/api", () => ({
  adminApi: adminApiMock,
}));

describe("AdminPage", () => {
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
        name: "Saleshandy",
        description: "Outbound sales engagement",
        product_url: "https://app.saleshandy.com",
        allowed_domains: "app.saleshandy.com",
        browser_auth_mode: "credentials",
        public_token: "demo-saleshandy-001",
        is_active: true,
        knowledge_count: 8,
        session_count: 21,
        created_at: "2026-03-17T00:00:00.000Z",
        updated_at: "2026-03-17T00:00:00.000Z",
      },
    ]);
    adminApiMock.getDashboard.mockResolvedValue({
      stats: {
        products: 1,
        demos_taken: 21,
        completed_demos: 13,
        positive_intent_sessions: 8,
        average_intent_score: 71,
        transcript_coverage: 21,
        recording_enabled_products: 0,
      },
      reports: {
        top_questions: ["How do sequences work?"],
        objections: ["Pricing"],
        features_interest: ["Sequences"],
      },
      products: [
        {
          id: "ws-1",
          name: "Saleshandy",
          description: "Outbound sales engagement",
          product_url: "https://app.saleshandy.com",
          allowed_domains: "app.saleshandy.com",
          browser_auth_mode: "credentials",
          public_token: "demo-saleshandy-001",
          is_active: true,
          knowledge_count: 8,
          session_count: 21,
          created_at: "2026-03-17T00:00:00.000Z",
          updated_at: "2026-03-17T00:00:00.000Z",
          recording_enabled: false,
          citation_mode: "admin_only",
          navigation_style: "show_while_telling",
          live_link: "http://localhost:3000/meet/demo-saleshandy-001",
          embed_code: "<iframe />",
          share_title: "Interactive product demo",
          share_description: "Open the demo",
        },
      ],
    });
  });

  it("uses dashboard as the default admin landing screen and shows the fuller sidebar", async () => {
    render(<AdminPage />);

    expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getAllByText("21").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Saleshandy").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Products" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sessions" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Embed & Share" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Branding" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Settings" })).toBeInTheDocument();
  });

  it("loads authenticated admin context through the shell", async () => {
    render(<AdminPage />);

    await waitFor(() => {
      expect(adminApiMock.me).toHaveBeenCalled();
      expect(adminApiMock.listProducts).toHaveBeenCalled();
      expect(adminApiMock.getDashboard).toHaveBeenCalled();
    });
  });
});
