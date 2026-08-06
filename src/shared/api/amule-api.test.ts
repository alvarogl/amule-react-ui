import { afterEach, describe, expect, it, vi } from "vitest";
import { unauthorizedEvent } from "@/shared/auth/unauthorized";
import { api, downloadsSchema, statusSchema } from "./amule-api";

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
