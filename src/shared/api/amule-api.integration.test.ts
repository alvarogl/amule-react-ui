import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { api } from "./amule-api";

const server = setupServer(
  http.get("*/api/v1/status", () =>
    HttpResponse.json({
      ec_connected: true,
      ed2k: {
        state: "connected",
        high_id: true,
        user_id: 1,
        public_ip: "203.0.113.1",
        connected_since_at: 1,
        server_name: "server",
        server_ip: "203.0.113.2",
        server_port: 4661,
        network: { user_count: 1, file_count: 2 },
      },
      kad: {
        state: "connected",
        firewalled_tcp: false,
        connected_since_at: 1,
        network: { user_count: 1, file_count: 2, node_count: 3 },
      },
      speeds: {
        download_speed_bytes_per_second: 10,
        upload_speed_bytes_per_second: 20,
        download_overhead_bytes_per_second: 0,
        upload_overhead_bytes_per_second: 0,
      },
      disk: { temp_free_bytes: 1, incoming_free_bytes: 1 },
      queue: { waiting_upload_client_count: 1, download_source_count: 2 },
    }),
  ),
  http.get("*/api/v1/downloads", () => HttpResponse.json({ downloads: [] })),
  http.get("*/api/v1/clients", () => HttpResponse.json({ clients: [] })),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("aMule REST client integration", () => {
  it("uses the same-origin API base through the HTTP boundary", async () => {
    await expect(api.status()).resolves.toMatchObject({
      ec_connected: true,
      speeds: { download_speed_bytes_per_second: 10, upload_speed_bytes_per_second: 20 },
    });
    await expect(api.downloads()).resolves.toEqual({ downloads: [] });
  });

  it("uses the API's singular uploading activity filter", async () => {
    let activity: string | null = null;
    server.use(
      http.get("*/api/v1/clients", ({ request }) => {
        activity = new URL(request.url).searchParams.get("activity");
        return HttpResponse.json({ clients: [] });
      }),
    );

    await expect(api.uploadClients()).resolves.toEqual({ clients: [] });
    expect(activity).toBe("uploading");
  });

  it("maps frontend statistic graph names to the native API contract", async () => {
    server.use(
      http.get("*/api/v1/stats/graphs/download_speed", () =>
        HttpResponse.json({
          graph: "download_speed",
          unit: "bytes_per_second",
          interval_seconds: 1,
          points: [{ at: 1, value: 42 }],
          session: {
            downloaded_bytes: 1,
            uploaded_bytes: 2,
            kad_node_seconds: 3,
            duration_seconds: 4,
          },
        }),
      ),
    );

    await expect(api.statisticsGraph("download", 60)).resolves.toMatchObject({
      graph: "download_speed",
      points: [{ at: 1, value: 42 }],
    });
  });

  it("sends the native search filter keys and file-type token", async () => {
    let body: unknown;
    server.use(
      http.post("*/api/v1/search", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({
          search_id: 1,
          query: "rammstein",
          type: "global",
          state: "running",
          client_ecid: null,
        });
      }),
    );

    await expect(
      api.startSearch("rammstein", "global", {
        file_type: "video",
        min_size_bytes: 1_048_576,
        max_size_bytes: 2_097_152,
        min_source_count: 2,
      }),
    ).resolves.toMatchObject({ search_id: 1 });
    expect(body).toEqual({
      query: "rammstein",
      type: "global",
      file_type: "video",
      min_size_bytes: 1_048_576,
      max_size_bytes: 2_097_152,
      min_source_count: 2,
    });
  });

  it("surfaces throttled update checks and rejected destructive operations", async () => {
    server.use(
      http.post("*/api/v1/version/check", () =>
        HttpResponse.json(
          { error: { code: "update_check_throttled", message: "Try again later" } },
          { status: 429 },
        ),
      ),
      http.delete("*/api/v1/downloads/completed", () =>
        HttpResponse.json(
          {
            error: {
              code: "completed_use_clear_completed",
              message: "Clear completed notifications instead",
            },
          },
          { status: 409 },
        ),
      ),
    );

    await expect(api.checkVersion()).rejects.toMatchObject({
      status: 429,
      message: "Try again later",
    });
    await expect(api.removeDownload("completed")).rejects.toMatchObject({
      status: 409,
      message: "Clear completed notifications instead",
    });
  });
});
