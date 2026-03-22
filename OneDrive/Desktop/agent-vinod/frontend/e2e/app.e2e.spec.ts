import { expect, test } from "@playwright/test";

test("home page exposes admin and meeting entrypoints only", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("link", { name: "Admin Dashboard" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open Meeting" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Legacy Demo" })).toHaveCount(0);
});
