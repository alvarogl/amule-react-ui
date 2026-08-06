import * as Dialog from "@radix-ui/react-dialog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/shared/api/amule-api";
import { queryKeys } from "@/shared/api/query-keys";
import { formatMebibytes } from "@/shared/lib/formatters";
import { getErrorMessage } from "@/shared/lib/errors";

export function TransferDetails({ hash, name }: { hash: string; name: string }) {
  const client = useQueryClient();
  const detail = useQuery({
    queryKey: queryKeys.download(hash),
    queryFn: () => api.downloadDetail(hash),
  });
  const names = useQuery({
    queryKey: queryKeys.downloadFilenames(hash),
    queryFn: () => api.downloadFilenames(hash),
  });
  const comments = useQuery({
    queryKey: queryKeys.downloadComments(hash),
    queryFn: () => api.downloadComments(hash),
  });
  const a4af = useQuery({
    queryKey: queryKeys.downloadA4af(hash),
    queryFn: () => api.downloadA4af(hash),
  });
  const rename = useMutation({
    mutationFn: (nextName: string) => api.renameDownload(hash, nextName),
    onSuccess: () => {
      toast.success("Download name updated.");
      void client.invalidateQueries({ queryKey: queryKeys.downloads });
      void client.invalidateQueries({ queryKey: queryKeys.download(hash) });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  const swap = useMutation({
    mutationFn: (action: "swap_this" | "swap_this_auto" | "swap_others") =>
      api.a4afAction(hash, action),
    onSuccess: () => {
      toast.success("A4AF source swapping updated.");
      void client.invalidateQueries({ queryKey: queryKeys.downloadA4af(hash) });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  const data = detail.data;
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button className="detail-link" title={name}>
          {name}
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="drawer-overlay" />
        <Dialog.Content className="drawer">
          <Dialog.Title>{name}</Dialog.Title>
          <Dialog.Close className="icon drawer-close" aria-label="Close">
            <X size={16} />
          </Dialog.Close>
          {!data ? (
            <p>{detail.isError ? "Details unavailable." : "Loading details…"}</p>
          ) : (
            <>
              <p className="subtle">
                {data.status} · {data.size ? formatMebibytes(data.size) : "Size unavailable"}
              </p>
              <h3>Alternate filenames</h3>
              <ul>
                {names.data?.filenames.map((item) => (
                  <li key={item.name}>
                    <span>
                      {item.name} <small>({item.count})</small>
                    </span>
                    <button
                      className="muted detail-action"
                      disabled={rename.isPending || item.name === data.name}
                      onClick={() => rename.mutate(item.name)}
                    >
                      Use name
                    </button>
                  </li>
                )) ?? <li>None reported.</li>}
              </ul>
              <h3>Comments</h3>
              <ul>
                {comments.data?.comments.length ? (
                  comments.data.comments.map((item, index) => (
                    <li key={`${item.username}-${index}`}>
                      <strong>{item.username}</strong> · {item.rating}/5
                      <br />
                      {item.comment || "No comment"}
                    </li>
                  ))
                ) : (
                  <li>No comments yet.</li>
                )}
              </ul>
              <h3>A4AF sources</h3>
              <p className="detail-a4af-status">
                {a4af.data?.sources.length
                  ? `${a4af.data.sources.length} source${a4af.data.sources.length === 1 ? "" : "s"}`
                  : "No sources"}
                <span>Auto {a4af.data?.a4af_auto ? "on" : "off"}</span>
              </p>
              <div className="detail-actions">
                <button
                  className="muted"
                  disabled={swap.isPending}
                  onClick={() => swap.mutate("swap_this")}
                >
                  Take sources
                </button>
                <button
                  className="muted"
                  disabled={swap.isPending}
                  onClick={() => swap.mutate("swap_others")}
                >
                  Release sources
                </button>
                <button
                  className="muted"
                  disabled={swap.isPending}
                  onClick={() => swap.mutate("swap_this_auto")}
                >
                  Toggle automatic
                </button>
              </div>
              {a4af.data?.sources.length ? (
                <div className="detail-source-list">
                  {a4af.data.sources.map((source) => (
                    <span key={source}>#{source}</span>
                  ))}
                </div>
              ) : null}
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
