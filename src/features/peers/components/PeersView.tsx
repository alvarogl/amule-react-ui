import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Download, Info, UsersRound, X } from "lucide-react";
import { toast } from "sonner";
import { api, type Client } from "@/shared/api/amule-api";
import { queryKeys } from "@/shared/api/query-keys";
import { QueryNotice } from "@/shared/components/QueryNotice";
import { SortableHeader } from "@/shared/components/SortableHeader";
import { useSortState } from "@/shared/hooks/use-sort-state";
import { getErrorMessage } from "@/shared/lib/errors";
import { formatMebibytes, formatRate } from "@/shared/lib/formatters";

type PeerFilter = "all" | "active" | "uploads" | "downloads";
type PeerSort = "name" | "software" | "upload" | "download" | "state";

function PeerBrowse({ peer }: { peer: Client }) {
  const [searchId, setSearchId] = useState<number>();
  const browse = useMutation({
    mutationFn: () => api.browseClientSharedFiles(peer.client_ecid),
    onSuccess: ({ search_id }) => setSearchId(search_id),
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  const results = useQuery({
    queryKey: queryKeys.searchResults(searchId),
    queryFn: () => api.searchResults(searchId!),
    enabled: Boolean(searchId),
    refetchInterval: (query) => (query.state.data?.progress.state === "running" ? 2_000 : false),
  });
  const add = useMutation({
    mutationFn: (hash: string) => api.downloadSearchResult(hash),
    onSuccess: () => toast.success("Peer file added to downloads."),
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  if (!searchId)
    return (
      <div className="peer-browse-start">
        <p>Request this peer’s shared files. The peer may take a moment to respond.</p>
        <button
          disabled={browse.isPending || peer.view_shared_disabled}
          onClick={() => browse.mutate()}
        >
          Browse shared files
        </button>
        {peer.view_shared_disabled && <span>This peer does not allow shared-file browsing.</span>}
      </div>
    );
  if (results.isPending || results.isError)
    return (
      <QueryNotice
        loading={results.isPending}
        error={results.error}
        onRetry={() => void results.refetch()}
      />
    );
  const data = results.data;
  return (
    <div className="peer-browse-results">
      <p className="subtle">
        Browse {data?.progress.state ?? "starting"} · {data?.results.length ?? 0} files found
      </p>
      {data?.results.length ? (
        <div className="table-wrap peer-browse-table">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Size</th>
                <th>Sources</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {data.results.map((file) => (
                <tr key={file.hash}>
                  <td className="filename-cell" title={file.name}>
                    {file.name}
                  </td>
                  <td>{formatMebibytes(file.size)}</td>
                  <td>{file.sources.total}</td>
                  <td>
                    <button
                      className="icon"
                      disabled={file.already_have || add.isPending}
                      title={file.already_have ? "Already in downloads" : "Download file"}
                      onClick={() => add.mutate(file.hash)}
                    >
                      <Download size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : data?.progress.state === "running" ? (
        <p className="empty">Waiting for files from this peer…</p>
      ) : (
        <p className="empty">This peer did not return any shared files.</p>
      )}
    </div>
  );
}

function PeerDetails({ peer }: { peer: Client }) {
  const [open, setOpen] = useState(false);
  const detail = useQuery({
    queryKey: queryKeys.client(peer.client_ecid),
    queryFn: () => api.client(peer.client_ecid),
    enabled: open,
  });
  const data = detail.data;
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          className="icon"
          title="Peer details"
          aria-label={`Details for ${peer.client_name}`}
        >
          <Info size={15} />
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="drawer-overlay" />
        <Dialog.Content className="drawer peer-details">
          <Dialog.Title>{peer.client_name || "Anonymous peer"}</Dialog.Title>
          <Dialog.Close className="icon drawer-close" aria-label="Close">
            <X size={16} />
          </Dialog.Close>
          {detail.isPending || detail.isError ? (
            <QueryNotice
              loading={detail.isPending}
              error={detail.error}
              onRetry={() => void detail.refetch()}
            />
          ) : data ? (
            <>
              <dl className="peer-detail-grid">
                <dt>Address</dt>
                <dd>
                  {data.ip}
                  {data.port ? `:${data.port}` : ""}
                </dd>
                <dt>Client</dt>
                <dd>
                  {data.software} {data.software_version}
                  {data.mod_version ? ` (${data.mod_version})` : ""}
                </dd>
                <dt>OS</dt>
                <dd>{data.os_info || "Unknown"}</dd>
                <dt>Identification</dt>
                <dd>
                  {data.ident_state ?? "Unknown"} · {data.high_id ? "HighID" : "LowID / unknown"}
                </dd>
                <dt>Connection</dt>
                <dd>
                  {data.source_origin ?? "Unknown"}
                  {data.kad_port ? ` · Kad ${data.kad_port}` : ""}
                </dd>
                <dt>Server</dt>
                <dd>{data.server_name || "Unknown"}</dd>
                <dt>Upload</dt>
                <dd>
                  {formatRate(data.upload_speed_bps)} · {formatMebibytes(data.xfer?.up_session)}
                </dd>
                <dt>Download</dt>
                <dd>
                  {formatRate(data.download_speed_bps)} · {formatMebibytes(data.xfer?.down_session)}
                </dd>
                <dt>Transfer state</dt>
                <dd>
                  Up: {data.upload_state} · Down: {data.download_state ?? "unknown"}
                </dd>
                <dt>File progress</dt>
                <dd>
                  {data.part_progress_percent === undefined
                    ? "—"
                    : `${data.part_progress_percent.toFixed(1)}%`}
                </dd>
              </dl>
              <PeerBrowse peer={data} />
            </>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function PeersView() {
  const [filter, setFilter] = useState<PeerFilter>("active");
  const { sort, direction, toggleSort } = useSortState<PeerSort>("name");
  const peers = useQuery({
    queryKey: queryKeys.clients(filter),
    queryFn: () => api.clients(filter),
    refetchInterval: 5_000,
  });
  const ordered = [...(peers.data?.clients ?? [])].sort((left, right) => {
    const value = (peer: Client) => {
      if (sort === "name") return peer.client_name;
      if (sort === "software") return `${peer.software} ${peer.software_version}`;
      if (sort === "upload") return peer.upload_speed_bps;
      if (sort === "download") return peer.download_speed_bps ?? 0;
      return `${peer.upload_state} ${peer.download_state ?? ""}`;
    };
    const leftValue = value(left);
    const rightValue = value(right);
    const comparison =
      typeof leftValue === "number"
        ? leftValue - (rightValue as number)
        : leftValue.localeCompare(rightValue as string);
    return direction === "asc" ? comparison : -comparison;
  });
  return (
    <div className="content peers-view">
      <h1>Peers</h1>
      <p className="subtle">
        <UsersRound size={16} /> Peers currently known by the aMule daemon.
      </p>
      <section className="panel peers-panel">
        <div className="panel-title">
          <h2>Peer activity</h2>
          <div className="peer-filters">
            {(["active", "all", "uploads", "downloads"] as PeerFilter[]).map((item) => (
              <button
                key={item}
                className={filter === item ? "active" : "muted"}
                aria-pressed={filter === item}
                onClick={() => setFilter(item)}
              >
                {item === "all" ? "All" : item[0].toUpperCase() + item.slice(1)}
              </button>
            ))}
          </div>
        </div>
        {peers.isPending || peers.isError ? (
          <QueryNotice
            loading={peers.isPending}
            error={peers.error}
            onRetry={() => void peers.refetch()}
          />
        ) : ordered.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <SortableHeader
                    label="Peer"
                    column="name"
                    sort={sort}
                    direction={direction}
                    onSort={toggleSort}
                  />
                  <th>Address</th>
                  <SortableHeader
                    label="Client"
                    column="software"
                    sort={sort}
                    direction={direction}
                    onSort={toggleSort}
                  />
                  <SortableHeader
                    label="Upload"
                    column="upload"
                    sort={sort}
                    direction={direction}
                    onSort={toggleSort}
                  />
                  <SortableHeader
                    label="Download"
                    column="download"
                    sort={sort}
                    direction={direction}
                    onSort={toggleSort}
                  />
                  <SortableHeader
                    label="State"
                    column="state"
                    sort={sort}
                    direction={direction}
                    onSort={toggleSort}
                  />
                  <th className="actions-column actions-column--compact">Actions</th>
                </tr>
              </thead>
              <tbody>
                {ordered.map((peer) => (
                  <tr key={peer.client_ecid}>
                    <td>{peer.client_name || "Anonymous"}</td>
                    <td>
                      {peer.ip}
                      {peer.country_code ? ` · ${peer.country_code.toUpperCase()}` : ""}
                    </td>
                    <td>
                      {peer.software} {peer.software_version}
                    </td>
                    <td>{formatRate(peer.upload_speed_bps)}</td>
                    <td>{formatRate(peer.download_speed_bps)}</td>
                    <td>
                      {peer.upload_state}
                      {peer.download_state ? ` / ${peer.download_state}` : ""}
                    </td>
                    <td className="actions-column actions-column--compact">
                      <PeerDetails peer={peer} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty">No peers match this filter.</p>
        )}
      </section>
    </div>
  );
}
