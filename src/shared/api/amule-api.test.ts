import { afterEach, describe, expect, it, vi } from "vitest";
import { unauthorizedEvent } from "@/shared/auth/unauthorized";
import {
  api,
  downloadsSchema,
  searchResultsSchema,
  sharedFilesSchema,
  statusSchema,
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
