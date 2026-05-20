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
  } catch (err) {
    throw new Error('Invalid server response');
  }

  if (!data?.success) {
    throw new Error(data?.error || 'Request failed');
  }
  return data.data;
}

export default function OrdersClient() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [contextFilter, setContextFilter] = useState('ALL');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const load = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const data = await apiRequest('/api/orders');
      setOrders(data.orders || []);
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
      await apiRequest('/api/orders', {
        method: 'PUT',
        body: JSON.stringify({ id, status }),
      });
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const deleteOrder = async (id) => {
    try {
      await apiRequest('/api/orders', {
        method: 'DELETE',
        body: JSON.stringify({ id }),
      });
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const filteredOrders = useMemo(() => {
    return (orders || []).filter((o) => {
      const query = search.toLowerCase().trim();

      if (query) {
        const haystack = [
          o.name,
          o.phone,
          o.deliveryType,
          o.orderContext,
          o.orderSource,
          o.createdByAdminEmail,
          o.tableLabel,
          o.tableSlug,
          o.table?.label,
          o.table?.zone,
          o.address,
          o.notes,
          o.id,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(query)) return false;
      }

      if (statusFilter !== 'ALL' && o.status !== statusFilter) return false;
      if (typeFilter !== 'ALL' && o.deliveryType !== typeFilter) return false;
      if (contextFilter !== 'ALL' && (o.orderContext || 'STANDARD') !== contextFilter) return false;

      if (fromDate || toDate) {
        const createdAtTime = o.createdAt ? new Date(o.createdAt).getTime() : null;
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
  }, [orders, search, statusFilter, typeFilter, contextFilter, fromDate, toDate]);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Orders"
        description="View and manage incoming delivery and pickup orders."
      />

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <AdminCard title="Filters">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
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
              <option value="NEW">New</option>
              <option value="IN_PROGRESS">In progress</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-neutral-700">
              Type
            </label>
            <select
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="ALL">All</option>
              <option value="DELIVERY">Delivery</option>
              <option value="PICKUP">Pickup</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-neutral-700">
              Context
            </label>
            <select
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
              value={contextFilter}
              onChange={(e) => setContextFilter(e.target.value)}
            >
              <option value="ALL">All</option>
              <option value="STANDARD">Standard</option>
              <option value="TABLE">Table</option>
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
        title="Orders list"
        actions={
          loading ? (
            <span className="text-xs text-neutral-500">Loading…</span>
          ) : null
        }
      >
        <div className="-mx-4 overflow-x-auto sm:mx-0">
          <AdminTable
            columns={[
              { key: 'createdAt', header: 'When' },
               {
                key: 'name',
                header: 'Customer',
                render: (_val, order) => (
                  <div>
                    <div>{order.name}</div>
                    {order.address && (
                      <p className="mt-1 text-xs text-neutral-500">
                        {order.address}
                      </p>
                    )}
                  </div>
                ),
              },
              { key: 'phone', header: 'Phone' },
              { key: 'deliveryType', header: 'Type' },
              {
                key: 'orderContext',
                header: 'Context',
                render: (_val, order) => {
                  const context = order.orderContext || 'STANDARD';
                  const tableLabel = order.tableLabel || order.table?.label || order.tableSlug;
                  const tableZone = order.table?.zone;

                  return (
                    <div>
                      <span
                        className={
                          context === 'TABLE'
                            ? 'rounded-full bg-primary/15 px-2 py-1 text-xs font-semibold text-secondary'
                            : 'rounded-full bg-neutral-100 px-2 py-1 text-xs font-semibold text-neutral-700'
                        }
                      >
                        {context === 'TABLE' ? 'Table order' : 'Standard'}
                      </span>
                      {context === 'TABLE' && tableLabel && (
                        <p className="mt-1 text-xs text-neutral-500">
                          Table: {tableLabel}
                        </p>
                      )}
                      {context === 'TABLE' && tableZone && (
                        <p className="text-xs text-neutral-500">
                          Zone: {tableZone}
                        </p>
                      )}
                    </div>
                  );
                },
              },
              {
                key: 'orderSource',
                header: 'Source',
                render: (_val, order) => {
                  const isStaffAssisted = order.orderSource === 'STAFF_ASSISTED';

                  return (
                    <div>
                      <span
                        className={
                          isStaffAssisted
                            ? 'rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800'
                            : 'rounded-full bg-neutral-100 px-2 py-1 text-xs font-semibold text-neutral-700'
                        }
                      >
                        {isStaffAssisted ? 'Staff-assisted' : 'Customer'}
                      </span>
                      {isStaffAssisted && order.createdByAdminEmail && (
                        <p className="mt-1 text-xs text-neutral-500">
                          {order.createdByAdminEmail}
                        </p>
                      )}
                    </div>
                  );
                },
              },
              { key: 'totalPrice', header: 'Total (AED)' },
              {
                key: 'status',
                header: 'Status',
                render: (val, row) => (
                  <select
                    className="min-h-[36px] rounded-lg border border-neutral-200 px-2.5 py-1.5 text-xs focus:border-primary focus:outline-none"
                    value={row.status}
                    onChange={(e) => updateStatus(row.id, e.target.value)}
                  >
                    <option value="NEW">New</option>
                    <option value="IN_PROGRESS">In progress</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                ),
              },
              {
                key: 'items',
                header: 'Items',
                render: (_val, row) => (
                  <div className="text-xs text-neutral-700">
                    {row.items?.map((it) => (
                      <div key={it.id}>
                        {it.quantity} × {it.name} (AED {it.price})
                      </div>
                    )) || <span className="text-neutral-400">None</span>}
                  </div>
                ),
              },
              {
                key: 'actions',
                header: 'Actions',
                render: (_val, row) => (
                  <div className="flex flex-wrap gap-2 text-xs font-semibold">
                    <ConfirmDialog
                      confirmLabel="Delete"
                      description={`Delete order from ${row.name}?`}
                      onConfirm={() => deleteOrder(row.id)}
                      trigger={
                        <button className="min-h-[36px] rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50">
                          Delete
                        </button>
                      }
                    />
                  </div>
                ),
              },
            ]}
            rows={filteredOrders.map((o) => ({
              ...o,
              createdAt: o.createdAt
                ? new Date(o.createdAt).toLocaleString()
                : '',
          totalPrice:
                typeof o.totalPrice === 'number'
                  ? o.totalPrice.toFixed(2)
                  : '',
            }))}
            emptyMessage={loading ? 'Loading orders…' : 'No orders found'}
            dense
          />
        </div>
      </AdminCard>

    </div>
  );
}
