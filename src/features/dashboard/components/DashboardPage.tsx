import { lazy, Suspense, useEffect, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChartNoAxesCombined,
  Check,
  FolderTree,
  LayoutDashboard,
  LogOut,
  MoreHorizontal,
  Network,
  Pause,
  Play,
  RefreshCw,
  Search,
  ScrollText,
  Server,
  Settings,
  Share2,
  ShieldCheck,
  Trash2,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";
import amuleLogo from "@/assets/amule-logo.png";
import { api, type Download } from "@/shared/api/amule-api";
import { queryKeys } from "@/shared/api/query-keys";
import { useSession } from "@/features/auth/session-context";
import { useLiveUpdates } from "@/shared/realtime/use-live-updates";
import { SearchView } from "@/features/search/components/SearchView";
import { ServersView } from "@/features/servers/components/ServersView";
import { CategoriesView } from "@/features/categories/components/CategoriesView";
import { TransferDetails } from "@/features/transfers/components/TransferDetails";
import { SortableHeader } from "@/shared/components/SortableHeader";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { formatMebibytes, formatRate } from "@/shared/lib/formatters";
import { useSortState } from "@/shared/hooks/use-sort-state";
import { getErrorMessage } from "@/shared/lib/errors";
import { SharedFilesView } from "@/features/shared/components/SharedFilesView";
import { KadView } from "@/features/kad/components/KadView";
import { LogsView } from "@/features/logs/components/LogsView";
import { PreferencesView } from "@/features/preferences/components/PreferencesView";
import { PeersView } from "@/features/peers/components/PeersView";

const StatisticsView = lazy(() =>
  import("@/features/statistics/components/StatisticsView").then(({ StatisticsView }) => ({
    default: StatisticsView,
  })),
);

type UploadPeer = Awaited<ReturnType<typeof api.uploadClients>>["clients"][number];

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <section className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </section>
  );
}
function UpdateStatus() {
  const client = useQueryClient();
  const lastCheckedBeforeRequest = useRef<number | null>(null);
  const [waitingForResult, setWaitingForResult] = useState(false);
  const version = useQuery({
    queryKey: queryKeys.version,
    queryFn: api.version,
    retry: false,
    refetchInterval: waitingForResult ? 3_000 : false,
  });
  useEffect(() => {
    const lastChecked = version.data?.update.last_checked;
    if (
      waitingForResult &&
      lastChecked !== null &&
      lastChecked !== undefined &&
      lastChecked !== lastCheckedBeforeRequest.current
    ) {
      setWaitingForResult(false);
      toast.success("Version check completed.");
    }
  }, [version.data?.update.last_checked, waitingForResult]);
  const check = useMutation({
    mutationFn: api.checkVersion,
    onSuccess: () => {
      lastCheckedBeforeRequest.current = version.data?.update.last_checked ?? null;
      setWaitingForResult(true);
      void client.invalidateQueries({ queryKey: queryKeys.version });
    },
    onError: (error) => {
      setWaitingForResult(false);
      toast.error(getErrorMessage(error));
    },
  });
  if (!version.data?.update.check_enabled) return null;
  const update = version.data.update;
  const state = update.update_available
    ? `Version ${update.latest_version} is available`
    : update.checked
      ? "aMule is up to date"
      : "No version check has completed yet";
  return (
    <section
      className={`update-status ${update.update_available ? "update-status--available" : ""}`}
    >
      <div>
        <strong>{state}</strong>
        <span>Running {version.data.daemon_version || version.data.amule_version}</span>
      </div>
      <button
        className="muted"
        disabled={check.isPending || waitingForResult}
        onClick={() => check.mutate()}
      >
        <RefreshCw size={15} /> Check now
      </button>
    </section>
  );
}
function Transfers({ downloads }: { downloads: Download[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [filter, setFilter] = useState("");
  const { sort, direction, toggleSort } = useSortState<
    "name" | "status" | "speed" | "priority" | "category" | "size"
  >("name");
  const [link, setLink] = useState("");
  const client = useQueryClient();
  const categories = useQuery({
    queryKey: queryKeys.categories,
    queryFn: api.categories,
  });
  const refresh = () => void client.invalidateQueries({ queryKey: queryKeys.downloads });
  const one = useMutation({
    mutationFn: ({ hash, status }: { hash: string; status: "pause" | "resume" }) =>
      api.downloadAction(hash, status),
    onSuccess: (_, variables) => {
      refresh();
      toast.success(`Transfer ${variables.status === "pause" ? "paused" : "resumed"}.`);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  const bulk = useMutation({
    mutationFn: (patch: {
      status?: "paused" | "resumed";
      priority?: "low" | "normal" | "high" | "auto";
    }) => api.bulkDownloads(selected, patch),
    onSuccess: (_, patch) => {
      refresh();
      setSelected([]);
      toast.success(
        patch.priority
          ? `Selected transfers set to ${patch.priority} priority.`
          : `Selected transfers ${patch.status === "paused" ? "paused" : "resumed"}.`,
      );
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  const category = useMutation({
    mutationFn: ({ hash, index }: { hash: string; index: number }) =>
      api.setDownloadCategory(hash, index),
    onSuccess: () => {
      refresh();
      toast.success("Transfer category updated.");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  const add = useMutation({
    mutationFn: (links: string[]) => api.addLinks(links),
    onSuccess: (_, links) => {
      refresh();
      setLink("");
      toast.success(`${links.length} ed2k link${links.length === 1 ? "" : "s"} added.`);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  const clear = useMutation({
    mutationFn: () => api.clearCompleted(),
    onSuccess: (v) => {
      refresh();
      toast.success(
        `Cleared ${v.cleared} completed notification${v.cleared === 1 ? "" : "s"}. Files remain in Incoming.`,
      );
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  const clearOne = useMutation({
    mutationFn: api.clearCompleted,
    onSuccess: () => {
      refresh();
      toast.success("Completed download notification cleared. The Incoming file was kept.");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  const remove = useMutation({
    mutationFn: api.removeDownload,
    onSuccess: (_, hash) => {
      refresh();
      setSelected((current) => current.filter((selectedHash) => selectedHash !== hash));
      toast.success("Download deleted.");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  const removeSelected = useMutation({
    mutationFn: api.removeDownloads,
    onSuccess: (result, hashes) => {
      refresh();
      setSelected([]);
      const deleted = result.results?.filter((item) => item.ok).length ?? hashes.length;
      const failed = hashes.length - deleted;
      toast.success(`${deleted} selected download${deleted === 1 ? "" : "s"} deleted.`);
      if (failed)
        toast.warning(`${failed} selected item${failed === 1 ? " was" : "s were"} not deleted.`);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  const rows = downloads.filter((d) => d.name.toLowerCase().includes(filter.toLowerCase()));
  const orderedRows = [...rows].sort((left, right) => {
    let comparison = 0;
    if (sort === "speed") comparison = (left.speed_bps ?? 0) - (right.speed_bps ?? 0);
    else if (sort === "size") comparison = (left.size ?? 0) - (right.size ?? 0);
    if (sort === "priority") {
      const rank = (item: Download) =>
        item.priority_auto ? 4 : { low: 1, normal: 2, high: 3 }[item.priority ?? "normal"];
      comparison = rank(left) - rank(right);
    }
    if (sort === "category") comparison = (left.category ?? 0) - (right.category ?? 0);
    if (sort === "name" || sort === "status")
      comparison = String(left[sort]).localeCompare(String(right[sort]));
    return direction === "asc" ? comparison : -comparison;
  });
  const toggle = (hash: string) =>
    setSelected((s) => (s.includes(hash) ? s.filter((v) => v !== hash) : [...s, hash]));
  function submit(e: FormEvent) {
    e.preventDefault();
    const links = link.split(/\s+/).filter(Boolean);
    if (!links.length || !links.every((v) => v.startsWith("ed2k://")))
      return toast.warning("Enter one or more valid ed2k:// links.");
    add.mutate(links);
  }
  function transferActions(download: Download) {
    if (download.status === "completed") {
      return (
        <button
          className="icon"
          disabled={clearOne.isPending}
          aria-label={`Clear completed notification for ${download.name}`}
          title="Clear completed notification (keeps Incoming file)"
          onClick={() => clearOne.mutate(download.hash)}
        >
          <Check size={15} />
        </button>
      );
    }
    const nextAction = download.status === "paused" ? "resume" : "pause";
    return (
      <>
        <button
          className="icon"
          aria-label={`${nextAction === "resume" ? "Resume" : "Pause"} ${download.name}`}
          title={nextAction === "resume" ? "Resume download" : "Pause download"}
          onClick={() => one.mutate({ hash: download.hash, status: nextAction })}
        >
          {nextAction === "resume" ? <Play size={15} /> : <Pause size={15} />}
        </button>
        <ConfirmDialog
          trigger={
            <button
              className="icon danger"
              disabled={remove.isPending}
              aria-label={`Delete ${download.name}`}
              title="Delete download"
            >
              <Trash2 size={15} />
            </button>
          }
          title="Delete download?"
          description={`“${download.name}” and its active download data will be permanently removed from disk.`}
          actionLabel="Delete download"
          dangerous
          onConfirm={() => remove.mutate(download.hash)}
        />
      </>
    );
  }
  return (
    <section className="panel">
      <div className="panel-title">
        <h2>Transfers</h2>
        <span>{downloads.length} in queue</span>
      </div>
      <form className="transfer-tools" onSubmit={submit}>
        <input
          placeholder="Paste ed2k:// link(s)"
          value={link}
          onChange={(e) => setLink(e.target.value)}
        />
        <button>Add link</button>
        <input placeholder="Filter" value={filter} onChange={(e) => setFilter(e.target.value)} />
      </form>
      <div className="bulk-tools">
        <span>{selected.length} selected</span>
        <button disabled={!selected.length} onClick={() => bulk.mutate({ status: "paused" })}>
          Pause
        </button>
        <button disabled={!selected.length} onClick={() => bulk.mutate({ status: "resumed" })}>
          Resume
        </button>
        <label className="bulk-priority">
          Priority
          <select
            defaultValue=""
            disabled={!selected.length}
            onChange={(event) => {
              const priority = event.target.value as "low" | "normal" | "high" | "auto";
              if (priority) bulk.mutate({ priority });
              event.currentTarget.value = "";
            }}
          >
            <option value="" disabled hidden>
              Set priority
            </option>
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="auto">Auto</option>
          </select>
        </label>
        <ConfirmDialog
          trigger={<button className="muted">Clear notifications</button>}
          title="Clear completed notifications?"
          description="This removes completed items from this notification list. Their files remain in the Incoming folder."
          actionLabel="Clear notifications"
          onConfirm={() => clear.mutate()}
        />
        <ConfirmDialog
          trigger={
            <button
              className="danger bulk-remove"
              disabled={!selected.length || removeSelected.isPending}
            >
              Remove selected
            </button>
          }
          title={`Delete ${selected.length} selected download${selected.length === 1 ? "" : "s"}?`}
          description="This permanently removes the selected active download data from disk."
          actionLabel="Delete downloads"
          dangerous
          onConfirm={() => removeSelected.mutate(selected)}
        />
      </div>
      <div className="table-wrap">
        <table className="data-table transfer-table">
          <colgroup>
            <col style={{ width: 46 }} />
            <col style={{ width: 330 }} />
            <col style={{ width: 110 }} />
            <col style={{ width: 110 }} />
            <col style={{ width: 140 }} />
            <col style={{ width: 185 }} />
            <col style={{ width: 105 }} />
            <col className="actions-column actions-column--fixed" />
          </colgroup>
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  checked={rows.length > 0 && rows.every((d) => selected.includes(d.hash))}
                  onChange={(e) => setSelected(e.target.checked ? rows.map((d) => d.hash) : [])}
                />
              </th>
              <SortableHeader
                column="name"
                label="Name"
                sort={sort}
                direction={direction}
                onSort={toggleSort}
              />
              <SortableHeader
                column="status"
                label="Status"
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
              <SortableHeader
                column="category"
                label="Category"
                sort={sort}
                direction={direction}
                onSort={toggleSort}
              />
              <SortableHeader
                column="size"
                label="Size / downloaded"
                sort={sort}
                direction={direction}
                onSort={toggleSort}
              />
              <SortableHeader
                column="speed"
                label="Speed"
                sort={sort}
                direction={direction}
                onSort={toggleSort}
              />
              <th className="actions-column actions-column--fixed" />
            </tr>
          </thead>
          <tbody>
            {orderedRows.map((d) => (
              <tr key={d.hash}>
                <td>
                  <input
                    type="checkbox"
                    checked={selected.includes(d.hash)}
                    onChange={() => toggle(d.hash)}
                  />
                </td>
                <td>
                  <TransferDetails hash={d.hash} name={d.name} />
                </td>
                <td>
                  <span className="badge">{d.status}</span>
                </td>
                <td>
                  <span className="badge">
                    {d.priority_auto ? "auto" : (d.priority ?? "normal")}
                  </span>
                </td>
                <td>
                  <select
                    className="category-select"
                    value={d.category ?? 0}
                    onChange={(e) =>
                      category.mutate({
                        hash: d.hash,
                        index: Number(e.target.value),
                      })
                    }
                  >
                    {categories.data?.categories.map((c) => (
                      <option key={c.index} value={c.index}>
                        {c.index === 0 ? "Uncategorized" : c.name || "Unnamed category"}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  {formatMebibytes(d.size)} / {formatMebibytes(d.size_done)} (
                  {d.progress?.percent !== undefined
                    ? `${d.progress.percent.toFixed(1)}%`
                    : d.size
                      ? `${Math.min(100, ((d.size_done ?? 0) / d.size) * 100).toFixed(1)}%`
                      : "—"}
                  )
                </td>
                <td>{formatRate(d.speed_bps)}</td>
                <td className="actions-column actions-column--fixed">
                  <div className="transfer-actions__inline">{transferActions(d)}</div>
                  <details className="transfer-actions__menu">
                    <summary className="icon" aria-label={`Actions for ${d.name}`} title="Actions">
                      <MoreHorizontal size={16} />
                    </summary>
                    <div>{transferActions(d)}</div>
                  </details>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && <p className="empty">No transfers match.</p>}
    </section>
  );
}
function Uploads() {
  const { sort, direction, toggleSort } = useSortState<"peer" | "file" | "client" | "speed">(
    "peer",
  );
  const uploads = useQuery({
    queryKey: queryKeys.uploadClients,
    queryFn: api.uploadClients,
    refetchInterval: 10_000,
  });
  const [filter, setFilter] = useState("");
  const peers = (uploads.data?.clients ?? [])
    .filter((peer) =>
      `${peer.client_name} ${peer.ip} ${peer.upload_file_name} ${peer.software} ${peer.software_version}`
        .toLowerCase()
        .includes(filter.toLowerCase()),
    )
    .sort((left, right) => {
      const value = (peer: UploadPeer) =>
        sort === "peer"
          ? peer.client_name || peer.ip
          : sort === "file"
            ? peer.upload_file_name
            : sort === "client"
              ? `${peer.software} ${peer.software_version}`
              : peer.upload_speed_bps;
      const leftValue = value(left);
      const rightValue = value(right);
      const comparison =
        typeof leftValue === "number"
          ? leftValue - (rightValue as number)
          : String(leftValue).localeCompare(String(rightValue));
      return direction === "asc" ? comparison : -comparison;
    });
  return (
    <section className="panel upload-panel">
      <div className="panel-title">
        <h2>Uploading now</h2>
        <span>{uploads.data?.clients.length ?? 0} active</span>
      </div>
      <div className="upload-filter">
        <input
          aria-label="Filter uploads"
          placeholder="Filter peer, file, or client"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        />
      </div>
      {uploads.isError ? (
        <p className="empty">Unable to load upload activity.</p>
      ) : !uploads.data?.clients.length ? (
        <p className="empty">No active uploads.</p>
      ) : peers.length ? (
        <div className="table-wrap">
          <table className="data-table">
            <colgroup>
              <col style={{ width: 210 }} />
              <col style={{ width: 420 }} />
              <col style={{ width: 190 }} />
              <col style={{ width: 120 }} />
            </colgroup>
            <thead>
              <tr>
                <SortableHeader
                  column="peer"
                  label="Peer"
                  sort={sort}
                  direction={direction}
                  onSort={toggleSort}
                />
                <SortableHeader
                  column="file"
                  label="File"
                  sort={sort}
                  direction={direction}
                  onSort={toggleSort}
                />
                <SortableHeader
                  column="client"
                  label="Client"
                  sort={sort}
                  direction={direction}
                  onSort={toggleSort}
                />
                <SortableHeader
                  column="speed"
                  label="Speed"
                  sort={sort}
                  direction={direction}
                  onSort={toggleSort}
                />
              </tr>
            </thead>
            <tbody>
              {peers.map((peer) => (
                <tr key={peer.client_ecid}>
                  <td>{peer.client_name || peer.ip}</td>
                  <td title={peer.upload_file_name || "Resolving file…"}>
                    {peer.upload_file_name || "Resolving file…"}
                  </td>
                  <td>
                    {peer.software} {peer.software_version}
                  </td>
                  <td>{formatRate(peer.upload_speed_bps)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="empty">No uploads match this filter.</p>
      )}
    </section>
  );
}
export function DashboardPage() {
  const { logout } = useSession();
  const [view, setView] = useState<
    | "dashboard"
    | "search"
    | "servers"
    | "categories"
    | "shared"
    | "kad"
    | "logs"
    | "statistics"
    | "preferences"
    | "peers"
  >("dashboard");
  const status = useQuery({ queryKey: queryKeys.status, queryFn: api.status });
  const downloads = useQuery({
    queryKey: queryKeys.downloads,
    queryFn: api.downloads,
  });
  useLiveUpdates();
  if (status.isPending) return <main className="loading">Connecting to aMule…</main>;
  if (status.isError)
    return (
      <main className="loading query-error" role="alert">
        <p>Unable to load aMule status: {getErrorMessage(status.error)}</p>
        <button onClick={() => void status.refetch()}>Retry</button>
      </main>
    );
  if (!status.data) return null;
  const s = status.data;
  const idState = s.ed2k.state !== "connected" ? "unknown" : s.ed2k.low_id ? "low" : "high";
  const navigation = [
    { id: "dashboard" as const, label: "Dashboard", icon: LayoutDashboard },
    { id: "search" as const, label: "Search", icon: Search },
    { id: "servers" as const, label: "Servers", icon: Server },
    { id: "categories" as const, label: "Categories", icon: FolderTree },
    { id: "shared" as const, label: "Shared", icon: Share2 },
    { id: "kad" as const, label: "Kad", icon: Network },
    { id: "logs" as const, label: "Logs", icon: ScrollText },
    { id: "statistics" as const, label: "Statistics", icon: ChartNoAxesCombined },
    { id: "peers" as const, label: "Peers", icon: UsersRound },
  ];
  const body =
    view === "search" ? (
      <SearchView />
    ) : view === "servers" ? (
      <ServersView
        connectedServerName={s.ed2k.state === "connected" ? s.ed2k.server_name : undefined}
      />
    ) : view === "categories" ? (
      <CategoriesView />
    ) : view === "shared" ? (
      <SharedFilesView />
    ) : view === "kad" ? (
      <KadView />
    ) : view === "logs" ? (
      <LogsView />
    ) : view === "statistics" ? (
      <Suspense fallback={<main className="loading">Loading statistics…</main>}>
        <StatisticsView />
      </Suspense>
    ) : view === "preferences" ? (
      <PreferencesView />
    ) : view === "peers" ? (
      <PeersView />
    ) : (
      <div className="content">
        <h1>Dashboard</h1>
        <p className="subtle">
          <ShieldCheck size={16} /> Local API session ·{" "}
          {s.ec_connected ? "daemon connected" : "daemon unavailable"}
        </p>
        <div className="metrics">
          <Metric label="Download" value={formatRate(s.speeds.download_bps)} />
          <Metric label="Upload" value={formatRate(s.speeds.upload_bps)} />
          <Metric label="Sources" value={String(s.queue.total_source_count)} />
          <Metric label="Upload queue" value={String(s.queue.upload_queue_length)} />
        </div>
        <UpdateStatus />
        <Transfers downloads={downloads.data?.downloads ?? []} />
        <Uploads />
      </div>
    );
  return (
    <main className="shell">
      <header>
        <div className="app-brand">
          <img className="app-logo" src={amuleLogo} alt="" />
          <strong>aMule Console</strong>
          <span className="live">LIVE</span>
        </div>
        <div className="statusline">
          <span className="connected-header" title={s.ed2k.server_name}>
            eD2k: {s.ed2k.state === "connected" ? s.ed2k.server_name || "Connected" : s.ed2k.state}
          </span>
          <span>Kad: {s.kad.state}</span>
          <span className={`id-status ${idState}`}>
            {idState === "high" ? "HighID" : idState === "low" ? "LowID" : "ID unknown"}
          </span>
          <button className="icon" onClick={() => void logout()}>
            <LogOut size={16} />
          </button>
        </div>
      </header>
      <nav>
        {navigation.map(({ id, label, icon: Icon }) => (
          <button key={id} className={view === id ? "active" : ""} onClick={() => setView(id)}>
            <Icon size={17} aria-hidden="true" />
            {label}
          </button>
        ))}
        <button
          className={view === "preferences" ? "active" : ""}
          onClick={() => setView("preferences")}
        >
          <Settings size={17} aria-hidden="true" />
          Preferences
        </button>
      </nav>
      {body}
    </main>
  );
}
