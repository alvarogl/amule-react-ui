import * as Accordion from "@radix-ui/react-accordion";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3, ChevronRight, Search } from "lucide-react";
import { api, type StatisticNode, type StatisticValue } from "@/shared/api/amule-api";
import { queryKeys } from "@/shared/api/query-keys";
import { QueryNotice } from "@/shared/components/QueryNotice";
import { formatBytes, formatDuration, formatRate } from "@/shared/lib/formatters";

type GraphName = "traffic" | "connections" | "kad";
type SeriesName = Exclude<GraphName, "traffic"> | "download" | "upload";

const graphLabels: Record<GraphName, string> = {
  traffic: "Traffic",
  connections: "Connections",
  kad: "Kad",
};

function formatStatisticValue(value: StatisticValue): string {
  if (value.enum === "never") return "Never";
  if (value.enum === "not_available") return "Not available";
  if (typeof value.value === "string") return value.value;

  switch (value.type) {
    case "bytes":
      return formatBytes(value.value);
    case "speed":
      return formatRate(value.value);
    case "time":
      return formatDuration(value.value);
    case "double":
      return value.value.toLocaleString(undefined, { maximumFractionDigits: 2 });
    default:
      return value.value.toLocaleString();
  }
}

const statisticPlaceholder =
  /%(?:[-+ #0]*\d*(?:\.\d+)?(?:hh|h|ll|l|L|z|j|t)?[diuoxXfFeEgGaAcsp%])/g;
const statisticPlaceholderPattern =
  /%(?:[-+ #0]*\d*(?:\.\d+)?(?:hh|h|ll|l|L|z|j|t)?[diuoxXfFeEgGaAcsp%])/;

function formatStatisticLabel(node: StatisticNode) {
  let index = 0;
  return node.label.replace(statisticPlaceholder, (placeholder) => {
    if (placeholder === "%%") return "%";
    const value = node.values[index++];
    if (!value) return "—";
    const main = formatStatisticValue(value);
    return value.extra ? `${main} (${formatStatisticValue(value.extra)})` : main;
  });
}

function statisticName(node: StatisticNode) {
  if (node.raw) return node.raw;
  return node.label.replace(statisticPlaceholder, "").replace(/\s+:$/, "");
}

function statisticValue(node: StatisticNode) {
  if (!node.values.length) return "";
  return node.values
    .map((value) => {
      const main = formatStatisticValue(value);
      return value.extra ? `${main} (${formatStatisticValue(value.extra)})` : main;
    })
    .join(" · ");
}

function includesSearch(node: StatisticNode, search: string): boolean {
  const term = search.toLocaleLowerCase();
  return `${node.key ?? ""} ${node.raw ?? ""} ${formatStatisticLabel(node)}`
    .toLocaleLowerCase()
    .includes(term);
}

function filterNodes(nodes: StatisticNode[], search: string): StatisticNode[] {
  if (!search.trim()) return nodes;
  return nodes.flatMap((node) => {
    const children = filterNodes(node.children, search);
    return includesSearch(node, search) || children.length ? [{ ...node, children }] : [];
  });
}

function findNode(nodes: StatisticNode[], keys: string[]): StatisticNode | undefined {
  for (const node of nodes) {
    if (node.key && keys.includes(node.key)) return node;
    const match = findNode(node.children, keys);
    if (match) return match;
  }
}

function StatisticsTreeNode({ node, depth = 0 }: { node: StatisticNode; depth?: number }) {
  const label = statisticName(node);
  const key = node.key ?? `${node.label}-${depth}`;
  if (!node.children.length) {
    const hasPlaceholders = statisticPlaceholderPattern.test(node.label);
    return (
      <div className="statistics-leaf">
        {hasPlaceholders ? (
          <span>{formatStatisticLabel(node)}</span>
        ) : (
          <>
            <span>{label}</span>
            <strong>{statisticValue(node)}</strong>
          </>
        )}
      </div>
    );
  }

  return (
    <Accordion.Item className="statistics-node" value={key}>
      <Accordion.Header>
        <Accordion.Trigger className="statistics-trigger">
          <ChevronRight size={15} aria-hidden="true" />
          {label}
        </Accordion.Trigger>
      </Accordion.Header>
      <Accordion.Content className="statistics-accordion-content">
        <Accordion.Root
          className="statistics-children"
          type="multiple"
          defaultValue={
            depth < 1
              ? node.children.map((child, index) => child.key ?? `${child.label}-${index}`)
              : []
          }
        >
          {node.children.map((child, index) => (
            <StatisticsTreeNode
              key={`${child.key ?? child.label}-${index}`}
              node={child}
              depth={depth + 1}
            />
          ))}
        </Accordion.Root>
      </Accordion.Content>
    </Accordion.Item>
  );
}

function StatisticsTree({ nodes, search }: { nodes: StatisticNode[]; search: string }) {
  const filtered = filterNodes(nodes, search);
  return (
    <Accordion.Root
      className="statistics-tree"
      type="multiple"
      defaultValue={
        search ? filtered.map((node, index) => node.key ?? `${node.label}-${index}`) : []
      }
    >
      {filtered.map((node, index) => (
        <StatisticsTreeNode key={`${node.key ?? node.label}-${index}`} node={node} />
      ))}
    </Accordion.Root>
  );
}

function SummaryCard({ title, node }: { title: string; node?: StatisticNode }) {
  return (
    <section className="statistics-summary-card">
      <span>{title}</span>
      <strong>{node ? statisticValue(node) || formatStatisticLabel(node) : "Unavailable"}</strong>
    </section>
  );
}

function formatChartTime(value: number) {
  return new Date(value * 1_000).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function ActivityChart({ data, graph }: { data: Array<Record<string, number>>; graph: GraphName }) {
  const traffic = graph === "traffic";
  const valueFormatter = traffic ? formatRate : (value: number) => value.toLocaleString();
  const series: Array<{ key: SeriesName; label: string; color: string }> = traffic
    ? [
        { key: "download", label: "Download", color: "#4dd2ff" },
        { key: "upload", label: "Upload", color: "#8b7bff" },
      ]
    : [{ key: graph, label: graphLabels[graph], color: "#4dd2ff" }];
  const latest = data.at(-1) ?? {};

  if (!data.length)
    return <p className="empty statistics-empty">No samples have been collected yet.</p>;
  return (
    <div className="statistics-chart-wrap">
      <div className="statistics-chart-scale">
        {series.map(({ key, label, color }) => (
          <span key={key}>
            <i style={{ background: color }} /> {label}{" "}
            <strong>{valueFormatter(latest[key] ?? 0)}</strong>
          </span>
        ))}
      </div>
      <div className="statistics-chart">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 14, right: 12, bottom: 0, left: 10 }}>
            <defs>
              {series.map(({ key, color }) => (
                <linearGradient key={key} id={`statistics-fill-${key}`} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.32} />
                  <stop offset="95%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid stroke="#26394d" strokeDasharray="3 4" vertical={false} />
            <XAxis
              dataKey="time"
              type="number"
              domain={["dataMin", "dataMax"]}
              tickFormatter={formatChartTime}
              minTickGap={60}
              tick={{ fill: "#91a4b8", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tickFormatter={valueFormatter}
              width={traffic ? 78 : 56}
              tick={{ fill: "#91a4b8", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              allowDecimals={!traffic}
            />
            <Tooltip
              labelFormatter={(value) => `Sampled ${formatChartTime(Number(value))}`}
              formatter={(value, name) => [valueFormatter(Number(value)), name]}
              contentStyle={{ background: "#121b26", border: "1px solid #395066", borderRadius: 7 }}
              labelStyle={{ color: "#91a4b8" }}
              itemStyle={{ color: "#d7e1ed" }}
            />
            <Legend wrapperStyle={{ color: "#b9cada", fontSize: 12, paddingTop: 8 }} />
            {series.map(({ key, label, color }) => (
              <Area
                key={key}
                type="monotone"
                dataKey={key}
                name={label}
                stroke={color}
                strokeWidth={2}
                fill={`url(#statistics-fill-${key})`}
                connectNulls
                isAnimationActive={false}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function StatisticsView() {
  const [graph, setGraph] = useState<GraphName>("traffic");
  const [width, setWidth] = useState(300);
  const [statisticsSearch, setStatisticsSearch] = useState("");
  const tree = useQuery({
    queryKey: queryKeys.statisticsTree,
    queryFn: api.statisticsTree,
    refetchInterval: 5_000,
  });
  const download = useQuery({
    queryKey: queryKeys.statisticsGraph("download", width),
    queryFn: () => api.statisticsGraph("download", width),
    refetchInterval: 5_000,
    enabled: graph === "traffic",
  });
  const upload = useQuery({
    queryKey: queryKeys.statisticsGraph("upload", width),
    queryFn: () => api.statisticsGraph("upload", width),
    refetchInterval: 5_000,
    enabled: graph === "traffic",
  });
  const secondary = useQuery({
    queryKey: queryKeys.statisticsGraph(graph === "traffic" ? "connections" : graph, width),
    queryFn: () => api.statisticsGraph(graph === "traffic" ? "connections" : graph, width),
    refetchInterval: 5_000,
    enabled: graph !== "traffic",
  });
  const chart = useMemo(() => {
    if (graph === "traffic") {
      const points = new Map<number, Record<string, number>>();
      for (const point of download.data?.points ?? [])
        points.set(point.t_unix, {
          ...(points.get(point.t_unix) ?? {}),
          time: point.t_unix,
          download: point.value,
        });
      for (const point of upload.data?.points ?? [])
        points.set(point.t_unix, {
          ...(points.get(point.t_unix) ?? {}),
          time: point.t_unix,
          upload: point.value,
        });
      return [...points.values()].sort((left, right) => left.time - right.time);
    }
    return (secondary.data?.points ?? []).map((point) => ({
      time: point.t_unix,
      [graph]: point.value,
    }));
  }, [download.data, graph, secondary.data, upload.data]);
  const activeQueries = graph === "traffic" ? [download, upload] : [secondary];
  const pending = activeQueries.some((query) => query.isPending);
  const failed = activeQueries.find((query) => query.isError);
  const session =
    graph === "traffic"
      ? (download.data?.session ?? upload.data?.session)
      : secondary.data?.session;
  const summary = tree.data?.nodes
    ? {
        uploaded: findNode(tree.data.nodes, ["upload_data", "upload_session"]),
        downloaded: findNode(tree.data.nodes, ["download_data", "download_session"]),
        ratio: findNode(tree.data.nodes, ["ul_dl_ratio"]),
        connections: findNode(tree.data.nodes, ["active_connections"]),
      }
    : undefined;
  return (
    <div className="content statistics-view">
      <h1>Statistics</h1>
      <p className="subtle">
        <BarChart3 size={16} /> Updated every five seconds while this page is open.
      </p>
      <section className="panel statistics-panel">
        <div className="panel-title">
          <h2>Activity</h2>
          <div className="statistics-controls">
            {(Object.keys(graphLabels) as GraphName[]).map((name) => (
              <button
                key={name}
                className={graph === name ? "active" : "muted"}
                aria-pressed={graph === name}
                onClick={() => setGraph(name)}
              >
                {graphLabels[name]}
              </button>
            ))}
            <label>
              Samples
              <select value={width} onChange={(event) => setWidth(Number(event.target.value))}>
                <option value={60}>60</option>
                <option value={300}>300</option>
                <option value={900}>900</option>
              </select>
            </label>
          </div>
        </div>
        {pending || failed ? (
          <QueryNotice
            loading={pending}
            error={failed?.error}
            onRetry={() => activeQueries.forEach((query) => void query.refetch())}
          />
        ) : (
          <>
            <ActivityChart data={chart} graph={graph} />
            <div className="statistics-session">
              <span>Session download {formatBytes(session?.download_bytes)}</span>
              <span>Session upload {formatBytes(session?.upload_bytes)}</span>
              <span>Session Kad {formatBytes(session?.kad_bytes)}</span>
            </div>
          </>
        )}
      </section>
      <section className="panel statistics-panel">
        <div className="panel-title">
          <h2>At a glance</h2>
          <span>Current session</span>
        </div>
        {tree.isPending || tree.isError ? (
          <QueryNotice
            loading={tree.isPending}
            error={tree.error}
            onRetry={() => void tree.refetch()}
          />
        ) : tree.data?.nodes.length ? (
          <div className="statistics-summary">
            <SummaryCard title="Downloaded" node={summary?.downloaded} />
            <SummaryCard title="Uploaded" node={summary?.uploaded} />
            <SummaryCard title="UL:DL ratio" node={summary?.ratio} />
            <SummaryCard title="Active connections" node={summary?.connections} />
          </div>
        ) : (
          <p className="empty">No statistics are available from the daemon.</p>
        )}
      </section>
      <section className="panel statistics-panel">
        <div className="panel-title">
          <div>
            <h2>Detailed statistics</h2>
            <span>Browse daemon diagnostics only when needed</span>
          </div>
          <label className="statistics-search">
            <Search size={15} aria-hidden="true" />
            <input
              value={statisticsSearch}
              onChange={(event) => setStatisticsSearch(event.target.value)}
              placeholder="Filter details"
              aria-label="Filter detailed statistics"
            />
          </label>
        </div>
        {tree.data?.nodes.length ? (
          <StatisticsTree nodes={tree.data.nodes} search={statisticsSearch} />
        ) : null}
      </section>
    </div>
  );
}
