'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  PAYMENT_PROVIDER_EVENT_STATUSES,
  PAYMENT_PROVIDER_MODES,
} from '../../../../../lib/payment-provider-events';

const inputClass = 'rounded-md border border-neutral-200 px-3 py-2 text-sm outline-none transition focus:border-emerald-700 disabled:bg-neutral-50 disabled:text-neutral-500';

const statusOptions = Object.values(PAYMENT_PROVIDER_EVENT_STATUSES);
const modeOptions = Object.values(PAYMENT_PROVIDER_MODES);

async function apiRequest(url) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
  });
  const payload = await response.json();
  if (!payload?.success) throw new Error(payload?.error || 'Request failed');
  return payload.data;
}

function formatDateTime(value) {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not recorded';
  return date.toLocaleString();
}

export default function TenantPaymentProviderEventsClient({ restaurantSlug }) {
  const [events, setEvents] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    provider: '',
    providerMode: '',
    eventType: '',
    status: '',
    from: '',
    to: '',
  });

  const queryString = useMemo(() => {
    const params = new URLSearchParams({ restaurantSlug });
    for (const [key, value] of Object.entries(filters)) {
      const cleaned = typeof value === 'string' ? value.trim() : '';
      if (cleaned) params.set(key, cleaned);
    }
    params.set('limit', '50');
    return params.toString();
  }, [filters, restaurantSlug]);

  async function load(showLoading = true) {
    if (showLoading) setLoading(true);
    setError('');
    try {
      const data = await apiRequest(`/api/restaurant-admin/payment-provider-events?${queryString}`);
      setEvents(data.events || []);
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

  function updateFilter(field, value) {
    setFilters((current) => ({ ...current, [field]: value }));
  }

  return (
    <div className="space-y-5">
      {error ? <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div> : null}
      {loading ? <div className="rounded-md border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-600">Loading payment events...</div> : null}

      <section className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-950">
        <p className="font-semibold">Provider event tracking is a foundation only.</p>
        <p>No webhook endpoint is active.</p>
        <p>No real payment processing occurs.</p>
        <p>No refunds or checkout sessions are created.</p>
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-3">
          <input className={inputClass} placeholder="Provider" value={filters.provider} onChange={(event) => updateFilter('provider', event.target.value)} />
          <select className={inputClass} value={filters.providerMode} onChange={(event) => updateFilter('providerMode', event.target.value)}>
            <option value="">All modes</option>
            {modeOptions.map((mode) => <option key={mode} value={mode}>{mode}</option>)}
          </select>
          <input className={inputClass} placeholder="Event type" value={filters.eventType} onChange={(event) => updateFilter('eventType', event.target.value)} />
          <select className={inputClass} value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}>
            <option value="">All statuses</option>
            {statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
          <input className={inputClass} type="date" value={filters.from} onChange={(event) => updateFilter('from', event.target.value)} />
          <input className={inputClass} type="date" value={filters.to} onChange={(event) => updateFilter('to', event.target.value)} />
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-xs text-neutral-500">Both dates are required when filtering by date. Results are tenant-scoped and sanitized.</p>
          <button type="button" onClick={() => load(false)} disabled={loading} className="rounded-md border border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-700 disabled:cursor-not-allowed disabled:opacity-50">
            Refresh
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-neutral-50 text-xs uppercase tracking-normal text-neutral-500">
            <tr>
              <th className="px-3 py-2 font-semibold">Received</th>
              <th className="px-3 py-2 font-semibold">Provider</th>
              <th className="px-3 py-2 font-semibold">Mode</th>
              <th className="px-3 py-2 font-semibold">Event</th>
              <th className="px-3 py-2 font-semibold">Status</th>
              <th className="px-3 py-2 font-semibold">Related</th>
              <th className="px-3 py-2 font-semibold">Metadata</th>
            </tr>
          </thead>
          <tbody>
            {events.length ? events.map((event) => (
              <tr key={event.id} className="border-t border-neutral-100 align-top">
                <td className="px-3 py-2">{formatDateTime(event.receivedAt)}</td>
                <td className="px-3 py-2 font-semibold">{event.provider || 'Provider'}</td>
                <td className="px-3 py-2">{event.providerMode}</td>
                <td className="px-3 py-2">
                  <span className="block font-semibold">{event.eventType || 'Event'}</span>
                  <span className="block text-xs text-neutral-500">{event.providerEventId}</span>
                </td>
                <td className="px-3 py-2">{event.status}</td>
                <td className="px-3 py-2">
                  {event.relatedEntityType ? `${event.relatedEntityType}: ${event.relatedEntityId || 'Not recorded'}` : 'Not recorded'}
                </td>
                <td className="max-w-[260px] px-3 py-2 text-xs text-neutral-600">
                  {event.metadataSummary || 'No sanitized metadata.'}
                </td>
              </tr>
            )) : (
              <tr>
                <td className="px-3 py-6 text-center text-neutral-500" colSpan={7}>
                  {loading ? 'Loading payment events...' : 'No payment provider events match the current filters.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
      {hasMore ? <p className="text-xs text-neutral-500">More events are available. Narrow filters to inspect older records.</p> : null}
    </div>
  );
}
