'use client';

export default function AdminForm({ onSubmit, children, submitLabel = 'Save', submitting, secondaryAction }) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {children}
      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? 'Saving...' : submitLabel}
        </button>
        {secondaryAction}
      </div>
    </form>
  );
}