"use client";

import { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "announcement:dismissed";

function getAnnouncementKey(announcement) {
  if (!announcement?.id || !announcement?.updatedAt) return null;
  return `${announcement.id}:${announcement.updatedAt}`;
}

export default function AnnouncementBanner({ announcement }) {
  const announcementKey = useMemo(
    () => getAnnouncementKey(announcement),
    [announcement?.id, announcement?.updatedAt],
  );
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!announcementKey) return;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      setDismissed(stored === announcementKey);
    } catch (error) {
      console.warn("Unable to read announcement dismissal", error);
    }
  }, [announcementKey]);

  if (!announcement?.message || !announcementKey || dismissed) {
    return null;
  }

  const handleClose = () => {
    try {
      localStorage.setItem(STORAGE_KEY, announcementKey);
    } catch (error) {
      console.warn("Unable to persist announcement dismissal", error);
    }
    setDismissed(true);
  };

  return (
    <div className="w-full border-b border-amber-100 bg-amber-50 text-amber-900" role="status" aria-live="polite">
      <div className="site-container flex items-center justify-between gap-4 py-2 text-sm">
        <p className="font-medium">{announcement.message}</p>
        <button
          type="button"
          onClick={handleClose}
          className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-amber-200 bg-amber-100 text-base font-semibold leading-none text-amber-900 transition hover:bg-amber-200"
          aria-label="Dismiss announcement"
        >
          ×
        </button>
      </div>
    </div>
  );
}