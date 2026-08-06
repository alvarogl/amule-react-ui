import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/features/auth/session-context";
import { uiConfig } from "@/shared/config/ui-config";
import { queryKeys } from "@/shared/api/query-keys";

const snapshots = [
  queryKeys.status,
  queryKeys.downloads,
  queryKeys.servers,
  queryKeys.uploadClients,
  queryKeys.categories,
  queryKeys.searches,
];
export function useLiveUpdates() {
  const queryClient = useQueryClient();
  const { authenticated, expire } = useSession();
  useEffect(() => {
    if (!authenticated) return;
    const stream = new EventSource(uiConfig.eventsUrl, { withCredentials: true });
    const refresh = () =>
      snapshots.forEach((key) => void queryClient.invalidateQueries({ queryKey: key }));
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
    ].forEach((type) =>
      stream.addEventListener(type, () => {
        refresh();
        void queryClient.invalidateQueries({ queryKey: ["search-results"] });
      }),
    );
    stream.onerror = () => {
      void fetch(`${uiConfig.apiBase}/auth/session`, { credentials: "include" })
        .then((r) => {
          if (r.status === 401) {
            stream.close();
            expire();
          }
        })
        .catch(() => undefined);
    };
    return () => stream.close();
  }, [authenticated, expire, queryClient]);
}
