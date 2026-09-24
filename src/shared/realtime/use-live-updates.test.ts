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
        size_bytes: 100,
        completed_bytes: 10,
        transferred_bytes: 10,
        speed_bytes_per_second: 1,
        category_index: 0,
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
      size_bytes: 100,
      completed_bytes: 25,
      transferred_bytes: 25,
      speed_bytes_per_second: 1,
      category_index: 0,
      progress: { percent: 25 },
    } satisfies Download);

    expect(liveEventTypes).toContain("download_updated");
    expect(setQueryData).toHaveBeenCalledWith(["downloads"], expect.any(Function));
    expect(setQueryData).toHaveBeenCalledWith(["download", "download-1"], expect.anything());
    expect(getDownloads().downloads[0]?.completed_bytes).toBe(25);
    expect(invalidateQueries).not.toHaveBeenCalledWith({ queryKey: ["downloads"] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["search-results"] });
  });

  it("applies dashboard status, queue, and upload payloads immediately", () => {
    const { invalidateQueries, setQueryData, stream } = setup();
    const status = {
      ec_connected: true,
      ed2k: {
        state: "connected",
        high_id: true,
        user_id: 1,
        public_ip: "192.0.2.1",
        connected_since_at: 1,
        server_name: "Example server",
        server_ip: "192.0.2.2",
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
        download_speed_bytes_per_second: 25,
        upload_speed_bytes_per_second: 10,
        download_overhead_bytes_per_second: 0,
        upload_overhead_bytes_per_second: 0,
      },
      disk: { temp_free_bytes: 1, incoming_free_bytes: 1 },
      queue: { waiting_upload_client_count: 4, download_source_count: 12 },
    } satisfies Status;
    const client = {
      ecid: 7,
      name: "Peer",
      ip: "192.0.2.1",
      software: "emule",
      software_version: "0.50a",
      upload_state: "uploading",
      upload_file_name: "example.iso",
      upload_speed_bytes_per_second: 10,
      download_file_name: null,
      download_speed_bytes_per_second: 0,
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
