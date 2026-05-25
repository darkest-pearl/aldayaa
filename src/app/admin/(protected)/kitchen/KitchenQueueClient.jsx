'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import AdminCard from '../../components/AdminCard.jsx';
import AdminPageHeader from '../../components/AdminPageHeader.jsx';
import {
  ORDER_STATUSES,
  canTransitionOrderStatus,
  getOrderContextLabel,
  getOrderSourceLabel,
  getOrderStatusLabel,
} from '../../../../lib/order-status';

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
  } catch (error) {
    throw new Error('Invalid server response');
  }

  if (!data?.success) {
    throw new Error(data?.error || 'Request failed');
  }
  return data.data;
}

const KITCHEN_ACTIONS = [
  ORDER_STATUSES.IN_PROGRESS,
  ORDER_STATUSES.COMPLETED,
  ORDER_STATUSES.CANCELLED,
];

const STATUS_BADGE_CLASSES = {
  [ORDER_STATUSES.NEW]: 'bg-blue-50 text-blue-700 ring-blue-200',
  [ORDER_STATUSES.IN_PROGRESS]: 'bg-amber-50 text-amber-800 ring-amber-200',
};

function getStatusBadgeClass(status) {
  return STATUS_BADGE_CLASSES[status] || 'bg-neutral-100 text-neutral-700 ring-neutral-200';
}

function formatCreatedAt(value) {
  if (!value) return '';
  return new Date(value).toLocaleString();
}

export default function KitchenQueueClient() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  const load = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const data = await apiRequest('/api/admin/kitchen/orders');
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
    }, 15000);

    return () => clearInterval(interval);
  }, [load]);

  const activeOrders = useMemo(() => {
    return (orders || []).filter((order) =>
      [ORDER_STATUSES.NEW, ORDER_STATUSES.IN_PROGRESS].includes(order.status),
    );
  }, [orders]);

  const updateStatus = async (order, status) => {
    setUpdatingId(order.id);
    setError(null);
    setMessage(null);

    try {
      await apiRequest('/api/orders', {
        method: 'PUT',
        body: JSON.stringify({ id: order.id, status }),
      });
      setMessage(`Order ${order.reference} moved to ${getOrderStatusLabel(status)}.`);
      await load(false);
    } catch (err) {
      setError(`Status update failed: ${err.message}`);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Kitchen queue"
        description="Active orders that need preparation. This is a simple queue, not a full kitchen display system."
      />

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}
      {message && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div>
      )}

      <AdminCard
        title="Active orders"
        description="Shows NEW and IN_PROGRESS orders only. Completed and cancelled orders are excluded."
        actions={
          <button
            type="button"
            className="rounded-lg border border-neutral-200 px-3 py-2 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
            onClick={() => load()}
            disabled={loading}
          >
            Refresh
          </button>
        }
      >
        {loading && activeOrders.length === 0 ? (
          <p className="text-sm text-neutral-500">Loading kitchen queue...</p>
        ) : activeOrders.length === 0 ? (
          <p className="text-sm text-neutral-500">No active kitchen orders.</p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {activeOrders.map((order) => {
              const status = order.status || ORDER_STATUSES.NEW;
              const tableLabel = order.tableLabel || order.table?.label || order.tableSlug;
              const tableZone = order.table?.zone;
              const availableActions = KITCHEN_ACTIONS.filter((nextStatus) =>
                canTransitionOrderStatus(status, nextStatus),
              );

              return (
                <article
                  key={order.id}
                  className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">
                        {order.reference || order.id}
                      </p>
                      <h2 className="mt-1 text-lg font-semibold text-neutral-900">{order.name}</h2>
                      <p className="text-xs text-neutral-500">{formatCreatedAt(order.createdAt)}</p>
                      {order.phone && <p className="mt-1 text-sm text-neutral-700">{order.phone}</p>}
                    </div>
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${getStatusBadgeClass(status)}`}>
                      {getOrderStatusLabel(status)}
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
                    <span className="rounded-full bg-neutral-100 px-2 py-1 text-neutral-700">
                      {getOrderContextLabel(order.orderContext)}
                    </span>
                    <span className="rounded-full bg-neutral-100 px-2 py-1 text-neutral-700">
                      {getOrderSourceLabel(order.orderSource)}
                    </span>
                    {tableLabel && (
                      <span className="rounded-full bg-primary/15 px-2 py-1 text-secondary">
                        {tableLabel}{tableZone ? ` - ${tableZone}` : ''}
                      </span>
                    )}
                  </div>

                  <div className="mt-4 space-y-2 rounded-lg bg-neutral-50 p-3 text-sm text-neutral-800">
                    {order.items?.length ? (
                      order.items.map((item) => (
                        <div key={item.id} className="flex justify-between gap-3">
                          <span>{item.name}</span>
                          <span className="font-semibold">x{item.quantity}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-neutral-500">No items attached.</p>
                    )}
                  </div>

                  {order.notes && (
                    <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                      {order.notes}
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap gap-2">
                    {availableActions.map((nextStatus) => (
                      <button
                        key={nextStatus}
                        type="button"
                        className="rounded-lg border border-neutral-200 px-3 py-2 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
                        onClick={() => updateStatus(order, nextStatus)}
                        disabled={updatingId === order.id}
                      >
                        {getOrderStatusLabel(nextStatus)}
                      </button>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </AdminCard>
    </div>
  );
}
