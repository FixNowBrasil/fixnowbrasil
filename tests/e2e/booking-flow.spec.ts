import { test, expect } from "@playwright/test";

test.describe("FixNow booking flow", () => {
  test("loads the public app shell", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/FixNow/i);
  });

  test("request area redirects unauthenticated visitors", async ({ page }) => {
    await page.goto("/pedidos");
    await expect(page).not.toHaveURL(/\/pedidos\/?$/);
  });

  test("documents the full backend-dependent flow as an explicit CI prerequisite", async () => {
    const required = [
      "PLAYWRIGHT_CLIENT_EMAIL",
      "PLAYWRIGHT_CLIENT_PASSWORD",
      "PLAYWRIGHT_PROVIDER_EMAIL",
      "PLAYWRIGHT_PROVIDER_PASSWORD",
    ];

    const missing = required.filter((name) => !process.env[name]);
    if (missing.length > 0) {
      test.info().annotations.push({
        type: "backend-prerequisite",
        description: `Full two-user E2E is pending test-environment credentials: ${missing.join(", ")}`,
      });
    }

    expect(missing).toEqual([]);
  });
});
