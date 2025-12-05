'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import AdminCard from '../../components/AdminCard.jsx';
import AdminPageHeader from '../../components/AdminPageHeader.jsx';
import AdminTable from '../../components/AdminTable.jsx';
import ConfirmDialog from '../../components/ConfirmDialog.jsx';

async function apiRequest(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    throw new Error('Invalid server response');
  }

  if (!data?.success) {
    throw new Error(data?.error || 'Request failed');
  }
  return data.data;
}

export default function ReservationsClient() {
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [dateFilter, setDateFilter] = useState('ALL'); // ALL | TODAY | FUTURE | PAST
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const load = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const data = await apiRequest('/api/reservations');
      setReservations(data.reservations || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const interval = setInterval(() => {
      load(false);
    }, 5000);

    return () => clearInterval(interval);
  }, [load]);

  const updateStatus = async (id, status) => {
    try {
      await apiRequest('/api/reservations', {
        method: 'PUT',
        body: JSON.stringify({ id, status }),
      });
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const deleteReservation = async (id) => {
    try {
      await apiRequest('/api/reservations', {
        method: 'DELETE',
        body: JSON.stringify({ id }),
      });
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const filteredReservations = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);

    return (reservations || []).filter((r) => {
      const q = search.toLowerCase().trim();
      if (q) {
        const haystack = [r.name, r.phone, r.email, r.specialRequests]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;

      if (dateFilter !== 'ALL') {
        if (!r.date) return false;
        if (dateFilter === 'TODAY' && r.date !== todayStr) return false;
        if (dateFilter === 'FUTURE' && r.date <= todayStr) return false;
        if (dateFilter === 'PAST' && r.date >= todayStr) return false;
      }

      if (fromDate || toDate) {
        const createdAtTime = r.createdAt
          ? new Date(r.createdAt).getTime()
          : null;
        if (!createdAtTime) return false;

        if (fromDate) {
          const from = new Date(fromDate);
          from.setHours(0, 0, 0, 0);
          if (createdAtTime < from.getTime()) return false;
        }

        if (toDate) {
          const to = new Date(toDate);
          to.setHours(23, 59, 59, 999);
          if (createdAtTime > to.getTime()) return false;
        }
      }
      
      return true;
    });
  }, [reservations, search, statusFilter, dateFilter, fromDate, toDate]);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Reservations"
        description="Confirm, update, or cancel table bookings."
      />

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <AdminCard title="Filters">
        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-neutral-700">
              Search
            </label>
            <input
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
              placeholder="Search by name, phone, notes…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-neutral-700">
              Status
            </label>
            <select
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">All</option>
              <option value="PENDING">Pending</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="NO_SHOW">No-show</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-neutral-700">
              Date filter
            </label>
            <select
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            >
              <option value="ALL">All dates</option>
              <option value="TODAY">Today</option>
              <option value="FUTURE">Upcoming only</option>
              <option value="PAST">Past only</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-neutral-700">
              From date
            </label>
            <input
              type="date"
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-neutral-700">
              To date
            </label>
            <input
              type="date"
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>
        </div>
      </AdminCard>

      <AdminCard
        title="Reservations list"
        actions={
          loading ? (
            <span className="text-xs text-neutral-500">Loading…</span>
          ) : null
        }
      >
        <AdminTable
          columns={[
            { key: 'date', header: 'Date' },
            { key: 'time', header: 'Time' },
            { key: 'name', header: 'Guest' },
            { key: 'phone', header: 'Phone' },
            { key: 'guests', header: 'Guests' },
            {
              key: 'status',
              header: 'Status',
              render: (val, row) => (
                <select
                  className="rounded-lg border border-neutral-200 px-2 py-1 text-xs focus:border-primary focus:outline-none"
                  value={row.status}
                  onChange={(e) => updateStatus(row.id, e.target.value)}
                >
                  <option value="PENDING">Pending</option>
                  <option value="CONFIRMED">Confirmed</option>
                  <option value="CANCELLED">Cancelled</option>
                  <option value="NO_SHOW">No-show</option>
                </select>
              ),
            },
            {
              key: 'specialRequests',
              header: 'Notes',
              render: (val) =>
                val ? (
                  <span className="text-xs text-neutral-700">{val}</span>
                ) : (
                  <span className="text-xs text-neutral-400">—</span>
                ),
            },
            {
              key: 'actions',
              header: 'Actions',
              render: (_val, row) => (
                <ConfirmDialog
                  confirmLabel="Delete"
                  description={`Delete reservation for ${row.name} on ${row.date}?`}
                  onConfirm={() => deleteReservation(row.id)}
                />
              ),
            },
          ]}
          rows={filteredReservations}
          emptyMessage={
            loading ? 'Loading reservations…' : 'No reservations found'
          }
        />
      </AdminCard>

    </div>
  );
}
