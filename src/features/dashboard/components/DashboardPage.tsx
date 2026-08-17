import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, NavLink, Outlet, useOutletContext } from "react-router-dom";
import {
  ChartNoAxesCombined,
  Check,
  FolderTree,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  MoreHorizontal,
  Network,
  Pause,
  Play,
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
import { ServersView } from "@/features/servers/components/ServersView";
import { TransferDetails } from "@/features/transfers/components/TransferDetails";
import { SortableHeader } from "@/shared/components/SortableHeader";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { formatMebibytes, formatRate } from "@/shared/lib/formatters";
import { useSortState } from "@/shared/hooks/use-sort-state";
import { getErrorMessage } from "@/shared/lib/errors";

const StatisticsView = lazy(() =>
  import("@/features/statistics/components/StatisticsView").then(({ StatisticsView }) => ({
    default: StatisticsView,
  })),
);

type UploadPeer = Awaited<ReturnType<typeof api.uploadClients>>["clients"][number];
type Status = Awaited<ReturnType<typeof api.status>>;

function MobileTransferActions({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const updatePosition = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) setPosition({ top: rect.top - 6, left: rect.right });
  };

  useEffect(() => {
    if (!open) return;
    updatePosition();
    const closeOnOutsideClick = (event: PointerEvent) => {
      const target = event.target;
      if (
        target instanceof Node &&
        !triggerRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      )
        setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div className="transfer-actions__menu">
      <button
        ref={triggerRef}
        className="icon"
        aria-label={label}
        aria-expanded={open}
        title="Actions"
        onClick={() => {
          updatePosition();
          setOpen((current) => !current);
        }}
      >
        <MoreHorizontal size={16} />
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            className="transfer-actions__popover"
            style={{ top: position.top, left: position.left }}
          >
            {children}
          </div>,
          document.body,
        )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <section className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </section>
  );
}
function downloadProgress(download: Download) {
  const progress =
    download.progress?.percent ??
    (download.size ? ((download.size_done ?? 0) / download.size) * 100 : undefined);
  return progress === undefined ? undefined : Math.min(100, Math.max(0, progress));
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
        <button disabled={add.isPending} aria-busy={add.isPending}>
          {add.isPending && <LoaderCircle className="transfer-tools__spinner" size={15} />}
          {add.isPending ? "Adding link…" : "Add link"}
        </button>
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
            <col style={{ width: 52 }} />
            <col style={{ width: 330 }} />
            <col style={{ width: 110 }} />
            <col style={{ width: 110 }} />
            <col style={{ width: 180 }} />
            <col style={{ width: 290 }} />
            <col style={{ width: 105 }} />
            <col className="actions-column actions-column--fixed" />
          </colgroup>
          <thead>
            <tr>
              <th className="selection-column">
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
                label="Downloaded / size"
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
            {orderedRows.map((d) => {
              const progress = downloadProgress(d);
              return (
                <tr key={d.hash}>
                  <td className="selection-column">
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
                  <td className="transfer-progress-cell">
                    <span
                      className="transfer-progress-cell__bar"
                      aria-hidden="true"
                      style={{ "--progress": (progress ?? 0) / 100 } as CSSProperties}
                    />
                    <span className="transfer-progress-cell__text">
                      {formatMebibytes(d.size_done)} / {formatMebibytes(d.size)} (
                      {progress === undefined ? "—" : `${progress.toFixed(1)}%`})
                    </span>
                  </td>
                  <td>{formatRate(d.speed_bps)}</td>
                  <td className="actions-column actions-column--fixed">
                    <div className="transfer-actions__inline">{transferActions(d)}</div>
                    <MobileTransferActions label={`Actions for ${d.name}`}>
                      {transferActions(d)}
                    </MobileTransferActions>
                  </td>
                </tr>
              );
            })}
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
  const status = useOutletContext<Status>();
  const downloads = useQuery({
    queryKey: queryKeys.downloads,
    queryFn: api.downloads,
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
  });
  const s = status;
  return (
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
      <Transfers downloads={downloads.data?.downloads ?? []} />
      <Uploads />
    </div>
  );
}

export function ServersPage() {
  const status = useOutletContext<Status>();
  return (
    <ServersView
      connectedServerName={status.ed2k.state === "connected" ? status.ed2k.server_name : undefined}
    />
  );
}

export function StatisticsPage() {
  return (
    <Suspense fallback={<main className="loading">Loading statistics…</main>}>
      <StatisticsView />
    </Suspense>
  );
}

export function DashboardShell() {
  const { logout } = useSession();
  const status = useQuery({ queryKey: queryKeys.status, queryFn: api.status });
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
    { to: "/", label: "Dashboard", icon: LayoutDashboard },
    { to: "/search", label: "Search", icon: Search },
    { to: "/servers", label: "Servers", icon: Server },
    { to: "/categories", label: "Categories", icon: FolderTree },
    { to: "/shared", label: "Shared", icon: Share2 },
    { to: "/kad", label: "Kad", icon: Network },
    { to: "/logs", label: "Logs", icon: ScrollText },
    { to: "/statistics", label: "Statistics", icon: ChartNoAxesCombined },
    { to: "/peers", label: "Peers", icon: UsersRound },
  ];
  return (
    <main className="shell">
      <header>
        <div className="app-brand">
          <Link to="/" aria-label="aMule Console dashboard">
            <img className="app-logo" src={amuleLogo} alt="" />
            <strong>aMule Console</strong>
            <span className="live">LIVE</span>
          </Link>
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
        {navigation.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === "/"}>
            <Icon size={17} aria-hidden="true" />
            {label}
          </NavLink>
        ))}
        <NavLink to="/preferences">
          <Settings size={17} aria-hidden="true" />
          Preferences
        </NavLink>
      </nav>
      <Outlet context={s} />
    </main>
  );
}
