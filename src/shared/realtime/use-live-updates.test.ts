import { describe, expect, it, vi } from "vitest";
import type { Download } from "@/shared/api/amule-api";
import { liveEventTypes, subscribeToLiveUpdates } from "./use-live-updates";

class FakeEventSource {
  static current: FakeEventSource | undefined;
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  close = vi.fn();
  private listeners = new Map<string, EventListener>();

  constructor(
    readonly url: string,
    readonly options?: EventSourceInit,
  ) {
    FakeEventSource.current = this;
  }

  addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
    this.listeners.set(type, listener as EventListener);
  }

  emit(type: string, data: unknown = {}) {
    this.listeners.get(type)?.(new MessageEvent(type, { data: JSON.stringify(data) }));
  }
}

function setup() {
  const invalidateQueries = vi.fn();
  let downloads = {
    downloads: [
      {
        hash: "download-1",
        name: "example.iso",
        status: "downloading",
        size: 100,
        size_done: 10,
        progress: { percent: 10 },
      },
    ],
  };
  const setQueryData = vi.fn(
    (
      key: readonly unknown[],
      updater: (current: typeof downloads | undefined) => typeof downloads | undefined,
    ) => {
      if (key.join(",") === "downloads") downloads = updater(downloads) ?? downloads;
    },
  );
  const onStreamError = vi.fn();
  const unsubscribe = subscribeToLiveUpdates({
    queryClient: { invalidateQueries, setQueryData } as never,
    onStreamError,
    EventSourceClass: FakeEventSource as never,
  });
  return {
    getDownloads: () => downloads,
    invalidateQueries,
    onStreamError,
    setQueryData,
    stream: FakeEventSource.current!,
    unsubscribe,
  };
}

describe("live update subscription", () => {
  it("refreshes snapshots for every documented live event", () => {
    const { getDownloads, invalidateQueries, setQueryData, stream } = setup();

    stream.emit("download_updated", {
      hash: "download-1",
      name: "example.iso",
      status: "downloading",
      size: 100,
      size_done: 25,
      progress: { percent: 25 },
    } satisfies Download);

    expect(liveEventTypes).toContain("download_updated");
    expect(setQueryData).toHaveBeenCalledWith(["downloads"], expect.any(Function));
    expect(getDownloads().downloads[0]?.size_done).toBe(25);
    expect(invalidateQueries).not.toHaveBeenCalledWith({ queryKey: ["downloads"] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["search-results"] });
  });

  it("refreshes snapshots after reconnect and probes the session on stream errors", () => {
    const { invalidateQueries, onStreamError, stream, unsubscribe } = setup();

    stream.onopen?.();
    expect(invalidateQueries).not.toHaveBeenCalled();
    stream.onopen?.();
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["status"] });
    stream.onerror?.();
    expect(onStreamError).toHaveBeenCalledOnce();
    unsubscribe();
    expect(stream.close).toHaveBeenCalledOnce();
  });
});
