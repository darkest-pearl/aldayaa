'use client';

import clsx from 'clsx';

export default function AdminTable({ columns, rows, emptyMessage = 'No records found', dense }) {
  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table
          className={clsx(
            'min-w-full text-left text-sm',
            dense ? 'leading-tight' : 'leading-6'
          )}
        >
          <thead className="bg-neutral-50 text-neutral-700">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={clsx(
                    'font-semibold',
                    dense
                      ? 'px-3 py-2 sm:px-3.5 sm:py-2.5'
                      : 'px-3.5 py-2.5 sm:px-5 sm:py-3'
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 text-neutral-800">
            {rows.length === 0 ? (
              <tr>
                <td
                  className={clsx(
                    'text-center text-neutral-500',
                    dense ? 'px-3 py-4' : 'px-4 py-5'
                  )}
                  colSpan={columns.length}
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id || JSON.stringify(row)} className="hover:bg-neutral-50">
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={clsx(
                        'align-top',
                        dense ? 'px-3 py-2 sm:px-3.5 sm:py-2.5' : 'px-3.5 py-2.5 sm:px-5 sm:py-3'
                      )}
                    >
                      {col.render ? col.render(row[col.key], row) : row[col.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}