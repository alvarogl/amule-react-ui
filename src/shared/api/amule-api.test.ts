import { afterEach, describe, expect, it, vi } from "vitest";
import { unauthorizedEvent } from "@/shared/auth/unauthorized";
import {
  api,
  amuleLogSchema,
  downloadsSchema,
  kadSchema,
  searchResultsSchema,
  sharedDirectoriesSchema,
  sharedFilesSchema,
  statusSchema,
  statisticsGraphSchema,
  statisticsTreeSchema,
} from "./amule-api";

afterEach(() => vi.unstubAllGlobals());
describe("aMule schemas", () => {
  it("accepts the status contract", () =>
    expect(
      statusSchema.parse({
        ec_connected: true,
        ed2k: { state: "connected", low_id: false },
        kad: { state: "connected", firewalled: false },
        speeds: { download_bps: 1, upload_bps: 2 },
        queue: { upload_queue_length: 0, total_source_count: 3 },
      }).ed2k.low_id,
    ).toBe(false));
  it("rejects a malformed download response", () =>
    expect(() => downloadsSchema.parse({ downloads: [{ hash: 1 }] })).toThrow());
  it("accepts search ratings and Kad notes", () =>
    expect(
      searchResultsSchema.parse({
        search_id: 1,
        results: [
          {
            hash: "hash",
            name: "file",
            size: 1,
            already_have: false,
            sources: { total: 2, complete: 1 },
            children: [],
            rating: 4,
            kad_comment_search_running: false,
            comments: [{ username: "peer", filename: "file", rating: 5, comment: "Good" }],
          },
        ],
        progress: { state: "finished", kind: "global", percent: 100 },
      }).results[0].comments,
    ).toHaveLength(1));
  it("accepts a shared-file list entry", () =>
    expect(
      sharedFilesSchema.parse({
        shared: [
          {
            hash: "hash",
            name: "file",
            ed2k_link: "ed2k://|file|file|1|hash|/",
            size: 1,
            priority: "normal",
            priority_auto: false,
            complete_sources: 2,
            xfer: { session: 0, total: 1 },
            requests: { session: 0, total: 1 },
            accepts: { session: 0, total: 1 },
            upload_speed_bps: 0,
            uploading: 0,
            last_upload: 0,
            shared_since: 0,
          },
        ],
      }).shared,
    ).toHaveLength(1));
  it("accepts share roots with their recursion setting", () =>
    expect(
      sharedDirectoriesSchema.parse({
        directories: [{ path: "/media", recursive: true }],
      }).directories[0],
    ).toEqual({ path: "/media", recursive: true }));
  it("accepts the detailed Kad status contract", () =>
    expect(
      kadSchema.parse({
        state: "connected",
        firewalled: false,
        firewalled_udp: false,
        in_lan_mode: false,
        ip: "203.0.113.5",
        network: { users: 1, files: 2, nodes: 3 },
        indexed: { sources: 4, keywords: 5, notes: 6, load: 7 },
      }).network.nodes,
    ).toBe(3));
  it("accepts the structured aMule log buffer", () =>
    expect(amuleLogSchema.parse({ lines: ["one"], total_cached: 2, returned: 1 }).lines).toEqual([
      "one",
    ]));
  it("accepts typed statistics tree values and graph samples", () => {
    expect(
      statisticsTreeSchema.parse({
        nodes: [
          {
            key: "upload_data",
            label: "Total uploaded: %s",
            values: [
              {
                type: "bytes",
                value: 1024,
                extra: { type: "bytes", value: 2048 },
              },
            ],
            children: [],
          },
        ],
      }).nodes,
    ).toHaveLength(1);
    expect(
      statisticsGraphSchema.parse({
        graph: "download",
        unit: "bps",
        interval_seconds: 1,
        points: [{ t: "2026-01-01T00:00:00Z", t_unix: 1, value: 42 }],
        session: { download_bytes: 1, upload_bytes: 2, kad_bytes: 3 },
      }).points[0].value,
    ).toBe(42);
  });
});

describe("api authentication", () => {
  it("notifies the session boundary when a request is unauthorized", async () => {
    const listener = vi.fn();
    window.addEventListener(unauthorizedEvent, listener);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { code: "unauthorized", message: "Expired" } }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    await expect(api.status()).rejects.toThrow("Expired");
    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener(unauthorizedEvent, listener);
  });
});

describe("log mutations", () => {
  it("accepts a no-content log clear response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));

    await expect(api.clearAmuleLog()).resolves.toEqual({});
  });
});
