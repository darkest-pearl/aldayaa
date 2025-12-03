'use client';

import { useState } from 'react';

export default function ConfirmDialog({ title = 'Are you sure?', description, onConfirm, confirmLabel = 'Confirm', trigger }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleConfirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div onClick={() => setOpen(true)} className="inline-flex">
        {trigger || (
          <button className="text-sm text-red-600 underline-offset-4 hover:underline">{confirmLabel}</button>
        )}
      </div>
      {open && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-neutral-900">{title}</h3>
              {description && <p className="text-sm text-neutral-600">{description}</p>}
            </div>
            <div className="mt-6 flex justify-end gap-3 text-sm">
              <button
                type="button"
                className="rounded-lg border border-neutral-200 px-4 py-2 font-medium text-neutral-700 hover:bg-neutral-50"
                onClick={() => setOpen(false)}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg bg-red-600 px-4 py-2 font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={handleConfirm}
                disabled={busy}
              >
                {busy ? 'Working...' : confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}