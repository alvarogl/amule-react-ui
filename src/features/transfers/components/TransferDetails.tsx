import * as Dialog from "@radix-ui/react-dialog";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { api } from "@/shared/api/amule-api";

export function TransferDetails({ hash, name }: { hash: string; name: string }) {
  const detail = useQuery({
    queryKey: ["download", hash],
    queryFn: () => api.downloadDetail(hash),
  });
  const names = useQuery({
    queryKey: ["download-filenames", hash],
    queryFn: () => api.downloadFilenames(hash),
  });
  const comments = useQuery({
    queryKey: ["download-comments", hash],
    queryFn: () => api.downloadComments(hash),
  });
  const a4af = useQuery({
    queryKey: ["download-a4af", hash],
    queryFn: () => api.downloadA4af(hash),
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
                {data.status} ·{" "}
                {data.size ? `${(data.size / 1024 / 1024).toFixed(1)} MiB` : "Size unavailable"}
              </p>
              <h3>Alternate filenames</h3>
              <ul>
                {names.data?.filenames.map((item) => (
                  <li key={item.name}>
                    {item.name} <small>({item.count})</small>
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
              <p>{a4af.data?.a4af?.length ?? 0} asked-for-another-file source(s).</p>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
