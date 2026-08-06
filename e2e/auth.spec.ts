import { expect, test } from "@playwright/test";

test("covers session protection, transfer deletion, and search cleanup", async ({ page }) => {
  let authenticated = false;
  let expireNextStatus = false;
  const download = {
    hash: "0123456789abcdef0123456789abcdef",
    name: "example.iso",
    size: 1_024,
    size_done: 512,
    progress: { percent: 50 },
    status: "downloading",
    speed_bps: 100,
    category: 0,
    priority: "normal",
    priority_auto: false,
  };
  let downloads = [download];
  let deletedHash: string | undefined;
  let searches: Array<{ search_id: number; query: string; kind: "global"; state: string }> = [];
  let stoppedSearch: unknown;
  await page.route("**/api/v0/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

    if (url.pathname.endsWith("/events")) {
      await route.fulfill({ status: 200, contentType: "text/event-stream", body: "" });
    } else if (url.pathname.endsWith("/auth/session")) {
      await json(
        authenticated
          ? { role: "admin", exp: "2099-01-01T00:00:00Z", exp_unix: 4_070_908_800, jti: "test" }
          : { error: { code: "unauthorized", message: "Not signed in" } },
        authenticated ? 200 : 401,
      );
    } else if (url.pathname.endsWith("/auth/login") && request.method() === "POST") {
      authenticated = true;
      await json({
        role: "admin",
        expires_at: "2099-01-01T00:00:00Z",
        expires_at_unix: 4_070_908_800,
      });
    } else if (url.pathname.endsWith("/status")) {
      if (expireNextStatus) {
        await json({ error: { code: "unauthorized", message: "Session expired" } }, 401);
        return;
      }
      await json({
        ec_connected: true,
        ed2k: { state: "connected", low_id: false, server_name: "Test server" },
        kad: { state: "connected", firewalled: false },
        speeds: { download_bps: 0, upload_bps: 0 },
        queue: { upload_queue_length: 0, total_source_count: 0 },
      });
    } else if (
      url.pathname === `/api/v0/downloads/${download.hash}` &&
      request.method() === "DELETE"
    ) {
      deletedHash = download.hash;
      downloads = [];
      await json({ ok: true });
    } else if (url.pathname.endsWith("/downloads")) {
      await json({ downloads });
    } else if (url.pathname.endsWith("/search") && request.method() === "POST") {
      const body = request.postDataJSON() as { query: string; type: "global" };
      searches = [{ search_id: 7, query: body.query, kind: body.type, state: "finished" }];
      await json({ ok: true, search_id: 7, query: body.query });
    } else if (url.pathname.endsWith("/search")) {
      await json({ searches });
    } else if (url.pathname.endsWith("/search/results")) {
      await json({
        search_id: 7,
        results: [],
        progress: { state: "finished", kind: "global", percent: 100 },
      });
    } else if (url.pathname.endsWith("/search/stop") && request.method() === "POST") {
      stoppedSearch = request.postDataJSON();
      searches = [];
      await json({ ok: true });
    } else if (url.pathname.endsWith("/clients")) {
      await json({ clients: [] });
    } else if (url.pathname.endsWith("/categories")) {
      await json({ categories: [] });
    } else if (url.pathname.endsWith("/version")) {
      await json({
        name: "amuleapi",
        api_version: "v0",
        amule_version: "3.0.1",
        daemon_version: "3.0.1",
        update: {
          check_enabled: false,
          checked: false,
          latest_version: "",
          update_available: null,
          last_checked: null,
        },
      });
    } else {
      await json({ ok: true });
    }
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "aMule Console" })).toBeVisible();
  await page.getByLabel("Admin password").fill("not-persisted");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByText("Test server")).toBeVisible();
  await expect(page.evaluate(() => localStorage.length)).resolves.toBe(0);
  await expect(page.evaluate(() => sessionStorage.length)).resolves.toBe(0);

  await page.getByRole("button", { name: "Delete example.iso" }).click();
  await expect(page.getByRole("heading", { name: "Delete download?" })).toBeVisible();
  await page.getByRole("button", { name: "Delete download", exact: true }).click();
  await expect.poll(() => deletedHash).toBe(download.hash);
  await expect.poll(async () => page.locator(".transfer-table tbody tr").count()).toBe(0);

  await page.getByRole("button", { name: "Search" }).click();
  await page.getByPlaceholder("Find files").fill("example");
  await page.locator(".search-form").getByRole("button", { name: "Search" }).click();
  await expect(page.getByRole("button", { name: /example finished/ })).toBeVisible();
  await page.getByRole("button", { name: "Close example" }).click();
  await expect.poll(() => stoppedSearch).toEqual({ search_id: 7, close: true });
  await expect(page.getByRole("button", { name: "Close example" })).not.toBeVisible();

  expireNextStatus = true;
  await page.reload();
  await expect(page.getByRole("heading", { name: "aMule Console" })).toBeVisible();
});
