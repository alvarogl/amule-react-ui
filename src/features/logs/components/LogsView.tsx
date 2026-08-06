import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eraser, ScrollText } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/shared/api/amule-api";
import { queryKeys } from "@/shared/api/query-keys";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { QueryNotice } from "@/shared/components/QueryNotice";
import { getErrorMessage } from "@/shared/lib/errors";
import { formatLogLine } from "@/shared/lib/log-lines";

type LogKind = "amule" | "serverinfo";
const tailOptions = [50, 100, 250, 500] as const;
const maxTail = tailOptions[tailOptions.length - 1];

export function LogsView() {
  const [kind, setKind] = useState<LogKind>("amule");
  const [tail, setTail] = useState<(typeof tailOptions)[number]>(100);
  const client = useQueryClient();
  const amule = useQuery({
    queryKey: queryKeys.amuleLog(tail),
    queryFn: () => api.amuleLog(tail),
    enabled: kind === "amule",
  });
  const serverInfo = useQuery({
    queryKey: queryKeys.serverInfoLog(tail),
    queryFn: () => api.serverInfoLog(tail),
    enabled: kind === "serverinfo",
  });
  const clear = useMutation({
    mutationFn: (target: LogKind) =>
      target === "amule" ? api.clearAmuleLog() : api.clearServerInfoLog(),
    onSuccess: (_, target) => {
      toast.success(target === "amule" ? "aMule log cleared." : "Server-info log cleared.");
      void client.invalidateQueries({
        queryKey: target === "amule" ? queryKeys.amuleLogs : queryKeys.serverInfoLogs,
      });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  const active = kind === "amule" ? amule : serverInfo;
  const lines = (kind === "amule" ? amule.data?.lines : serverInfo.data?.text.split("\n"))
    ?.filter(Boolean)
    .slice(-maxTail);
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
            <label className="log-tail">
              Tail
              <select
                value={tail}
                onChange={(event) => setTail(Number(event.target.value) as typeof tail)}
              >
                {tailOptions.map((option) => (
                  <option key={option} value={option}>
                    {option} lines
                  </option>
                ))}
              </select>
            </label>
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
        ) : lines?.length ? (
          <ol className="log-output" aria-live="polite">
            {lines.map((line, index) => {
              const formatted = formatLogLine(line);
              return (
                <li className={`log-line log-line--${formatted.tone}`} key={`${line}-${index}`}>
                  <span className="log-line-number">{index + 1}</span>
                  {formatted.timestamp && <time>{formatted.timestamp}</time>}
                  <span>{formatted.message}</span>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="empty">No entries in this log buffer.</p>
        )}
      </section>
    </div>
  );
}
