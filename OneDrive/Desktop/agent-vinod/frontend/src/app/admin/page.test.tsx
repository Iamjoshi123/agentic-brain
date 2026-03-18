import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AdminPage from "./page";

const adminApiMock = vi.hoisted(() => ({
  me: vi.fn(),
  listProducts: vi.fn(),
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
  });

  it("uses products as the default admin landing screen", async () => {
    render(<AdminPage />);

    expect(await screen.findByRole("heading", { name: "Products" })).toBeInTheDocument();
    expect(screen.getByText("Saleshandy")).toBeInTheDocument();
    expect(screen.getAllByText("Live").length).toBeGreaterThan(0);
  });

  it("loads authenticated admin context through the shell", async () => {
    render(<AdminPage />);

    await waitFor(() => {
      expect(adminApiMock.me).toHaveBeenCalled();
      expect(adminApiMock.listProducts).toHaveBeenCalled();
    });
  });
});
