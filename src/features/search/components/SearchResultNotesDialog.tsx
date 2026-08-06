import * as Dialog from "@radix-ui/react-dialog";
import { LoaderCircle, MessageSquare } from "lucide-react";
import { type SearchResult } from "@/shared/api/amule-api";

export function SearchResultNotesDialog({
  result,
  onRequest,
  requesting,
}: {
  result: SearchResult;
  onRequest: () => void;
  requesting: boolean;
}) {
  const comments = result.comments ?? [];
  const searchRunning = result.kad_comment_search_running || requesting;
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button className="icon" aria-label={`View Kad notes for ${result.name}`} title="Kad notes">
          <MessageSquare size={15} />
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="confirm-overlay" />
        <Dialog.Content className="confirm-dialog search-notes-dialog">
          <Dialog.Title>Kad notes</Dialog.Title>
          <Dialog.Description>{result.name}</Dialog.Description>
          <div className="search-notes-actions">
            <span>
              {result.rating === undefined ? "No aggregate rating" : `Rating: ${result.rating}`}
            </span>
            <button disabled={searchRunning} onClick={onRequest}>
              {searchRunning && <LoaderCircle className="spin" size={15} />}
              {searchRunning ? "Looking up notes…" : "Look up Kad notes"}
            </button>
          </div>
          {comments.length ? (
            <ul className="search-notes-list">
              {comments.map((comment, index) => (
                <li key={`${comment.username}-${comment.filename}-${index}`}>
                  <strong>{comment.username}</strong>
                  <span>Rating: {comment.rating}</span>
                  <p>{comment.comment || "No comment provided."}</p>
                  {comment.filename && <small>{comment.filename}</small>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty">No Kad notes are available yet.</p>
          )}
          <div className="confirm-actions">
            <Dialog.Close asChild>
              <button className="muted">Close</button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
