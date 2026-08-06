import * as Dialog from "@radix-ui/react-dialog";
import { useQuery } from "@tanstack/react-query";
import { Info, X } from "lucide-react";
import { api, type SharedFile } from "@/shared/api/amule-api";
import { queryKeys } from "@/shared/api/query-keys";
import { QueryNotice } from "@/shared/components/QueryNotice";
import { SortableHeader } from "@/shared/components/SortableHeader";
import { useSortState } from "@/shared/hooks/use-sort-state";
import { formatMebibytes, formatRate } from "@/shared/lib/formatters";

function SharedFileDetails({ file }: { file: SharedFile }) {
  const detail = useQuery({
    queryKey: queryKeys.sharedFile(file.hash),
    queryFn: () => api.sharedFile(file.hash),
  });
  const data = detail.data;
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button className="icon" aria-label={`View details for ${file.name}`} title="File details">
          <Info size={15} />
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="drawer-overlay" />
        <Dialog.Content className="drawer shared-details">
          <Dialog.Title>{file.name}</Dialog.Title>
          <Dialog.Close className="icon drawer-close" aria-label="Close">
            <X size={16} />
          </Dialog.Close>
          {!data ? (
            <QueryNotice
              loading={detail.isPending}
              error={detail.error}
              onRetry={() => void detail.refetch()}
            />
          ) : (
            <dl className="shared-detail-grid">
              <dt>Path</dt>
              <dd title={data.path}>{data.path ?? "Unavailable"}</dd>
              <dt>Type</dt>
              <dd>{data.file_type ?? "Unknown"}</dd>
              <dt>Share ratio</dt>
              <dd>{data.share_ratio?.toFixed(2) ?? "—"}</dd>
              <dt>Complete sources</dt>
              <dd>
                {data.complete_sources_range
                  ? `${data.complete_sources_range.low}–${data.complete_sources_range.high}`
                  : data.complete_sources}
              </dd>
              <dt>Upload queue</dt>
              <dd>{data.queued_count ?? 0}</dd>
              <dt>Uploaded</dt>
              <dd>{formatMebibytes(data.xfer.total)}</dd>
              <dt>Requests accepted</dt>
              <dd>
                {data.accepts.total} / {data.requests.total}
              </dd>
              <dt>Your rating</dt>
              <dd>{data.rating ? `${data.rating}/5` : "Unrated"}</dd>
              <dt>Your comment</dt>
              <dd>{data.comment || "No comment"}</dd>
            </dl>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function SharedFilesView() {
  const { sort, direction, toggleSort } = useSortState<"name" | "size" | "sources" | "speed">(
    "name",
  );
  const shared = useQuery({
    queryKey: queryKeys.sharedFiles,
    queryFn: api.sharedFiles,
    refetchInterval: 10_000,
  });
  const rows = [...(shared.data?.shared ?? [])].sort((left, right) => {
    const value = (file: SharedFile) =>
      sort === "sources"
        ? file.complete_sources
        : sort === "speed"
          ? file.upload_speed_bps
          : sort === "size"
            ? file.size
            : file.name;
    const leftValue = value(left);
    const rightValue = value(right);
    const comparison =
      typeof leftValue === "number"
        ? leftValue - (rightValue as number)
        : leftValue.localeCompare(rightValue as string);
    return direction === "asc" ? comparison : -comparison;
  });
  return (
    <div className="content">
      <h1>Shared files</h1>
      <p className="subtle">Files currently available for upload from this aMule node.</p>
      <section className="panel">
        <div className="panel-title">
          <h2>Shared library</h2>
          <span>{shared.data?.shared.length ?? 0} files</span>
        </div>
        {shared.isPending || shared.isError ? (
          <QueryNotice
            loading={shared.isPending}
            error={shared.error}
            onRetry={() => void shared.refetch()}
          />
        ) : rows.length ? (
          <div className="table-wrap">
            <table className="data-table shared-table">
              <colgroup>
                <col style={{ width: 460 }} />
                <col style={{ width: 120 }} />
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
                    column="size"
                    label="Size"
                    sort={sort}
                    direction={direction}
                    onSort={toggleSort}
                  />
                  <SortableHeader
                    column="sources"
                    label="Sources"
                    sort={sort}
                    direction={direction}
                    onSort={toggleSort}
                  />
                  <SortableHeader
                    column="speed"
                    label="Upload speed"
                    sort={sort}
                    direction={direction}
                    onSort={toggleSort}
                  />
                  <th className="actions-column" />
                </tr>
              </thead>
              <tbody>
                {rows.map((file) => (
                  <tr key={file.hash}>
                    <td title={file.name}>
                      {file.name}
                      <small>
                        {file.priority_auto ? `${file.priority} (auto)` : file.priority}
                      </small>
                    </td>
                    <td>{formatMebibytes(file.size)}</td>
                    <td>{file.complete_sources}</td>
                    <td>{formatRate(file.upload_speed_bps)}</td>
                    <td className="actions-column">
                      <SharedFileDetails file={file} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty">No shared files.</p>
        )}
      </section>
    </div>
  );
}
