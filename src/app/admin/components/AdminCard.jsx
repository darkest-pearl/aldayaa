'use client';

import clsx from 'clsx';

export default function AdminCard({ title, description, children, className, actions }) {
  return (
    <section
      className={clsx(
        'rounded-xl border border-neutral-200 bg-white shadow-sm transition hover:shadow-md',
        'p-4 sm:p-6',
        className
      )}
    >
      {(title || description || actions) && (
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {title && <h2 className="text-lg font-semibold text-neutral-900">{title}</h2>}
            {description && <p className="text-sm text-neutral-600">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}