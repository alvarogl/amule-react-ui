import { describe, expect, it } from "vitest";
import { downloadsSchema, statusSchema } from "./amule-api";
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
