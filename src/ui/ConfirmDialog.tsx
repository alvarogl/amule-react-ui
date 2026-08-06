import * as AlertDialog from "@radix-ui/react-alert-dialog";
import type { ReactElement } from "react";

export function ConfirmDialog({
  trigger,
  title,
  description,
  actionLabel,
  dangerous = false,
  onConfirm,
}: {
  trigger: ReactElement;
  title: string;
  description: string;
  actionLabel: string;
  dangerous?: boolean;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger asChild>{trigger}</AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="confirm-overlay" />
        <AlertDialog.Content className="confirm-dialog">
          <AlertDialog.Title>{title}</AlertDialog.Title>
          <AlertDialog.Description>{description}</AlertDialog.Description>
          <div className="confirm-actions">
            <AlertDialog.Cancel asChild>
              <button className="muted">Cancel</button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <button className={dangerous ? "confirm-danger" : ""} onClick={onConfirm}>
                {actionLabel}
              </button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
