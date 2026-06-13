'use client';

import { useEffect, useMemo, useState } from 'react';

const inputClass = 'rounded-md border border-neutral-200 px-3 py-2 text-sm outline-none transition focus:border-emerald-700 disabled:bg-neutral-50 disabled:text-neutral-500';

async function apiRequest(url) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
  });
  const payload = await response.json();
  if (!payload?.success) throw new Error(payload?.error || 'Request failed');
  return payload.data;
}

function formatDate(value) {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not recorded';
  return date.toLocaleString();
}

function formatMetadataSummary(value) {
  if (!value) return 'No metadata';
  return value.length > 180 ? `${value.slice(0, 180)}...` : value;
}

export default function TenantAuditLogsClient({ restaurantSlug }) {
  const [logs, setLogs] = useState([]);
  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hasMore, setHasMore] = useState(false);

  const queryString = useMemo(() => {
    const params = new URLSearchParams({ restaurantSlug, limit: '100' });
    if (action.trim()) params.set('action', action.trim());
    if (entityType.trim()) params.set('entityType', entityType.trim());
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    return params.toString();
  }, [action, entityType, from, restaurantSlug, to]);

  async function load(showLoading = true) {
    if (showLoading) setLoading(true);
    setError('');
    try {
      const data = await apiRequest(`/api/restaurant-admin/audit-logs?${queryString}`);
      setLogs(data.logs || []);
      setHasMore(Boolean(data.hasMore));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryString]);

  return (
    <div className="space-y-5">
      {error ? <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div> : null}
      {loading ? <div className="rounded-md border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-600">Loading audit logs...</div> : null}

      <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-950">
        Audit logs are read-only. Logs are tenant-scoped. No external logging or alerting is connected.
      </div>

      <section className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-5">
          <input className={inputClass} placeholder="Action" value={action} onChange={(event) => setAction(event.target.value)} />
          <input className={inputClass} placeholder="Entity type" value={entityType} onChange={(event) => setEntityType(event.target.value)} />
          <input className={inputClass} type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          <input className={inputClass} type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          <button type="button" onClick={() => load(false)} disabled={loading} className="rounded-md border border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-700 disabled:cursor-not-allowed disabled:opacity-50">
            Refresh
          </button>
        </div>
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Tenant audit history</h2>
            <p className="mt-1 text-sm text-neutral-600">Most recent matching audit entries for this restaurant.</p>
          </div>
          {hasMore ? <p className="text-xs font-semibold text-amber-700">Showing first 100 matching entries.</p> : null}
        </div>
        <div className="mt-4 overflow-hidden rounded-md border border-neutral-100">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-50 text-xs uppercase tracking-normal text-neutral-500">
              <tr>
                <th className="px-3 py-2 font-semibold">When</th>
                <th className="px-3 py-2 font-semibold">Actor</th>
                <th className="px-3 py-2 font-semibold">Action</th>
                <th className="px-3 py-2 font-semibold">Entity</th>
                <th className="px-3 py-2 font-semibold">Summary</th>
                <th className="px-3 py-2 font-semibold">Metadata</th>
              </tr>
            </thead>
            <tbody>
              {logs.length ? logs.map((log) => (
                <tr key={log.id} className="border-t border-neutral-100 align-top">
                  <td className="px-3 py-2 text-neutral-600">{formatDate(log.createdAt)}</td>
                  <td className="px-3 py-2">
                    <span className="block font-semibold">{log.actorEmail || 'System'}</span>
                    <span className="text-xs text-neutral-500">{log.actorRole || 'No role'}</span>
                  </td>
                  <td className="px-3 py-2 font-semibold">{log.action}</td>
                  <td className="px-3 py-2">
                    <span className="block font-semibold">{log.entityType}</span>
                    <span className="break-all text-xs text-neutral-500">{log.entityId || 'No entity id'}</span>
                  </td>
                  <td className="px-3 py-2">{log.summary}</td>
                  <td className="px-3 py-2 text-xs text-neutral-600">{formatMetadataSummary(log.metadataSummary)}</td>
                </tr>
              )) : (
                <tr>
                  <td className="px-3 py-6 text-center text-neutral-500" colSpan={6}>
                    {loading ? 'Loading audit logs...' : 'No audit logs match the current filters.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
