import { test, expect } from "@playwright/test";

test.describe("net-only refactor — middleware behavior", () => {
  test("X-Robots-Tag header is present on every response", async ({ request }) => {
    const response = await request.get("/login");
    const header = response.headers()["x-robots-tag"];
    expect(header).toBeDefined();
    expect(header).toContain("noindex");
    expect(header).toContain("nofollow");
  });

  test("X-Robots-Tag is present on apex too", async ({ request }) => {
    const response = await request.get("/", { maxRedirects: 0 });
    const header = response.headers()["x-robots-tag"];
    expect(header).toBeDefined();
    expect(header).toContain("noindex");
  });

  test("unauthenticated request to protected path redirects to local /login (not cross-domain)", async ({
    page,
    context,
  }) => {
    await context.clearCookies();
    await page.goto("/command", { waitUntil: "commit" });
    expect(page.url()).toMatch(/^http:\/\/localhost:3000\/login/);
    expect(page.url()).not.toContain("allinonemanagementsolutions");
  });

  test("robots.txt blocks all crawlers", async ({ request }) => {
    const response = await request.get("/robots.txt");
    expect(response.status()).toBe(200);
    const body = await response.text();
    expect(body).toContain("User-agent: *");
    expect(body).toContain("Disallow: /");
  });

  test("legacy /aixmos/* static paths return 404 (no longer served)", async ({ request }) => {
    const response = await request.get("/aixmos/index.html");
    expect(response.status()).toBe(404);
  });
});
