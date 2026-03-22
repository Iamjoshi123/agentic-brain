import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AdminProductsPage from "./page";

const adminApiMock = vi.hoisted(() => ({
  me: vi.fn(),
  listProducts: vi.fn(),
  createProduct: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/products",
}));

vi.mock("@/lib/api", () => ({
  adminApi: adminApiMock,
}));

describe("AdminProductsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adminApiMock.me.mockResolvedValue({
      user: { id: "u1", email: "admin@demoagent.local", full_name: "Admin Owner" },
      organization: { id: "org-1", name: "DemoAgent", slug: "demoagent" },
      role: "owner",
    });
    adminApiMock.listProducts
      .mockResolvedValueOnce([
        {
          id: "ws-1",
          name: "Acme CRM With A Much Longer Product Name Than Usual",
          description: "Sales workspace with an intentionally long description to verify wrapping stays inside the row.",
          product_url: "https://app.example.com/really/long/path/that/should/not/overflow/the/admin/products/table",
          allowed_domains: "app.example.com",
          browser_auth_mode: "credentials",
          public_token: "demo-acme-crm-001",
          is_active: false,
          knowledge_count: 4,
          session_count: 7,
          created_at: "2026-03-17T00:00:00.000Z",
          updated_at: "2026-03-17T00:00:00.000Z",
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "ws-1",
          name: "Acme CRM With A Much Longer Product Name Than Usual",
          description: "Sales workspace with an intentionally long description to verify wrapping stays inside the row.",
          product_url: "https://app.example.com/really/long/path/that/should/not/overflow/the/admin/products/table",
          allowed_domains: "app.example.com",
          browser_auth_mode: "credentials",
          public_token: "demo-acme-crm-001",
          is_active: false,
          knowledge_count: 4,
          session_count: 7,
          created_at: "2026-03-17T00:00:00.000Z",
          updated_at: "2026-03-17T00:00:00.000Z",
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "ws-1",
          name: "Acme CRM With A Much Longer Product Name Than Usual",
          description: "Sales workspace with an intentionally long description to verify wrapping stays inside the row.",
          product_url: "https://app.example.com/really/long/path/that/should/not/overflow/the/admin/products/table",
          allowed_domains: "app.example.com",
          browser_auth_mode: "credentials",
          public_token: "demo-acme-crm-001",
          is_active: false,
          knowledge_count: 4,
          session_count: 7,
          created_at: "2026-03-17T00:00:00.000Z",
          updated_at: "2026-03-17T00:00:00.000Z",
        },
        {
          id: "ws-2",
          name: "New Product",
          description: "",
          product_url: "https://new.example.com",
          allowed_domains: "",
          browser_auth_mode: "credentials",
          public_token: "demo-new-product-001",
          is_active: false,
          knowledge_count: 0,
          session_count: 0,
          created_at: "2026-03-17T00:00:00.000Z",
          updated_at: "2026-03-17T00:00:00.000Z",
        },
      ]);
    adminApiMock.createProduct.mockResolvedValue({ id: "ws-2" });
  });

  it("lists products as rows instead of cards", async () => {
    render(<AdminProductsPage />);

    await screen.findAllByText("Acme CRM With A Much Longer Product Name Than Usual");
    const productName = screen
      .getAllByTitle("Acme CRM With A Much Longer Product Name Than Usual")
      .find((element) => element.tagName === "P");
    const productUrl = screen
      .getAllByTitle("https://app.example.com/really/long/path/that/should/not/overflow/the/admin/products/table")
      .find((element) => element.tagName === "SPAN");

    expect(productName).toBeTruthy();
    expect(productName).toHaveAttribute("title", "Acme CRM With A Much Longer Product Name Than Usual");
    expect(productUrl).toHaveAttribute("title", "https://app.example.com/really/long/path/that/should/not/overflow/the/admin/products/table");
    expect(screen.getByText("Ready")).toBeInTheDocument();
  });

  it("creates a product from the inline form", async () => {
    render(<AdminProductsPage />);
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "+ New" }));
    await user.type(screen.getByLabelText("Product Name"), "New Product");
    await user.type(screen.getByLabelText("Product URL"), "https://new.example.com");
    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(adminApiMock.createProduct).toHaveBeenCalledWith({
        name: "New Product",
        description: "",
        product_url: "https://new.example.com",
        allowed_domains: "",
        browser_auth_mode: "credentials",
        is_active: false,
      });
    });
    await waitFor(() => {
      expect(adminApiMock.listProducts).toHaveBeenCalledTimes(3);
    });
  });
});
