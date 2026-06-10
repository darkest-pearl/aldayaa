'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ORDER_CONTEXTS,
  ORDER_SOURCES,
  ORDER_STATUSES,
  canTransitionOrderStatus,
  getOrderContextLabel,
  getOrderSourceLabel,
  getOrderStatusLabel,
} from '../../../../../lib/order-status';

const orderStatusOptions = Object.values(ORDER_STATUSES);
const orderContextOptions = Object.values(ORDER_CONTEXTS);
const inputClass = 'rounded-md border border-neutral-200 px-3 py-2 text-sm outline-none transition focus:border-emerald-700 disabled:bg-neutral-50 disabled:text-neutral-500';

const statusBadgeClasses = {
  [ORDER_STATUSES.NEW]: 'bg-blue-50 text-blue-700',
  [ORDER_STATUSES.IN_PROGRESS]: 'bg-amber-50 text-amber-800',
  [ORDER_STATUSES.COMPLETED]: 'bg-emerald-50 text-emerald-800',
  [ORDER_STATUSES.CANCELLED]: 'bg-red-50 text-red-700',
};

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

function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'AED',
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not recorded';
  return date.toLocaleString();
}

export default function TenantOrdersClient({ restaurantSlug, staffRole }) {
  const writable = canWrite(staffRole);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [contextFilter, setContextFilter] = useState('ALL');
  const [dateFilter, setDateFilter] = useState('ALL');

  async function load(showLoading = true) {
    if (showLoading) setLoading(true);
    setError('');
    try {
      const data = await apiRequest(`/api/restaurant-admin/orders?restaurantSlug=${encodeURIComponent(restaurantSlug)}`);
      setOrders(data.orders || []);
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

  async function updateStatus(order, status) {
    if (!writable || order.status === status) return;
    setSavingId(order.id);
    setError('');
    setSuccessMessage('');
    try {
      await apiRequest(`/api/restaurant-admin/orders/${order.id}`, {
        method: 'PUT',
        body: JSON.stringify({ restaurantSlug, status }),
      });
      setSuccessMessage(`Order ${order.reference} updated.`);
      await load(false);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSavingId('');
    }
  }

  const filteredOrders = useMemo(() => {
    const query = search.trim().toLowerCase();
    const today = new Date().toISOString().slice(0, 10);

    return orders.filter((order) => {
      if (query) {
        const haystack = [
          order.reference,
          order.name,
          order.phone,
          order.deliveryType,
          order.orderContext,
          order.orderSource,
          order.tableLabel,
          order.tableSlug,
          order.table?.label,
          order.table?.zone,
          order.address,
          order.notes,
          ...(order.items || []).map((item) => item.name),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(query)) return false;
      }

      if (statusFilter !== 'ALL' && order.status !== statusFilter) return false;
      if (contextFilter !== 'ALL' && (order.orderContext || ORDER_CONTEXTS.STANDARD) !== contextFilter) return false;

      const createdDate = order.createdAt ? order.createdAt.slice(0, 10) : '';
      if (dateFilter === 'TODAY' && createdDate !== today) return false;
      if (dateFilter === 'OLDER' && createdDate >= today) return false;

      return true;
    });
  }, [contextFilter, dateFilter, orders, search, statusFilter]);

  const counts = useMemo(() => {
    return orderStatusOptions.reduce((accumulator, status) => {
      accumulator[status] = orders.filter((order) => order.status === status).length;
      return accumulator;
    }, {});
  }, [orders]);

  return (
    <div className="space-y-5">
      {error ? <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div> : null}
      {successMessage ? <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{successMessage}</div> : null}
      {loading ? <div className="rounded-md border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-600">Loading orders...</div> : null}
      {!writable ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          SUPPORT access is read-only. OWNER or MANAGER access is required to update order status.
        </div>
      ) : null}
      <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950">
        This is status management only: public tenant ordering creates orders only when ONLINE_ORDERING is enabled, and no inventory, recipe, payment, email, or WhatsApp workflow is triggered.
      </div>

      <section className="grid gap-3 md:grid-cols-5">
        <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-normal text-neutral-500">Total</p>
          <p className="mt-1 text-2xl font-semibold">{orders.length}</p>
        </div>
        {orderStatusOptions.map((status) => (
          <div key={status} className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-normal text-neutral-500">{getOrderStatusLabel(status)}</p>
            <p className="mt-1 text-2xl font-semibold">{counts[status] || 0}</p>
          </div>
        ))}
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-4">
          <input
            className={inputClass}
            placeholder="Search customer, phone, reference, table, item"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select className={inputClass} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="ALL">All statuses</option>
            {orderStatusOptions.map((status) => <option key={status} value={status}>{getOrderStatusLabel(status)}</option>)}
          </select>
          <select className={inputClass} value={contextFilter} onChange={(event) => setContextFilter(event.target.value)}>
            <option value="ALL">All contexts</option>
            {orderContextOptions.map((context) => <option key={context} value={context}>{getOrderContextLabel(context)}</option>)}
          </select>
          <select className={inputClass} value={dateFilter} onChange={(event) => setDateFilter(event.target.value)}>
            <option value="ALL">All dates</option>
            <option value="TODAY">Today</option>
            <option value="OLDER">Older</option>
          </select>
        </div>
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-lg font-semibold">Order list</h3>
            <p className="mt-1 text-sm text-neutral-600">Status changes stay scoped to this restaurant. No messages or stock changes are sent.</p>
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
          {filteredOrders.length ? filteredOrders.map((order) => {
            const currentStatus = order.status || ORDER_STATUSES.NEW;
            const context = order.orderContext || ORDER_CONTEXTS.STANDARD;
            const source = order.orderSource || ORDER_SOURCES.CUSTOMER;
            return (
              <article key={order.id} className="rounded-md border border-neutral-100 p-3">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{order.name}</p>
                      <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-700">{order.reference}</span>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusBadgeClasses[currentStatus] || 'bg-neutral-100 text-neutral-700'}`}>
                        {getOrderStatusLabel(currentStatus)}
                      </span>
                    </div>
                    <div className="mt-2 grid gap-1 text-sm text-neutral-600 md:grid-cols-2">
                      <p>{formatDate(order.createdAt)}</p>
                      <p>{formatCurrency(order.totalPrice)}</p>
                      <p>{order.phone}</p>
                      <p>{order.deliveryType}</p>
                      <p>{getOrderContextLabel(context)}{order.tableLabel ? ` · ${order.tableLabel}` : ''}</p>
                      <p>{getOrderSourceLabel(source)}</p>
                    </div>
                    {order.address ? <p className="mt-2 rounded-md bg-neutral-50 px-3 py-2 text-sm text-neutral-700">{order.address}</p> : null}
                    {order.notes ? <p className="mt-2 rounded-md bg-neutral-50 px-3 py-2 text-sm text-neutral-700">{order.notes}</p> : null}
                    <div className="mt-3 rounded-md bg-neutral-50 px-3 py-2 text-sm text-neutral-700">
                      {(order.items || []).length ? order.items.map((item) => (
                        <div key={item.id} className="flex justify-between gap-3">
                          <span>{item.quantity} x {item.name}</span>
                          <span>{formatCurrency(item.price)}</span>
                        </div>
                      )) : <span className="text-neutral-500">No items recorded</span>}
                    </div>
                  </div>
                  <div className="min-w-[190px]">
                    <label className="text-xs font-semibold uppercase tracking-normal text-neutral-500">Status</label>
                    <select
                      className={`${inputClass} mt-1 w-full`}
                      value={currentStatus}
                      disabled={!writable || savingId === order.id}
                      onChange={(event) => updateStatus(order, event.target.value)}
                    >
                      {orderStatusOptions.map((status) => (
                        <option key={status} value={status} disabled={!canTransitionOrderStatus(currentStatus, status)}>
                          {getOrderStatusLabel(status)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </article>
            );
          }) : (
            <p className="rounded-md border border-dashed border-neutral-200 px-4 py-6 text-center text-sm text-neutral-500">
              {loading ? 'Loading orders...' : 'No orders found'}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
