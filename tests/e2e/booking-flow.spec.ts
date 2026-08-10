import { test, expect } from "@playwright/test";

const hasE2EUsers =
  !!process.env.PLAYWRIGHT_CLIENT_EMAIL &&
  !!process.env.PLAYWRIGHT_CLIENT_PASSWORD;

test.describe("FixNow booking flow", () => {
  test("loads the authenticated request area", async ({ page }) => {
    await page.goto("/pedidos");
    await expect(page).toHaveTitle(/FixNow/i);
  });

  test("client credentials are configured for the full E2E flow", async () => {
    test.skip(!process.env.CI && !hasE2EUsers, "Full E2E credentials are not configured yet");
    expect(process.env.PLAYWRIGHT_CLIENT_EMAIL).toBeTruthy();
    expect(process.env.PLAYWRIGHT_CLIENT_PASSWORD).toBeTruthy();
  });
});
