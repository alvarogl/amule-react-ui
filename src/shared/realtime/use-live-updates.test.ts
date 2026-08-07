import { describe, expect, it, vi } from "vitest";
import type { Client, Download, Status } from "@/shared/api/amule-api";
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
    expect(setQueryData).toHaveBeenCalledWith(["download", "download-1"], expect.anything());
    expect(getDownloads().downloads[0]?.size_done).toBe(25);
    expect(invalidateQueries).not.toHaveBeenCalledWith({ queryKey: ["downloads"] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["search-results"] });
  });

  it("applies dashboard status, queue, and upload payloads immediately", () => {
    const { invalidateQueries, setQueryData, stream } = setup();
    const status = {
      ec_connected: true,
      ed2k: { state: "connected", low_id: false, server_name: "Example server" },
      kad: { state: "connected", firewalled: false },
      speeds: { download_bps: 25, upload_bps: 10 },
      queue: { upload_queue_length: 4, total_source_count: 12 },
    } satisfies Status;
    const client = {
      client_ecid: 7,
      client_name: "Peer",
      ip: "192.0.2.1",
      software: "emule",
      software_version: "0.50a",
      upload_state: "uploading",
      upload_file_name: "example.iso",
      upload_speed_bps: 10,
    } satisfies Client;

    stream.emit("status_changed", status);
    stream.emit("client_updated", client);

    expect(setQueryData).toHaveBeenCalledWith(["status"], status);
    expect(setQueryData).toHaveBeenCalledWith(["clients", "uploads"], expect.any(Function));
    expect(invalidateQueries).not.toHaveBeenCalledWith({ queryKey: ["status"] });
    expect(invalidateQueries).not.toHaveBeenCalledWith({ queryKey: ["clients", "uploads"] });
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
