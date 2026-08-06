import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/features/auth/session-context";
import { queryKeys } from "@/shared/api/query-keys";
import { api } from "@/shared/api/amule-api";
import { uiConfig } from "@/shared/config/ui-config";

const snapshots = [
  queryKeys.status,
  queryKeys.downloads,
  queryKeys.servers,
  queryKeys.uploadClients,
  queryKeys.categories,
  queryKeys.sharedFiles,
  queryKeys.searches,
];
export function useLiveUpdates() {
  const queryClient = useQueryClient();
  const { authenticated } = useSession();
  const hasConnected = useRef(false);
  useEffect(() => {
    if (!authenticated) return;
    const stream = new EventSource(uiConfig.eventsUrl, { withCredentials: true });
    const refresh = () =>
      snapshots.forEach((key) => void queryClient.invalidateQueries({ queryKey: key }));
    stream.onopen = () => {
      if (hasConnected.current) refresh();
      hasConnected.current = true;
    };
    [
      "resync",
      "status_changed",
      "download_added",
      "download_updated",
      "download_removed",
      "server_updated",
      "log_appended",
      "search_result_added",
      "search_progress",
      "shared_added",
      "shared_updated",
      "shared_removed",
    ].forEach((type) =>
      stream.addEventListener(type, () => {
        refresh();
        void queryClient.invalidateQueries({ queryKey: ["search-results"] });
      }),
    );
    stream.onerror = () => {
      void api.session().catch(() => undefined);
    };
    return () => {
      stream.close();
      hasConnected.current = false;
    };
  }, [authenticated, queryClient]);
}
