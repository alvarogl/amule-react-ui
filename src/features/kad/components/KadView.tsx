import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Network, RefreshCw, Unplug } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/shared/api/amule-api";
import { queryKeys } from "@/shared/api/query-keys";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { QueryNotice } from "@/shared/components/QueryNotice";
import { getErrorMessage } from "@/shared/lib/errors";

function KadMetric({ label, value }: { label: string; value: number | string }) {
  return (
    <section className="metric">
      <span>{label}</span>
      <strong>{typeof value === "number" ? value.toLocaleString() : value}</strong>
    </section>
  );
}

export function KadView() {
  const [ip, setIp] = useState("");
  const [port, setPort] = useState("4672");
  const [nodesUrl, setNodesUrl] = useState("");
  const client = useQueryClient();
  const kad = useQuery({ queryKey: queryKeys.kad, queryFn: api.kad, refetchInterval: 5_000 });
  const refresh = () => void client.invalidateQueries({ queryKey: queryKeys.kad });
  const network = useMutation({
    mutationFn: (action: "connect" | "disconnect") => api.network(action, "kad"),
    onSuccess: (_, action) => {
      toast.success(action === "connect" ? "Kad connection requested." : "Kad disconnected.");
      refresh();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  const bootstrap = useMutation({
    mutationFn: () => api.bootstrapKad(ip.trim(), Number(port)),
    onSuccess: () => {
      setIp("");
      toast.success("Kad bootstrap request accepted.");
      refresh();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  const update = useMutation({
    mutationFn: () => api.updateKadNodes(nodesUrl.trim()),
    onSuccess: () => {
      toast.success("Kad node-list update accepted. Kad may reconnect briefly.");
      refresh();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  function submitBootstrap(event: FormEvent) {
    event.preventDefault();
    if (!ip.trim()) return toast.warning("A Kad node IP address is required.");
    if (!Number.isInteger(Number(port)) || Number(port) < 1 || Number(port) > 65535)
      return toast.warning("Use a UDP port from 1 to 65535.");
    bootstrap.mutate();
  }
  const canUpdate = /^https?:\/\//i.test(nodesUrl.trim());
  const state = kad.data?.state ?? "unknown";
  return (
    <div className="content">
      <h1>Kad network</h1>
      {kad.isPending || kad.isError ? (
        <QueryNotice loading={kad.isPending} error={kad.error} onRetry={() => void kad.refetch()} />
      ) : kad.data ? (
        <>
          <div className="kad-status">
            <Network size={18} />
            <strong>{state}</strong>
            <span className={kad.data.firewalled ? "kad-warning" : "live"}>
              {kad.data.firewalled ? "Firewalled" : "Reachable"}
            </span>
            <span>{kad.data.ip || "External IP unknown"}</span>
            <button
              className="muted"
              disabled={network.isPending || state === "connected"}
              onClick={() => network.mutate("connect")}
            >
              <Network size={15} /> Connect Kad
            </button>
            <button
              className="muted"
              disabled={network.isPending || state !== "connected"}
              onClick={() => network.mutate("disconnect")}
            >
              <Unplug size={15} /> Disconnect
            </button>
          </div>
          <div className="metrics kad-metrics">
            <KadMetric label="Nodes" value={kad.data.network.nodes} />
            <KadMetric label="Users" value={kad.data.network.users} />
            <KadMetric label="Files" value={kad.data.network.files} />
            <KadMetric label="Indexed sources" value={kad.data.indexed.sources} />
          </div>
          <section className="panel kad-panel">
            <div className="panel-title">
              <h2>Kad store</h2>
              <span>Load {kad.data.indexed.load}%</span>
            </div>
            <div className="kad-store">
              <span>Keywords: {kad.data.indexed.keywords.toLocaleString()}</span>
              <span>Notes: {kad.data.indexed.notes.toLocaleString()}</span>
              <span>
                UDP: {kad.data.firewalled_udp ? "firewalled" : "reachable"} · LAN mode:{" "}
                {kad.data.in_lan_mode ? "on" : "off"}
              </span>
              {kad.data.buddy && (
                <span>
                  Buddy: {kad.data.buddy.status} ({kad.data.buddy.ip}:{kad.data.buddy.port})
                </span>
              )}
            </div>
          </section>
        </>
      ) : null}
      <section className="panel kad-panel">
        <div className="panel-title">
          <h2>Bootstrap</h2>
          <span>Known Kad contact</span>
        </div>
        <form className="kad-form" onSubmit={submitBootstrap}>
          <input
            placeholder="IP address"
            value={ip}
            onChange={(event) => setIp(event.target.value)}
          />
          <input
            type="number"
            min="1"
            max="65535"
            placeholder="UDP port"
            value={port}
            onChange={(event) => setPort(event.target.value)}
          />
          <button disabled={bootstrap.isPending}>Bootstrap</button>
        </form>
      </section>
      <section className="panel kad-panel">
        <div className="panel-title">
          <h2>Update node list</h2>
          <span>Replaces nodes.dat and briefly reconnects Kad</span>
        </div>
        <div className="kad-form">
          <input
            type="url"
            placeholder="https://example.net/nodes.dat"
            value={nodesUrl}
            onChange={(event) => setNodesUrl(event.target.value)}
          />
          <ConfirmDialog
            trigger={
              <button disabled={!canUpdate || update.isPending}>
                <RefreshCw size={15} /> Update nodes
              </button>
            }
            title="Update the Kad node list?"
            description="aMule will download and replace nodes.dat, then briefly stop and restart Kad. The supplied URL becomes the configured update source."
            actionLabel="Update node list"
            onConfirm={() => update.mutate()}
          />
        </div>
      </section>
    </div>
  );
}
