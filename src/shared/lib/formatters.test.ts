import { describe, expect, it } from "vitest";
import { formatBytes, formatDuration, formatMebibytes, formatRate } from "./formatters";

describe("formatRate", () => {
  it("keeps a changing rate in the smallest readable unit", () => {
    expect(formatRate(900 * 1024)).toBe("900 KiB/s");
    expect(formatRate(900 * 1024 * 1024)).toBe("900 MiB/s");
  });
});

describe("formatMebibytes", () => {
  it("renders unknown sizes and values consistently", () => {
    expect(formatMebibytes()).toBe("—");
    expect(formatMebibytes(1024 * 1024)).toBe("1.0 MiB");
  });
});

describe("statistics formatters", () => {
  it("formats typed byte and duration values for the statistics tree", () => {
    expect(formatBytes(900 * 1024)).toBe("900 KiB");
    expect(formatDuration(3_661)).toBe("1h 1m");
  });
});
