import { describe, expect, it } from "vitest";
import { formatLogLine } from "./log-lines";

describe("formatLogLine", () => {
  it("separates an aMule timestamp and success message", () =>
    expect(formatLogLine("!2026-08-06 12:00:00: Connected to Kad")).toEqual({
      message: "Connected to Kad",
      tone: "success",
    }));
  it("marks failures while preserving unstructured lines", () =>
    expect(formatLogLine("Connection failed")).toEqual({
      message: "Connection failed",
      tone: "error",
    }));
});
