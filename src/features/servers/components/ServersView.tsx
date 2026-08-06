import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, Pin, Trash2, Unplug } from "lucide-react";
import { api } from "@/shared/api/amule-api";
import { toast } from "sonner";
import { SortableHeader } from "@/shared/components/SortableHeader";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { queryKeys } from "@/shared/api/query-keys";
import { useSortState } from "@/shared/hooks/use-sort-state";
import { getErrorMessage } from "@/shared/lib/errors";

type ServerRow = Awaited<ReturnType<typeof api.servers>>["servers"][number];

export function ServersView({ connectedServerName }: { connectedServerName?: string }) {
  const [address, setAddress] = useState("");
  const [name, setName] = useState("");
  const [serversUrl, setServersUrl] = useState("");
  const { sort, direction, toggleSort } = useSortState<"name" | "address" | "users" | "priority">(
    "name",
  );
  const client = useQueryClient();
  const servers = useQuery({
    queryKey: queryKeys.servers,
    queryFn: api.servers,
    refetchInterval: 20_000,
  });
  const refresh = () => void client.invalidateQueries({ queryKey: queryKeys.servers });
  const add = useMutation({
    mutationFn: () => api.addServer(address, name),
    onSuccess: () => {
      setAddress("");
      setName("");
      toast.success("Server added.");
      refresh();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  const action = useMutation({
    mutationFn: ({ type, id }: { type: "connect" | "remove"; id: number }) =>
      type === "connect" ? api.connectServer(id) : api.removeServer(id),
    onSuccess: (_, variables) => {
      toast.success(
        variables.type === "connect" ? "Server connection requested." : "Server removed.",
      );
      refresh();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  const network = useMutation({
    mutationFn: ({
      action,
      target,
    }: {
      action: "connect" | "disconnect";
      target: "ed2k" | "kad" | "both";
    }) => api.network(action, target),
    onSuccess: (_, variables) => {
      toast.success(
        `${variables.target === "both" ? "All networks" : variables.target === "kad" ? "Kad" : "eD2k"} ${variables.action === "connect" ? "connect requested" : "disconnected"}.`,
      );
      void client.invalidateQueries({ queryKey: queryKeys.status });
      refresh();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  const patch = useMutation({
    mutationFn: ({
      id,
      changes,
    }: {
      id: number;
      changes: { priority?: "low" | "normal" | "high"; static?: boolean };
    }) => api.patchServer(id, changes),
    onSuccess: (_, variables) => {
      toast.success(
        variables.changes.priority
          ? `Server priority set to ${variables.changes.priority}.`
          : `Server marked ${variables.changes.static ? "static" : "temporary"}.`,
      );
      refresh();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  const update = useMutation({
    mutationFn: () => api.updateServers(serversUrl),
    onSuccess: () => {
      setServersUrl("");
      toast.success("Server-list refresh requested.");
      refresh();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!address.includes(":")) return toast.warning("Use a server address in host:port form.");
    add.mutate();
  }
  function refreshFromUrl(event: FormEvent) {
    event.preventDefault();
    if (!/^https?:\/\//i.test(serversUrl)) return toast.warning("Use an HTTP(S) server-list URL.");
    update.mutate();
  }
  const serverRows = [...(servers.data?.servers ?? [])].sort((left, right) => {
    const priority = { low: 1, normal: 2, high: 3 } as Record<string, number>;
    const value = (server: ServerRow) =>
      sort === "users"
        ? server.users
        : sort === "priority"
          ? (priority[server.priority] ?? 0)
          : server[sort];
    const leftValue = value(left);
    const rightValue = value(right);
    const comparison =
      typeof leftValue === "number"
        ? leftValue - (rightValue as number)
        : String(leftValue).localeCompare(String(rightValue));
    return direction === "asc" ? comparison : -comparison;
  });
  return (
    <div className="content">
      <h1>Servers & network</h1>
      <div className="network-controls">
        <button onClick={() => network.mutate({ action: "connect", target: "both" })}>
          Connect all
        </button>
        <button
          className="muted"
          onClick={() => network.mutate({ action: "disconnect", target: "both" })}
        >
          Disconnect all
        </button>
        <button
          className="muted"
          onClick={() => network.mutate({ action: "connect", target: "kad" })}
        >
          Start Kad
        </button>
      </div>
      <form className="server-form" onSubmit={submit}>
        <input placeholder="IP:port" value={address} onChange={(e) => setAddress(e.target.value)} />
        <input
          placeholder="Optional server name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button disabled={add.isPending}>Add server</button>
      </form>
      <form className="server-form" onSubmit={refreshFromUrl}>
        <input
          className="server-list-url"
          type="url"
          placeholder="https://example.net/server.met"
          value={serversUrl}
          onChange={(e) => setServersUrl(e.target.value)}
        />
        <button disabled={update.isPending || !serversUrl.trim()}>Refresh server list</button>
      </form>
      <section className="panel">
        <div className="panel-title">
          <h2>Known servers</h2>
          <span>{servers.data?.servers.length ?? 0}</span>
        </div>
        {servers.data?.servers.length ? (
          <div className="table-wrap">
            <table className="data-table server-table">
              <colgroup>
                <col style={{ width: 250 }} />
                <col style={{ width: 210 }} />
                <col style={{ width: 120 }} />
                <col style={{ width: 130 }} />
                <col className="actions-column" />
              </colgroup>
              <thead>
                <tr>
                  <SortableHeader
                    column="name"
                    label="Name"
                    sort={sort}
                    direction={direction}
                    onSort={toggleSort}
                  />
                  <SortableHeader
                    column="address"
                    label="Address"
                    sort={sort}
                    direction={direction}
                    onSort={toggleSort}
                  />
                  <SortableHeader
                    column="users"
                    label="Users"
                    sort={sort}
                    direction={direction}
                    onSort={toggleSort}
                  />
                  <SortableHeader
                    column="priority"
                    label="Priority"
                    sort={sort}
                    direction={direction}
                    onSort={toggleSort}
                  />
                  <th className="actions-column" />
                </tr>
              </thead>
              <tbody>
                {serverRows.map((server) => {
                  const connected = Boolean(
                    connectedServerName && server.name === connectedServerName,
                  );
                  return (
                    <tr className={connected ? "connected-server" : ""} key={server.ecid}>
                      <td>
                        {server.name}
                        {connected && <span className="connected-mark">Connected</span>}
                      </td>
                      <td>{server.address}</td>
                      <td>{server.users.toLocaleString()}</td>
                      <td>
                        <select
                          className="server-select"
                          aria-label={`Priority for ${server.name}`}
                          value={server.priority}
                          disabled={patch.isPending}
                          onChange={(e) =>
                            patch.mutate({
                              id: server.ecid,
                              changes: {
                                priority: e.target.value as "low" | "normal" | "high",
                              },
                            })
                          }
                        >
                          <option value="low">Low</option>
                          <option value="normal">Normal</option>
                          <option value="high">High</option>
                        </select>
                      </td>
                      <td className="actions-column">
                        {connected ? (
                          <button
                            className="icon active-action"
                            aria-label="Disconnect server"
                            title="Disconnect eD2k"
                            onClick={() =>
                              network.mutate({
                                action: "disconnect",
                                target: "ed2k",
                              })
                            }
                          >
                            <Unplug size={15} />
                          </button>
                        ) : (
                          <button
                            className="icon"
                            aria-label="Connect server"
                            title="Connect server"
                            onClick={() =>
                              action.mutate({
                                type: "connect",
                                id: server.ecid,
                              })
                            }
                          >
                            <Link size={15} />
                          </button>
                        )}
                        <button
                          className={server.static ? "icon active-action" : "icon"}
                          aria-label={
                            server.static ? "Mark server temporary" : "Mark server static"
                          }
                          title={server.static ? "Mark temporary" : "Mark static"}
                          disabled={patch.isPending}
                          onClick={() =>
                            patch.mutate({
                              id: server.ecid,
                              changes: { static: !server.static },
                            })
                          }
                        >
                          <Pin size={15} />
                        </button>
                        <ConfirmDialog
                          trigger={
                            <button
                              className="icon danger"
                              aria-label="Remove server"
                              title="Remove server"
                            >
                              <Trash2 size={15} />
                            </button>
                          }
                          title="Remove server?"
                          description={`Remove “${server.name}” from the known server list?`}
                          actionLabel="Remove server"
                          dangerous
                          onConfirm={() => action.mutate({ type: "remove", id: server.ecid })}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty">No known servers.</p>
        )}
      </section>
    </div>
  );
}
