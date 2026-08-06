import { describe, expect, it, vi } from "vitest";
import { liveEventTypes, subscribeToLiveUpdates } from "./use-live-updates";

class FakeEventSource {
  static current: FakeEventSource | undefined;
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  close = vi.fn();
  private listeners = new Map<string, () => void>();

  constructor(
    readonly url: string,
    readonly options?: EventSourceInit,
  ) {
    FakeEventSource.current = this;
  }

  addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
    this.listeners.set(type, listener as () => void);
  }

  emit(type: string) {
    this.listeners.get(type)?.();
  }
}

function setup() {
  const invalidateQueries = vi.fn();
  const onStreamError = vi.fn();
  const unsubscribe = subscribeToLiveUpdates({
    queryClient: { invalidateQueries },
    onStreamError,
    EventSourceClass: FakeEventSource as never,
  });
  return { invalidateQueries, onStreamError, stream: FakeEventSource.current!, unsubscribe };
}

describe("live update subscription", () => {
  it("refreshes snapshots for every documented live event", () => {
    const { invalidateQueries, stream } = setup();

    stream.emit("download_updated");

    expect(liveEventTypes).toContain("download_updated");
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["downloads"] });
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
