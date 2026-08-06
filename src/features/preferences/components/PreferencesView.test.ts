import { describe, expect, it } from "vitest";
import { validatePreferences } from "../preferences-validation";

describe("advanced preference validation", () => {
  it("blocks invalid port ranges before a preference patch", () => {
    expect(validatePreferences({ connection: { tcp_port: 0 } })).toEqual([
      "Connection.Tcp Port must be between 1 and 65535.",
    ]);
  });

  it("blocks unsupported enum values", () => {
    expect(validatePreferences({ security: { shared_files_visibility: "local" } })).toEqual([
      "Security.Shared Files Visibility has an invalid value.",
    ]);
  });
});
