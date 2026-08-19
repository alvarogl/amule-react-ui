import { expect, test } from "@playwright/test";

test("covers core session and mutation workflows", async ({ page }) => {
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
  let addedServer: unknown;
  let createdCategory: unknown;
  let kadDisconnect: unknown;
  let clearedLog = false;
  let addedShareRoot: unknown;
  let savedPreferences: unknown;
  let peerBrowseRequest: number | undefined;
  let peerDownloadHash: string | undefined;
  const peer = {
    client_ecid: 42,
    client_name: "Peer One",
    ip: "192.0.2.42",
    software: "aMule",
    software_version: "3.0",
    upload_state: "idle",
    download_state: "downloading",
    upload_file_name: "",
    upload_speed_bps: 0,
    download_speed_bps: 10,
  };
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
    } else if (url.pathname.endsWith("/search/results/peer-file/download")) {
      peerDownloadHash = "peer-file";
      await json({ ok: true });
    } else if (url.pathname.endsWith("/search/results")) {
      const peerBrowse = url.searchParams.get("search_id") === "9";
      await json({
        search_id: peerBrowse ? 9 : 7,
        results: peerBrowse
          ? [
              {
                hash: "peer-file",
                name: "peer-file.iso",
                size: 1024,
                already_have: false,
                sources: { total: 1, complete: 1 },
                children: [],
              },
            ]
          : [],
        progress: { state: "finished", kind: "global", percent: 100 },
      });
    } else if (url.pathname.endsWith("/search/stop") && request.method() === "POST") {
      stoppedSearch = request.postDataJSON();
      searches = [];
      await json({ ok: true });
    } else if (url.pathname.endsWith("/servers") && request.method() === "POST") {
      addedServer = request.postDataJSON();
      await json({ ok: true });
    } else if (url.pathname.endsWith("/servers")) {
      await json({ servers: [] });
    } else if (url.pathname.endsWith("/shared/directories") && request.method() === "POST") {
      addedShareRoot = request.postDataJSON();
      await json({ ok: true, rejected: [] });
    } else if (url.pathname.endsWith("/shared/directories")) {
      await json({ directories: [] });
    } else if (url.pathname.endsWith("/shared")) {
      await json({ shared: [] });
    } else if (url.pathname.endsWith("/kad")) {
      await json({
        state: "connected",
        firewalled: false,
        firewalled_udp: false,
        in_lan_mode: false,
        ip: "192.0.2.1",
        network: { users: 1, files: 2, nodes: 3 },
        indexed: { sources: 4, keywords: 5, notes: 6, load: 7 },
      });
    } else if (url.pathname.endsWith("/networks/disconnect")) {
      kadDisconnect = request.postDataJSON();
      await json({ ok: true });
    } else if (url.pathname.endsWith("/logs/amule") && request.method() === "DELETE") {
      clearedLog = true;
      await json({});
    } else if (url.pathname.endsWith("/logs/amule")) {
      await json({ lines: [], total_cached: 0, returned: 0 });
    } else if (url.pathname.endsWith("/logs/serverinfo")) {
      await json({ text: "", total_bytes: 0, returned_bytes: 0 });
    } else if (url.pathname.endsWith("/stats/tree")) {
      await json({ nodes: [] });
    } else if (url.pathname.includes("/stats/graphs/")) {
      const graph = url.pathname.split("/").at(-1);
      await json({
        graph,
        unit: graph === "connections" || graph === "kad" ? "count" : "bps",
        interval_seconds: 1,
        points: [],
        session: { download_bytes: 0, upload_bytes: 0, kad_bytes: 0 },
      });
    } else if (url.pathname.endsWith("/preferences") && request.method() === "PATCH") {
      savedPreferences = request.postDataJSON();
      await json(savedPreferences);
    } else if (url.pathname.endsWith("/preferences")) {
      await json({ general: { nickname: "Test node" } });
    } else if (url.pathname.endsWith("/auth/passwords")) {
      await json({ admin_set: true, guest_enabled: false });
    } else if (url.pathname.endsWith("/clients/42/shared_files")) {
      peerBrowseRequest = 42;
      await json({ ok: true, search_id: 9 });
    } else if (url.pathname.endsWith("/clients/42")) {
      await json(peer);
    } else if (url.pathname.endsWith("/clients")) {
      await json({ clients: [peer] });
    } else if (url.pathname.endsWith("/categories") && request.method() === "POST") {
      createdCategory = request.postDataJSON();
      await json({ index: 1, name: "Images" });
    } else if (url.pathname.endsWith("/categories")) {
      await json({ categories: [] });
    } else if (url.pathname.endsWith("/version")) {
      await json({
        name: "amuleapi",
        api_version: "v0",
        amule_version: "3.0.1",
        daemon_version: "3.0.1",
        update: {
          check_enabled: true,
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
  await page.getByText("Forgot your password?").click();
  await expect(page.getByText("Passwords cannot be recovered here.")).toBeVisible();
  await page.getByLabel("Admin password").fill("not-persisted");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByText("Test server")).toBeVisible();
  await expect(page.getByText("Software updates", { exact: true })).not.toBeVisible();
  await expect(page.evaluate(() => localStorage.length)).resolves.toBe(0);
  await expect(page.evaluate(() => sessionStorage.length)).resolves.toBe(0);

  await page.setViewportSize({ width: 500, height: 900 });
  await page.getByRole("button", { name: "Actions for example.iso" }).click();
  await page.getByRole("button", { name: "Delete example.iso" }).click();
  await expect(page.getByRole("heading", { name: "Delete download?" })).toBeVisible();
  await expect(page.locator(".transfer-actions__popover")).toBeHidden();
  await page.getByRole("button", { name: "Delete download", exact: true }).click();
  await expect.poll(() => deletedHash).toBe(download.hash);
  await expect.poll(async () => page.locator(".transfer-table tbody tr").count()).toBe(0);

  await page.getByRole("link", { name: "Search" }).click();
  await expect(page).toHaveURL(/#\/search$/);
  await page.getByPlaceholder("Find files").fill("example");
  await page.locator(".search-form").getByRole("button", { name: "Search" }).click();
  await expect(page.getByRole("button", { name: /example finished/ })).toBeVisible();
  await page.getByRole("button", { name: "Close example" }).click();
  await expect.poll(() => stoppedSearch).toEqual({ search_id: 7, close: true });
  await expect(page.getByRole("button", { name: "Close example" })).not.toBeVisible();

  await page.locator("nav").getByRole("link", { name: "Servers" }).click();
  await page.getByPlaceholder("IP:port").fill("198.51.100.10:4661");
  await page.getByPlaceholder("Optional server name").fill("Test server");
  await page.getByRole("button", { name: "Add server" }).click();
  await expect
    .poll(() => addedServer)
    .toEqual({
      address: "198.51.100.10:4661",
      name: "Test server",
    });

  await page.locator("nav").getByRole("link", { name: "Categories" }).click();
  await page.getByPlaceholder("Category name").fill("Images");
  await page.getByPlaceholder("Optional download path").fill("/downloads/images");
  await page.getByRole("button", { name: "Create" }).click();
  await expect.poll(() => createdCategory).toEqual({ name: "Images", path: "/downloads/images" });

  for (const [navigation, heading] of [
    ["Shared", "Shared files"],
    ["Kad", "Kad network"],
    ["Logs", "Logs"],
    ["Statistics", "Statistics"],
    ["Peers", "Peers"],
    ["Preferences", "Preferences"],
  ]) {
    await page.locator("nav").getByRole("link", { name: navigation }).click();
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
  }

  await page.locator("nav").getByRole("link", { name: "Kad" }).click();
  await page.getByRole("button", { name: "Disconnect" }).click();
  await expect.poll(() => kadDisconnect).toEqual({ network: "kad" });

  await page.locator("nav").getByRole("link", { name: "Logs" }).click();
  await page.getByRole("button", { name: "Clear active log" }).click();
  await expect(page.getByRole("heading", { name: "Clear aMule log?" })).toBeVisible();
  await page.getByRole("button", { name: "Clear log", exact: true }).click();
  await expect.poll(() => clearedLog).toBe(true);

  await page.locator("nav").getByRole("link", { name: "Shared" }).click();
  await page.getByLabel("Directory path").fill("/media/test");
  await page.getByRole("button", { name: "Add folder" }).click();
  await expect.poll(() => addedShareRoot).toEqual({ path: "/media/test", recursive: true });

  await page.locator("nav").getByRole("link", { name: "Preferences" }).click();
  await expect(page.getByText("Software updates", { exact: true })).toBeVisible();
  await page.getByLabel("Nickname").fill("Updated node");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect.poll(() => savedPreferences).toEqual({ general: { nickname: "Updated node" } });

  await page.locator("nav").getByRole("link", { name: "Peers" }).click();
  await page.getByRole("button", { name: "Details for Peer One" }).click();
  await page.getByRole("button", { name: "Browse shared files" }).click();
  await expect.poll(() => peerBrowseRequest).toBe(42);
  await page.getByRole("button", { name: "Download file" }).click();
  await expect.poll(() => peerDownloadHash).toBe("peer-file");

  expireNextStatus = true;
  await page.reload();
  await expect(page.getByRole("heading", { name: "aMule Console" })).toBeVisible();
});
