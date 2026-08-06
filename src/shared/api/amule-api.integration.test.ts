import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { api } from "./amule-api";

const server = setupServer(
  http.get("*/api/v0/status", () =>
    HttpResponse.json({
      ec_connected: true,
      ed2k: { state: "connected", low_id: false },
      kad: { state: "connected", firewalled: false },
      speeds: { download_bps: 10, upload_bps: 20 },
      queue: { upload_queue_length: 1, total_source_count: 2 },
    }),
  ),
  http.get("*/api/v0/downloads", () => HttpResponse.json({ downloads: [] })),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("aMule REST client integration", () => {
  it("uses the same-origin API base through the HTTP boundary", async () => {
    await expect(api.status()).resolves.toMatchObject({
      ec_connected: true,
      speeds: { download_bps: 10, upload_bps: 20 },
    });
    await expect(api.downloads()).resolves.toEqual({ downloads: [] });
  });
});
