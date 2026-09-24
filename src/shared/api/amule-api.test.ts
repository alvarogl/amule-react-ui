import { afterEach, describe, expect, it, vi } from "vitest";
import { unauthorizedEvent } from "@/shared/auth/unauthorized";
import {
  api,
  amuleLogSchema,
  clientsSchema,
  downloadsSchema,
  kadSchema,
  searchResultsSchema,
  serversSchema,
  sharedDirectoriesSchema,
  sharedFilesSchema,
  statusSchema,
  versionSchema,
  statisticsGraphSchema,
  statisticsTreeSchema,
} from "./amule-api";

afterEach(() => vi.unstubAllGlobals());
describe("aMule schemas", () => {
  it("accepts the status contract", () =>
    expect(
      statusSchema.parse({
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
          download_speed_bytes_per_second: 1,
          upload_speed_bytes_per_second: 2,
          download_overhead_bytes_per_second: 0,
          upload_overhead_bytes_per_second: 0,
        },
        disk: { temp_free_bytes: 1, incoming_free_bytes: 1 },
        queue: { waiting_upload_client_count: 0, download_source_count: 3 },
      }).ed2k.high_id,
    ).toBe(true));
  it("accepts daemon update availability", () =>
    expect(
      versionSchema.parse({
        service: "amuleapi",
        api_version: "v1",
        amuleapi_version: "3.1.0",
        daemon_version: "3.0.1",
        update: {
          check_enabled: true,
          checked: true,
          latest_version: "3.0.2",
          available: true,
          last_checked_at: 1,
        },
      }).update?.available,
    ).toBe(true));
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
            size_bytes: 1,
            already_downloaded: false,
            sources: { total: 2, complete: 1 },
            alternate_names: [],
            rating: 4,
            kad_comment_lookup_running: false,
            comments: [{ username: "peer", filename: "file", rating: 5, comment: "Good" }],
          },
        ],
        progress: { state: "finished", type: "global", percent: 100 },
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
            size_bytes: 1,
            priority: "normal",
            priority_auto: false,
            sources: { complete: 2 },
            uploaded_bytes_session: 0,
            uploaded_bytes_total: 1,
            request_count_session: 0,
            request_count_total: 1,
            accepted_request_count_session: 0,
            accepted_request_count_total: 1,
            upload_speed_bytes_per_second: 0,
            uploading_client_count: 0,
            last_upload_at: 0,
            shared_since_at: 0,
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
        firewalled_tcp: false,
        firewalled_udp: false,
        lan_mode: false,
        public_ip: "203.0.113.5",
        network: { user_count: 1, file_count: 2, node_count: 3 },
        indexed: { sources: 4, keywords: 5, notes: 6, load_percent: 7 },
        buddy: { state: "connected", ip: "203.0.113.6", port: 4672 },
      }).network.node_count,
    ).toBe(3));
  it("accepts the structured aMule log buffer", () =>
    expect(
      amuleLogSchema.parse({ lines: ["one"], total_lines: 2, returned_lines: 1 }).lines,
    ).toEqual(["one"]));
  it("accepts a peer list entry with live transfer fields", () =>
    expect(
      clientsSchema.parse({
        clients: [
          {
            ecid: 42,
            name: "peer",
            ip: "203.0.113.42",
            software: "amule",
            software_version: "2.3.3",
            upload_state: "uploading",
            upload_file_name: "file.iso",
            upload_speed_bytes_per_second: 10,
            download_state: "idle",
            download_file_name: null,
            download_speed_bytes_per_second: 0,
          },
        ],
      }).clients[0].ecid,
    ).toBe(42));
  it("accepts server counts using the native API field names", () =>
    expect(
      serversSchema.parse({
        servers: [
          {
            ecid: 1,
            name: "Example",
            address: "203.0.113.1:4661",
            user_count: 10,
            file_count: 20,
            priority: "normal",
            permanent: false,
          },
        ],
      }).servers[0].user_count,
    ).toBe(10));
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
      }).points[0].value,
    ).toBe(42);
  });
  it("accepts null statistic extras emitted by the API", () =>
    expect(
      statisticsTreeSchema.parse({
        nodes: [
          {
            label: "Uptime: %s",
            values: [{ type: "time", value: 1, extra: null }],
            children: [],
          },
        ],
      }).nodes[0].values[0].extra,
    ).toBeNull());
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

    await expect(api.clearAmuleLog()).resolves.toBeUndefined();
  });
});

describe("transfer detail mutations", () => {
  it("uses the documented A4AF source envelope", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ a4af_auto: true, source_ecids: [12, 34] }), {
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    await expect(api.downloadA4af("hash")).resolves.toEqual({
      a4af_auto: true,
      source_ecids: [12, 34],
    });
  });
});
