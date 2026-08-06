import { getErrorMessage } from "@/shared/lib/errors";

export function QueryNotice({
  error,
  onRetry,
  loading = false,
}: {
  error?: unknown;
  onRetry?: () => void;
  loading?: boolean;
}) {
  if (loading) return <p className="empty">Loading…</p>;
  if (!error) return null;
  return (
    <div className="query-notice" role="alert">
      <span>Unable to load this data: {getErrorMessage(error)}</span>
      {onRetry && <button onClick={onRetry}>Retry</button>}
    </div>
  );
}
