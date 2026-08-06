import { describe, expect, it } from "vitest";
import { getErrorMessage } from "./errors";

describe("getErrorMessage", () => {
  it("returns a safe fallback for non-Error values", () => {
    expect(getErrorMessage("network failure")).toBe("Something went wrong.");
  });

  it("preserves a meaningful Error message", () => {
    expect(getErrorMessage(new Error("Request failed"))).toBe("Request failed");
  });
});
