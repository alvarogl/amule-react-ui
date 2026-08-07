import { useEffect } from "react";
import { type QueryClient, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/features/auth/session-context";
import { queryKeys } from "@/shared/api/query-keys";
import { api, clientSchema, downloadSchema, statusSchema } from "@/shared/api/amule-api";
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
  queryClient: Pick<QueryClient, "invalidateQueries" | "setQueryData">;
  onStreamError(): void;
  EventSourceClass?: EventSourceFactory;
}) {
  let hasConnected = false;
  const stream = new EventSourceClass(uiConfig.eventsUrl, { withCredentials: true });
  const refresh = () =>
    snapshots.forEach((key) => void queryClient.invalidateQueries({ queryKey: key }));
  const updateDownload = (event: Event) => {
    try {
      const download = downloadSchema.parse(JSON.parse((event as MessageEvent<string>).data));
      queryClient.setQueryData<Awaited<ReturnType<typeof api.downloads>>>(
        queryKeys.downloads,
        (current) => {
          if (!current) return current;
          const existing = current.downloads.findIndex((item) => item.hash === download.hash);
          const downloads =
            existing === -1
              ? [download, ...current.downloads]
              : current.downloads.map((item) => (item.hash === download.hash ? download : item));
          return { ...current, downloads };
        },
      );
      queryClient.setQueryData<Awaited<ReturnType<typeof api.downloadDetail>>>(
        queryKeys.download(download.hash),
        download,
      );
    } catch {
      void queryClient.invalidateQueries({ queryKey: queryKeys.downloads });
    }
  };
  const removeDownload = (event: Event) => {
    try {
      const { hash } = JSON.parse((event as MessageEvent<string>).data) as { hash?: unknown };
      if (typeof hash !== "string") throw new Error("download removal is missing its hash");
      queryClient.setQueryData<Awaited<ReturnType<typeof api.downloads>>>(
        queryKeys.downloads,
        (current) =>
          current
            ? {
                ...current,
                downloads: current.downloads.filter((download) => download.hash !== hash),
              }
            : current,
      );
    } catch {
      void queryClient.invalidateQueries({ queryKey: queryKeys.downloads });
    }
  };
  const updateStatus = (event: Event) => {
    try {
      queryClient.setQueryData<Awaited<ReturnType<typeof api.status>>>(
        queryKeys.status,
        statusSchema.parse(JSON.parse((event as MessageEvent<string>).data)),
      );
    } catch {
      void queryClient.invalidateQueries({ queryKey: queryKeys.status });
    }
  };
  const updateUploadClient = (event: Event) => {
    try {
      const client = clientSchema.parse(JSON.parse((event as MessageEvent<string>).data));
      queryClient.setQueryData<Awaited<ReturnType<typeof api.uploadClients>>>(
        queryKeys.uploadClients,
        (current) => {
          if (!current) return current;
          const existing = current.clients.findIndex(
            (item) => item.client_ecid === client.client_ecid,
          );
          if (client.upload_state !== "uploading") {
            return existing === -1
              ? current
              : {
                  ...current,
                  clients: current.clients.filter(
                    (item) => item.client_ecid !== client.client_ecid,
                  ),
                };
          }
          const clients =
            existing === -1
              ? [client, ...current.clients]
              : current.clients.map((item) =>
                  item.client_ecid === client.client_ecid ? client : item,
                );
          return { ...current, clients };
        },
      );
    } catch {
      void queryClient.invalidateQueries({ queryKey: queryKeys.uploadClients });
    }
  };
  const removeUploadClient = (event: Event) => {
    try {
      const { client_ecid } = JSON.parse((event as MessageEvent<string>).data) as {
        client_ecid?: unknown;
      };
      if (typeof client_ecid !== "number") throw new Error("client removal is missing its ECID");
      queryClient.setQueryData<Awaited<ReturnType<typeof api.uploadClients>>>(
        queryKeys.uploadClients,
        (current) =>
          current
            ? {
                ...current,
                clients: current.clients.filter((client) => client.client_ecid !== client_ecid),
              }
            : current,
      );
    } catch {
      void queryClient.invalidateQueries({ queryKey: queryKeys.uploadClients });
    }
  };
  stream.onopen = () => {
    if (hasConnected) refresh();
    hasConnected = true;
  };
  liveEventTypes.forEach((type) =>
    stream.addEventListener(type, (event) => {
      if (type === "download_added" || type === "download_updated") {
        updateDownload(event);
      } else if (type === "download_removed") {
        removeDownload(event);
      } else if (type === "status_changed") {
        updateStatus(event);
      } else if (type === "client_added" || type === "client_updated") {
        updateUploadClient(event);
        void queryClient.invalidateQueries({ queryKey: queryKeys.clients("active") });
        void queryClient.invalidateQueries({ queryKey: queryKeys.clients("all") });
        void queryClient.invalidateQueries({ queryKey: queryKeys.clients("downloads") });
      } else if (type === "client_removed") {
        removeUploadClient(event);
        void queryClient.invalidateQueries({ queryKey: queryKeys.clients("active") });
        void queryClient.invalidateQueries({ queryKey: queryKeys.clients("all") });
        void queryClient.invalidateQueries({ queryKey: queryKeys.clients("downloads") });
      } else {
        refresh();
      }
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
