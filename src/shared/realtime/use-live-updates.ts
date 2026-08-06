import { useEffect } from "react";
import { type QueryClient, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/features/auth/session-context";
import { queryKeys } from "@/shared/api/query-keys";
import { api } from "@/shared/api/amule-api";
import { uiConfig } from "@/shared/config/ui-config";

const snapshots = [
  queryKeys.status,
  queryKeys.downloads,
  ["download"],
  ["download-comments"],
  ["download-filenames"],
  ["download-a4af"],
  queryKeys.servers,
  ["clients"],
  queryKeys.uploadClients,
  queryKeys.categories,
  queryKeys.sharedFiles,
  queryKeys.kad,
  queryKeys.amuleLogs,
  queryKeys.serverInfoLogs,
  queryKeys.searches,
];

type EventSourceFactory = new (url: string, init?: EventSourceInit) => EventSource;

export const liveEventTypes = [
  "resync",
  "status_changed",
  "download_added",
  "download_updated",
  "download_removed",
  "comments_updated",
  "client_added",
  "client_updated",
  "client_removed",
  "server_added",
  "server_updated",
  "server_removed",
  "log_appended",
  "search_result_added",
  "search_progress",
  "shared_added",
  "shared_updated",
  "shared_removed",
  "kad_state",
] as const;

export function subscribeToLiveUpdates({
  queryClient,
  onStreamError,
  EventSourceClass = EventSource,
}: {
  queryClient: Pick<QueryClient, "invalidateQueries">;
  onStreamError(): void;
  EventSourceClass?: EventSourceFactory;
}) {
  let hasConnected = false;
  const stream = new EventSourceClass(uiConfig.eventsUrl, { withCredentials: true });
  const refresh = () =>
    snapshots.forEach((key) => void queryClient.invalidateQueries({ queryKey: key }));
  stream.onopen = () => {
    if (hasConnected) refresh();
    hasConnected = true;
  };
  liveEventTypes.forEach((type) =>
    stream.addEventListener(type, () => {
      refresh();
      void queryClient.invalidateQueries({ queryKey: ["search-results"] });
    }),
  );
  stream.onerror = () => onStreamError();
  return () => stream.close();
}

export function useLiveUpdates() {
  const queryClient = useQueryClient();
  const { authenticated } = useSession();
  useEffect(() => {
    if (!authenticated) return;
    return subscribeToLiveUpdates({
      queryClient,
      onStreamError: () => void api.session().catch(() => undefined),
    });
  }, [authenticated, queryClient]);
}
