'use client';

import { useEffect, useMemo, useState } from 'react';

const reservationStatuses = ['PENDING', 'CONFIRMED', 'CANCELLED', 'NO_SHOW'];
const statusLabels = {
  PENDING: 'Pending',
  CONFIRMED: 'Confirmed',
  CANCELLED: 'Cancelled',
  NO_SHOW: 'No-show',
};

const inputClass = 'rounded-md border border-neutral-200 px-3 py-2 text-sm outline-none transition focus:border-emerald-700 disabled:bg-neutral-50 disabled:text-neutral-500';

function canWrite(role) {
  return role === 'OWNER' || role === 'MANAGER';
}

async function apiRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const payload = await response.json();
  if (!payload?.success) throw new Error(payload?.error || 'Request failed');
  return payload.data;
}

function formatCreatedAt(value) {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not recorded';
  return date.toLocaleString();
}

export default function TenantReservationsClient({ restaurantSlug, staffRole }) {
  const writable = canWrite(staffRole);
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [dateFilter, setDateFilter] = useState('ALL');

  async function load(showLoading = true) {
    if (showLoading) setLoading(true);
    setError('');
    try {
      const data = await apiRequest(`/api/restaurant-admin/reservations?restaurantSlug=${encodeURIComponent(restaurantSlug)}`);
      setReservations(data.reservations || []);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantSlug]);

  async function updateStatus(reservation, status) {
    if (!writable || reservation.status === status) return;
    setSavingId(reservation.id);
    setError('');
    setSuccessMessage('');
    try {
      await apiRequest(`/api/restaurant-admin/reservations/${reservation.id}`, {
        method: 'PUT',
        body: JSON.stringify({ restaurantSlug, status }),
      });
      setSuccessMessage(`Reservation ${reservation.reference} updated.`);
      await load(false);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSavingId('');
    }
  }

  const filteredReservations = useMemo(() => {
    const query = search.trim().toLowerCase();
    const today = new Date().toISOString().slice(0, 10);

    return reservations.filter((reservation) => {
      if (query) {
        const haystack = [
          reservation.reference,
          reservation.name,
          reservation.phone,
          reservation.email,
          reservation.specialRequests,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(query)) return false;
      }

      if (statusFilter !== 'ALL' && reservation.status !== statusFilter) return false;
      if (dateFilter === 'TODAY' && reservation.date !== today) return false;
      if (dateFilter === 'UPCOMING' && reservation.date < today) return false;
      if (dateFilter === 'PAST' && reservation.date >= today) return false;

      return true;
    });
  }, [dateFilter, reservations, search, statusFilter]);

  const counts = useMemo(() => {
    return reservationStatuses.reduce((accumulator, status) => {
      accumulator[status] = reservations.filter((reservation) => reservation.status === status).length;
      return accumulator;
    }, {});
  }, [reservations]);

  return (
    <div className="space-y-5">
      {error ? <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div> : null}
      {successMessage ? <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{successMessage}</div> : null}
      {loading ? <div className="rounded-md border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-600">Loading reservations...</div> : null}
      {!writable ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          SUPPORT access is read-only. OWNER or MANAGER access is required to update reservation status.
        </div>
      ) : null}

      <section className="grid gap-3 md:grid-cols-5">
        <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-normal text-neutral-500">Total</p>
          <p className="mt-1 text-2xl font-semibold">{reservations.length}</p>
        </div>
        {reservationStatuses.map((status) => (
          <div key={status} className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-normal text-neutral-500">{statusLabels[status]}</p>
            <p className="mt-1 text-2xl font-semibold">{counts[status] || 0}</p>
          </div>
        ))}
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-3">
          <input
            className={inputClass}
            placeholder="Search name, phone, reference, notes"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select className={inputClass} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="ALL">All statuses</option>
            {reservationStatuses.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}
          </select>
          <select className={inputClass} value={dateFilter} onChange={(event) => setDateFilter(event.target.value)}>
            <option value="ALL">All dates</option>
            <option value="TODAY">Today</option>
            <option value="UPCOMING">Upcoming</option>
            <option value="PAST">Past</option>
          </select>
        </div>
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-lg font-semibold">Reservation list</h3>
            <p className="mt-1 text-sm text-neutral-600">Status updates stay scoped to this restaurant. No email or WhatsApp messages are sent.</p>
          </div>
          <button
            type="button"
            onClick={() => load(false)}
            className="rounded-md border border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-700"
          >
            Refresh
          </button>
        </div>
        <div className="mt-4 grid gap-3">
          {filteredReservations.length ? filteredReservations.map((reservation) => (
            <article key={reservation.id} className="rounded-md border border-neutral-100 p-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{reservation.name}</p>
                    <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-700">{reservation.reference}</span>
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">{statusLabels[reservation.status] || reservation.status}</span>
                  </div>
                  <div className="mt-2 grid gap-1 text-sm text-neutral-600 md:grid-cols-2">
                    <p>{reservation.date || 'No date'} at {reservation.time || 'No time'}</p>
                    <p>{reservation.guests} guests</p>
                    <p>{reservation.phone}</p>
                    <p>{reservation.email || 'No email'}</p>
                  </div>
                  {reservation.specialRequests ? (
                    <p className="mt-2 rounded-md bg-neutral-50 px-3 py-2 text-sm text-neutral-700">{reservation.specialRequests}</p>
                  ) : null}
                  <p className="mt-2 text-xs text-neutral-500">Created: {formatCreatedAt(reservation.createdAt)}</p>
                </div>
                <div className="min-w-[180px]">
                  <label className="text-xs font-semibold uppercase tracking-normal text-neutral-500">Status</label>
                  <select
                    className={`${inputClass} mt-1 w-full`}
                    value={reservation.status}
                    disabled={!writable || savingId === reservation.id}
                    onChange={(event) => updateStatus(reservation, event.target.value)}
                  >
                    {reservationStatuses.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}
                  </select>
                </div>
              </div>
            </article>
          )) : (
            <p className="rounded-md border border-dashed border-neutral-200 px-4 py-6 text-center text-sm text-neutral-500">
              {loading ? 'Loading reservations...' : 'No reservations found'}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
