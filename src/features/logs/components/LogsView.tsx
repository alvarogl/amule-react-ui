import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eraser, ScrollText } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/shared/api/amule-api";
import { queryKeys } from "@/shared/api/query-keys";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { QueryNotice } from "@/shared/components/QueryNotice";
import { getErrorMessage } from "@/shared/lib/errors";

type LogKind = "amule" | "serverinfo";

export function LogsView() {
  const [kind, setKind] = useState<LogKind>("amule");
  const client = useQueryClient();
  const amule = useQuery({ queryKey: queryKeys.amuleLog, queryFn: () => api.amuleLog() });
  const serverInfo = useQuery({
    queryKey: queryKeys.serverInfoLog,
    queryFn: () => api.serverInfoLog(),
  });
  const clear = useMutation({
    mutationFn: (target: LogKind) =>
      target === "amule" ? api.clearAmuleLog() : api.clearServerInfoLog(),
    onSuccess: (_, target) => {
      toast.success(target === "amule" ? "aMule log cleared." : "Server-info log cleared.");
      void client.invalidateQueries({
        queryKey: target === "amule" ? queryKeys.amuleLog : queryKeys.serverInfoLog,
      });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  const active = kind === "amule" ? amule : serverInfo;
  const text = kind === "amule" ? amule.data?.lines.join("\n") : serverInfo.data?.text;
  const count = kind === "amule" ? amule.data?.total_cached : serverInfo.data?.returned_bytes;
  return (
    <div className="content">
      <h1>Logs</h1>
      <p className="subtle">
        <ScrollText size={16} /> Live daemon output refreshed from the event stream.
      </p>
      <section className="panel logs-panel">
        <div className="panel-title">
          <div className="log-tabs" role="tablist" aria-label="Log buffer">
            <button
              role="tab"
              aria-selected={kind === "amule"}
              className={kind === "amule" ? "active" : ""}
              onClick={() => setKind("amule")}
            >
              aMule log
            </button>
            <button
              role="tab"
              aria-selected={kind === "serverinfo"}
              className={kind === "serverinfo" ? "active" : ""}
              onClick={() => setKind("serverinfo")}
            >
              Server info
            </button>
          </div>
          <div className="log-actions">
            <span>
              {count?.toLocaleString() ?? 0} {kind === "amule" ? "cached lines" : "bytes"}
            </span>
            <ConfirmDialog
              trigger={
                <button className="icon danger" aria-label="Clear active log" title="Clear log">
                  <Eraser size={15} />
                </button>
              }
              title={`Clear ${kind === "amule" ? "aMule" : "server-info"} log?`}
              description="This clears the in-memory daemon log buffer. It does not remove system journal entries."
              actionLabel="Clear log"
              dangerous
              onConfirm={() => clear.mutate(kind)}
            />
          </div>
        </div>
        {active.isPending || active.isError ? (
          <QueryNotice
            loading={active.isPending}
            error={active.error}
            onRetry={() => void active.refetch()}
          />
        ) : text ? (
          <pre className="log-output" aria-live="polite">
            {text}
          </pre>
        ) : (
          <p className="empty">No entries in this log buffer.</p>
        )}
      </section>
    </div>
  );
}
