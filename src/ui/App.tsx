import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  Check,
  FolderTree,
  LayoutDashboard,
  LogOut,
  Pause,
  Play,
  Search,
  Server,
  Settings,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { api, type Download } from "../api";
import { useSession } from "../session";
import { useLiveUpdates } from "../sse";
import { SearchView } from "./Search";
import { ServersView } from "./Servers";
import { CategoriesView } from "./Categories";
import { TransferDetails } from "./TransferDetails";
import { SortableHeader, type SortDirection } from "./DataTable";
import { ConfirmDialog } from "./ConfirmDialog";

type UploadPeer = Awaited<ReturnType<typeof api.uploadClients>>["clients"][number];

const rate = (value = 0) => {
  const units = ["B/s", "KiB/s", "MiB/s", "GiB/s"];
  let amount = Math.max(0, value);
  let unit = 0;
  while (amount >= 1024 && unit < units.length - 1) {
    amount /= 1024;
    unit += 1;
  }
  const precision = unit === 0 || amount >= 100 ? 0 : amount >= 10 ? 1 : 2;
  return `${amount.toFixed(precision)} ${units[unit]}`;
};
const size = (value?: number) =>
  value === undefined ? "—" : `${(value / 1024 / 1024).toFixed(value >= 1024 * 1024 ? 1 : 0)} MiB`;
function Login() {
  const { login } = useSession();
  const [password, setPassword] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      await login(password);
    } catch (x) {
      toast.error(x instanceof Error ? x.message : "Login failed");
    }
  }
  return (
    <main className="login">
      <form onSubmit={submit}>
        <Activity size={36} />
        <h1>aMule Console</h1>
        <label>
          Admin password
          <input
            autoFocus
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <button>Sign in</button>
      </form>
    </main>
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
function Transfers({ downloads }: { downloads: Download[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [filter, setFilter] = useState("");
  const [sort, setSort] = useState<"name" | "status" | "speed" | "priority" | "category" | "size">(
    "name",
  );
  const [direction, setDirection] = useState<SortDirection>("asc");
  const [link, setLink] = useState("");
  const client = useQueryClient();
  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: api.categories,
  });
  const refresh = () => void client.invalidateQueries({ queryKey: ["downloads"] });
  const one = useMutation({
    mutationFn: ({ hash, status }: { hash: string; status: "pause" | "resume" }) =>
      api.downloadAction(hash, status),
    onSuccess: (_, variables) => {
      refresh();
      toast.success(`Transfer ${variables.status === "pause" ? "paused" : "resumed"}.`);
    },
    onError: (e) => toast.error(e.message),
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
    onError: (e) => toast.error(e.message),
  });
  const category = useMutation({
    mutationFn: ({ hash, index }: { hash: string; index: number }) =>
      api.setDownloadCategory(hash, index),
    onSuccess: () => {
      refresh();
      toast.success("Transfer category updated.");
    },
    onError: (e) => toast.error(e.message),
  });
  const add = useMutation({
    mutationFn: (links: string[]) => api.addLinks(links),
    onSuccess: (_, links) => {
      refresh();
      setLink("");
      toast.success(`${links.length} ed2k link${links.length === 1 ? "" : "s"} added.`);
    },
    onError: (e) => toast.error(e.message),
  });
  const clear = useMutation({
    mutationFn: () => api.clearCompleted(),
    onSuccess: (v) => {
      refresh();
      toast.success(
        `Cleared ${v.cleared} completed notification${v.cleared === 1 ? "" : "s"}. Files remain in Incoming.`,
      );
    },
    onError: (e) => toast.error(e.message),
  });
  const clearOne = useMutation({
    mutationFn: api.clearCompleted,
    onSuccess: () => {
      refresh();
      toast.success("Completed download notification cleared. The Incoming file was kept.");
    },
    onError: (e) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: api.removeDownload,
    onSuccess: (_, hash) => {
      refresh();
      setSelected((current) => current.filter((selectedHash) => selectedHash !== hash));
      toast.success("Download deleted.");
    },
    onError: (e) => toast.error(e.message),
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
    onError: (e) => toast.error(e.message),
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
  const toggleSort = (column: typeof sort) => {
    if (column === sort) setDirection((current) => (current === "asc" ? "desc" : "asc"));
    else {
      setSort(column);
      setDirection("asc");
    }
  };
  const toggle = (hash: string) =>
    setSelected((s) => (s.includes(hash) ? s.filter((v) => v !== hash) : [...s, hash]));
  function submit(e: FormEvent) {
    e.preventDefault();
    const links = link.split(/\s+/).filter(Boolean);
    if (!links.length || !links.every((v) => v.startsWith("ed2k://")))
      return toast.warning("Enter one or more valid ed2k:// links.");
    add.mutate(links);
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
        <table className="data-table">
          <colgroup>
            <col style={{ width: 46 }} />
            <col style={{ width: 330 }} />
            <col style={{ width: 110 }} />
            <col style={{ width: 110 }} />
            <col style={{ width: 140 }} />
            <col style={{ width: 185 }} />
            <col style={{ width: 105 }} />
            <col style={{ width: 64 }} />
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
              <th />
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
                  {size(d.size)} / {size(d.size_done)} (
                  {d.progress?.percent !== undefined
                    ? `${d.progress.percent.toFixed(1)}%`
                    : d.size
                      ? `${Math.min(100, ((d.size_done ?? 0) / d.size) * 100).toFixed(1)}%`
                      : "—"}
                  )
                </td>
                <td>{rate(d.speed_bps)}</td>
                <td>
                  {d.status === "completed" ? (
                    <button
                      className="icon"
                      disabled={clearOne.isPending}
                      aria-label={`Clear completed notification for ${d.name}`}
                      title="Clear completed notification (keeps Incoming file)"
                      onClick={() => clearOne.mutate(d.hash)}
                    >
                      <Check size={15} />
                    </button>
                  ) : (
                    <>
                      <button
                        className="icon"
                        onClick={() =>
                          one.mutate({
                            hash: d.hash,
                            status: d.status === "paused" ? "resume" : "pause",
                          })
                        }
                      >
                        {d.status === "paused" ? <Play size={15} /> : <Pause size={15} />}
                      </button>
                      <ConfirmDialog
                        trigger={
                          <button
                            className="icon danger"
                            disabled={remove.isPending}
                            aria-label={`Delete ${d.name}`}
                            title="Delete download"
                          >
                            <Trash2 size={15} />
                          </button>
                        }
                        title="Delete download?"
                        description={`“${d.name}” and its active download data will be permanently removed from disk.`}
                        actionLabel="Delete download"
                        dangerous
                        onConfirm={() => remove.mutate(d.hash)}
                      />
                    </>
                  )}
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
  const [sort, setSort] = useState<"peer" | "file" | "client" | "speed">("peer");
  const [direction, setDirection] = useState<SortDirection>("asc");
  const uploads = useQuery({
    queryKey: ["clients", "uploads"],
    queryFn: api.uploadClients,
    refetchInterval: 10_000,
  });
  const peers = [...(uploads.data?.clients ?? [])].sort((left, right) => {
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
  const toggleSort = (column: typeof sort) => {
    if (column === sort) setDirection((current) => (current === "asc" ? "desc" : "asc"));
    else {
      setSort(column);
      setDirection("asc");
    }
  };
  return (
    <section className="panel upload-panel">
      <div className="panel-title">
        <h2>Uploading now</h2>
        <span>{uploads.data?.clients.length ?? 0} active</span>
      </div>
      {uploads.isError ? (
        <p className="empty">Unable to load upload activity.</p>
      ) : uploads.data?.clients.length ? (
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
                  <td>{rate(peer.upload_speed_bps)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="empty">No active uploads.</p>
      )}
    </section>
  );
}
function Console() {
  const { logout } = useSession();
  const [view, setView] = useState<"dashboard" | "search" | "servers" | "categories">("dashboard");
  const status = useQuery({ queryKey: ["status"], queryFn: api.status });
  const downloads = useQuery({
    queryKey: ["downloads"],
    queryFn: api.downloads,
  });
  useLiveUpdates();
  if (!status.data) return <main className="loading">Connecting to aMule…</main>;
  const s = status.data;
  const idState = s.ed2k.state !== "connected" ? "unknown" : s.ed2k.low_id ? "low" : "high";
  const navigation = [
    { id: "dashboard" as const, label: "Dashboard", icon: LayoutDashboard },
    { id: "search" as const, label: "Search", icon: Search },
    { id: "servers" as const, label: "Servers", icon: Server },
    { id: "categories" as const, label: "Categories", icon: FolderTree },
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
    ) : (
      <div className="content">
        <h1>Dashboard</h1>
        <p className="subtle">
          <ShieldCheck size={16} /> Local API session ·{" "}
          {s.ec_connected ? "daemon connected" : "daemon unavailable"}
        </p>
        <div className="metrics">
          <Metric label="Download" value={rate(s.speeds.download_bps)} />
          <Metric label="Upload" value={rate(s.speeds.upload_bps)} />
          <Metric label="Sources" value={String(s.queue.total_source_count)} />
          <Metric label="Upload queue" value={String(s.queue.upload_queue_length)} />
        </div>
        <Transfers downloads={downloads.data?.downloads ?? []} />
        <Uploads />
      </div>
    );
  return (
    <main className="shell">
      <header>
        <div>
          <Activity />
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
        <button disabled>
          <Settings size={17} aria-hidden="true" />
          Preferences
        </button>
      </nav>
      {body}
    </main>
  );
}
export function App() {
  const { ready, authenticated } = useSession();
  return !ready ? (
    <main className="loading">Checking session…</main>
  ) : authenticated ? (
    <Console />
  ) : (
    <Login />
  );
}
