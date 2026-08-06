import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3 } from "lucide-react";
import { api, type StatisticNode, type StatisticValue } from "@/shared/api/amule-api";
import { queryKeys } from "@/shared/api/query-keys";
import { QueryNotice } from "@/shared/components/QueryNotice";
import { formatBytes, formatDuration, formatRate } from "@/shared/lib/formatters";

type GraphName = "download" | "upload" | "connections" | "kad";

const graphLabels: Record<GraphName, string> = {
  download: "Download",
  upload: "Upload",
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

function formatStatisticLabel(node: StatisticNode) {
  let index = 0;
  return node.label.replace(/%s/g, () => {
    const value = node.values[index++];
    if (!value) return "—";
    const main = formatStatisticValue(value);
    return value.extra ? `${main} (${formatStatisticValue(value.extra)})` : main;
  });
}

function StatisticsTreeNode({ node, depth = 0 }: { node: StatisticNode; depth?: number }) {
  const label = formatStatisticLabel(node);
  const isContainer = node.children.length > 0;
  if (!isContainer)
    return (
      <div className="statistics-leaf" style={{ paddingLeft: `${16 + depth * 18}px` }}>
        {label}
      </div>
    );

  return (
    <details className="statistics-node" open={depth < 2}>
      <summary>{label}</summary>
      <div className="statistics-children">
        {node.children.map((child, index) => (
          <StatisticsTreeNode
            key={`${child.key ?? child.label}-${index}`}
            node={child}
            depth={depth + 1}
          />
        ))}
      </div>
    </details>
  );
}

function Graph({ points, unit }: { points: { value: number }[]; unit: "bps" | "count" }) {
  const line = useMemo(() => {
    if (!points.length) return "";
    const maximum = Math.max(1, ...points.map((point) => point.value));
    const width = 640;
    const height = 180;
    return points
      .map((point, index) => {
        const x = points.length === 1 ? width : (index / (points.length - 1)) * width;
        const y = height - (point.value / maximum) * height;
        return `${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(" ");
  }, [points]);
  const latest = points.at(-1)?.value ?? 0;
  const maximum = Math.max(0, ...points.map((point) => point.value));
  const format = unit === "bps" ? formatRate : (value: number) => value.toLocaleString();

  if (!points.length)
    return <p className="empty statistics-empty">No samples have been collected yet.</p>;
  return (
    <div className="statistics-chart-wrap">
      <div className="statistics-chart-scale">
        <span>Peak {format(maximum)}</span>
        <strong>Current {format(latest)}</strong>
      </div>
      <svg
        className="statistics-chart"
        viewBox="0 0 640 180"
        role="img"
        aria-label="Statistics graph"
      >
        <line x1="0" y1="180" x2="640" y2="180" />
        <line x1="0" y1="90" x2="640" y2="90" />
        <polyline points={line} />
      </svg>
    </div>
  );
}

export function StatisticsView() {
  const [graph, setGraph] = useState<GraphName>("download");
  const [width, setWidth] = useState(300);
  const tree = useQuery({
    queryKey: queryKeys.statisticsTree,
    queryFn: api.statisticsTree,
    refetchInterval: 5_000,
  });
  const series = useQuery({
    queryKey: queryKeys.statisticsGraph(graph, width),
    queryFn: () => api.statisticsGraph(graph, width),
    refetchInterval: 5_000,
  });
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
        {series.isPending || series.isError ? (
          <QueryNotice
            loading={series.isPending}
            error={series.error}
            onRetry={() => void series.refetch()}
          />
        ) : series.data ? (
          <>
            <Graph points={series.data.points} unit={series.data.unit} />
            <div className="statistics-session">
              <span>Session download {formatBytes(series.data.session.download_bytes)}</span>
              <span>Session upload {formatBytes(series.data.session.upload_bytes)}</span>
              <span>Session Kad {formatBytes(series.data.session.kad_bytes)}</span>
            </div>
          </>
        ) : null}
      </section>
      <section className="panel statistics-panel">
        <div className="panel-title">
          <h2>Detailed statistics</h2>
          <span>Daemon statistics tree</span>
        </div>
        {tree.isPending || tree.isError ? (
          <QueryNotice
            loading={tree.isPending}
            error={tree.error}
            onRetry={() => void tree.refetch()}
          />
        ) : tree.data?.nodes.length ? (
          <div className="statistics-tree">
            {tree.data.nodes.map((node, index) => (
              <StatisticsTreeNode key={`${node.key ?? node.label}-${index}`} node={node} />
            ))}
          </div>
        ) : (
          <p className="empty">No statistics are available from the daemon.</p>
        )}
      </section>
    </div>
  );
}
