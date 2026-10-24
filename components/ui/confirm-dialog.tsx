"use client";

import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { Button } from "@/components/ui/button";

export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel = "确认删除",
  onConfirm,
}: {
  trigger: React.ReactNode;
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => void | Promise<void>;
}) {
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger asChild>{trigger}</AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-[#18212f]/40 backdrop-blur-[2px]" />
        <AlertDialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[#dce1da] bg-white p-6 shadow-2xl">
          <AlertDialog.Title className="text-lg font-bold text-[#18212f]">{title}</AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-sm leading-6 text-[#687568]">{description}</AlertDialog.Description>
          <div className="mt-6 flex justify-end gap-2">
            <AlertDialog.Cancel asChild><Button variant="secondary">取消</Button></AlertDialog.Cancel>
            <AlertDialog.Action asChild><Button variant="danger" onClick={onConfirm}>{confirmLabel}</Button></AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
