import { expect, test } from "@playwright/test";

test("covers core session and mutation workflows", async ({ page }) => {
  let authenticated = false;
  let expireNextStatus = false;
  const download = {
    hash: "0123456789abcdef0123456789abcdef",
    name: "example.iso",
    size_bytes: 1_024,
    completed_bytes: 512,
    transferred_bytes: 512,
    progress: { percent: 50 },
    status: "downloading",
    speed_bytes_per_second: 100,
    category_index: 0,
    priority: "normal",
    priority_auto: false,
  };
  let downloads = [download];
  let deletedHash: string | undefined;
  let searches: Array<{ search_id: number; query: string; type: "global"; state: string }> = [];
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
    ecid: 42,
    name: "Peer One",
    ip: "192.0.2.42",
    software: "aMule",
    software_version: "3.0",
    upload_state: "idle",
    download_state: "downloading",
    upload_file_name: "",
    download_file_name: "example.iso",
    upload_speed_bytes_per_second: 0,
    download_speed_bytes_per_second: 10,
  };
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

    if (url.pathname.endsWith("/events")) {
      await route.fulfill({ status: 200, contentType: "text/event-stream", body: "" });
    } else if (url.pathname.endsWith("/auth/session")) {
      await json(
        authenticated
          ? { role: "admin", expires_at: 4_070_908_800, session_id: "test" }
          : { error: { code: "unauthorized", message: "Not signed in" } },
        authenticated ? 200 : 401,
      );
    } else if (url.pathname.endsWith("/auth/login") && request.method() === "POST") {
      authenticated = true;
      await json({
        role: "admin",
        expires_at: 4_070_908_800,
        session_id: "test",
      });
    } else if (url.pathname.endsWith("/status")) {
      if (expireNextStatus) {
        await json({ error: { code: "unauthorized", message: "Session expired" } }, 401);
        return;
      }
      await json({
        ec_connected: true,
        ed2k: {
          state: "connected",
          high_id: true,
          user_id: 1,
          public_ip: "192.0.2.1",
          connected_since_at: 1,
          server_name: "Test server",
          server_ip: "192.0.2.2",
          server_port: 4661,
          network: { user_count: 1, file_count: 1 },
        },
        kad: {
          state: "connected",
          firewalled_tcp: false,
          connected_since_at: 1,
          network: { user_count: 1, file_count: 1, node_count: 1 },
        },
        speeds: {
          download_speed_bytes_per_second: 0,
          upload_speed_bytes_per_second: 0,
          download_overhead_bytes_per_second: 0,
          upload_overhead_bytes_per_second: 0,
        },
        disk: { temp_free_bytes: 1, incoming_free_bytes: 1 },
        queue: { waiting_upload_client_count: 0, download_source_count: 0 },
      });
    } else if (
      url.pathname === `/api/v1/downloads/${download.hash}` &&
      request.method() === "DELETE"
    ) {
      deletedHash = download.hash;
      downloads = [];
      await json({ ok: true });
    } else if (url.pathname.endsWith("/downloads")) {
      await json({ downloads });
    } else if (url.pathname.endsWith("/search") && request.method() === "POST") {
      const body = request.postDataJSON() as { query: string; type: "global" };
      searches = [{ search_id: 7, query: body.query, type: body.type, state: "finished" }];
      await json({
        search_id: 7,
        query: body.query,
        type: body.type,
        state: "finished",
        client_ecid: null,
      });
    } else if (url.pathname.endsWith("/search")) {
      await json({ searches });
    } else if (url.pathname.endsWith("/search/results/peer-file/download")) {
      peerDownloadHash = "peer-file";
      await json({ ok: true });
    } else if (/\/search\/\d+\/results$/.test(url.pathname)) {
      const peerBrowse = url.pathname.endsWith("/search/9/results");
      await json({
        search_id: peerBrowse ? 9 : 7,
        results: peerBrowse
          ? [
              {
                hash: "peer-file",
                name: "peer-file.iso",
                size_bytes: 1024,
                already_downloaded: false,
                sources: { total: 1, complete: 1 },
                alternate_names: [],
                kad_comment_lookup_running: false,
              },
            ]
          : [],
        progress: { state: "finished", type: "global", percent: 100 },
      });
    } else if (/\/search\/\d+\/stop$/.test(url.pathname) && request.method() === "POST") {
      stoppedSearch = url.pathname;
      searches = [];
      await json({ ok: true });
    } else if (url.pathname.endsWith("/servers") && request.method() === "POST") {
      addedServer = request.postDataJSON();
      await json({ ok: true });
    } else if (url.pathname.endsWith("/servers")) {
      await json({ servers: [] });
    } else if (url.pathname.endsWith("/share_directories") && request.method() === "POST") {
      addedShareRoot = request.postDataJSON();
      await json({ results: [] });
    } else if (url.pathname.endsWith("/share_directories")) {
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
    } else if (url.pathname.endsWith("/logs/server_info")) {
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
      await json({ admin_password_set: true, guest_access_enabled: false });
    } else if (url.pathname.endsWith("/clients/42/shared_files")) {
      peerBrowseRequest = 42;
      await json({ search_id: 9, query: "Peer One", type: "browse", state: "finished" });
    } else if (url.pathname.endsWith("/clients/42")) {
      await json(peer);
    } else if (url.pathname.endsWith("/clients")) {
      await json({ clients: [peer] });
    } else if (url.pathname.endsWith("/categories") && request.method() === "POST") {
      createdCategory = request.postDataJSON();
      await route.fulfill({ status: 202 });
    } else if (url.pathname.endsWith("/categories")) {
      await json({ categories: [] });
    } else if (url.pathname.endsWith("/version")) {
      await json({
        name: "amuleapi",
        api_version: "v1",
        amuleapi_version: "3.1.0",
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
  await expect.poll(() => stoppedSearch).toBe("/api/v1/search/7/stop");
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
  await expect
    .poll(() => createdCategory)
    .toEqual({ name: "Images", save_path: "/downloads/images" });

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
