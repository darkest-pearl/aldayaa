'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ORDER_CONTEXTS,
  ORDER_STATUSES,
  canTransitionOrderStatus,
  getOrderContextLabel,
  getOrderSourceLabel,
  getOrderStatusLabel,
} from '../../../../../lib/order-status';

const inputClass = 'rounded-md border border-neutral-200 px-3 py-2 text-sm outline-none transition focus:border-emerald-700 disabled:bg-neutral-50 disabled:text-neutral-500';
const activeStatusOptions = [ORDER_STATUSES.NEW, ORDER_STATUSES.IN_PROGRESS];
const kitchenActionOptions = [
  ORDER_STATUSES.IN_PROGRESS,
  ORDER_STATUSES.COMPLETED,
  ORDER_STATUSES.CANCELLED,
];

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

function formatDate(value) {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not recorded';
  return date.toLocaleString();
}

function formatQuantity(value) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 }).format(Number(value || 0));
}

function getStockBadgeClass(line) {
  if (line.isOutOfStock || line.stockStatus === 'OUT_OF_STOCK') {
    return 'rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-700';
  }
  if (line.isLowStock || line.stockStatus === 'LOW_STOCK') {
    return 'rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800';
  }
  return 'rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-700';
}

function buildKitchenQuery(restaurantSlug, statusFilter, contextFilter) {
  const params = new URLSearchParams({ restaurantSlug });
  if (statusFilter !== 'ALL') params.set('status', statusFilter);
  if (contextFilter !== 'ALL') params.set('orderContext', contextFilter);
  return `/api/restaurant-admin/kitchen?${params.toString()}`;
}

export default function TenantKitchenClient({ restaurantSlug, staffRole }) {
  const writable = canWrite(staffRole);
  const [orders, setOrders] = useState([]);
  const [counters, setCounters] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [recipePreview, setRecipePreview] = useState(null);
  const [previewLoadingId, setPreviewLoadingId] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [contextFilter, setContextFilter] = useState('ALL');

  async function load(showLoading = true) {
    if (showLoading) setLoading(true);
    setError('');
    try {
      const data = await apiRequest(buildKitchenQuery(restaurantSlug, statusFilter, contextFilter));
      setOrders(data.orders || []);
      setCounters(data.counters || null);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantSlug, statusFilter, contextFilter]);

  async function updateStatus(order, status) {
    if (!writable || order.status === status) return;
    setSavingId(order.id);
    setError('');
    setSuccessMessage('');
    try {
      await apiRequest(`/api/restaurant-admin/kitchen/${order.id}`, {
        method: 'PUT',
        body: JSON.stringify({ restaurantSlug, status }),
      });
      setSuccessMessage(`Kitchen order ${order.reference} moved to ${getOrderStatusLabel(status)}.`);
      await load(false);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSavingId('');
    }
  }

  async function loadRecipePreview(order) {
    setPreviewLoadingId(order.id);
    setError('');
    try {
      const params = new URLSearchParams({ restaurantSlug, orderId: order.id });
      const data = await apiRequest(`/api/restaurant-admin/recipes/preview?${params.toString()}`);
      setRecipePreview(data);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setPreviewLoadingId('');
    }
  }

  const groupedOrders = useMemo(() => {
    return activeStatusOptions.reduce((groups, status) => {
      groups[status] = orders.filter((order) => order.status === status);
      return groups;
    }, {});
  }, [orders]);

  return (
    <div className="space-y-5">
      {error ? <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div> : null}
      {successMessage ? <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{successMessage}</div> : null}
      {loading ? <div className="rounded-md border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-600">Loading kitchen queue...</div> : null}
      {!writable ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          SUPPORT access is read-only. OWNER or MANAGER access is required to update kitchen order status.
        </div>
      ) : null}
      <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950">
        Active prep only. Recipe previews are read-only; no stock is deducted and no payment, messaging, inventory, or recipe workflow is triggered.
      </div>

      {recipePreview ? (
        <section className="rounded-lg border border-emerald-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-normal text-emerald-700">Recipe preview</p>
              <h2 className="mt-1 text-lg font-semibold">Order {recipePreview.order?.reference}</h2>
              <p className="mt-1 text-sm text-neutral-600">
                Preview only; no stock is deducted and no inventory movement is created.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setRecipePreview(null)}
              className="rounded-md border border-neutral-200 px-3 py-2 text-sm font-semibold text-neutral-700"
            >
              Close preview
            </button>
          </div>

          {recipePreview.consumption?.hasMissingMappings ? (
            <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <p className="font-semibold">Missing recipe mappings</p>
              <div className="mt-2 grid gap-1">
                {recipePreview.consumption.missingMappings.map((line) => (
                  <p key={`${line.orderItemId || line.menuItemName}-missing`}>
                    {line.menuItemName} needs a recipe mapping before consumption can be calculated.
                  </p>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-4 grid gap-2">
            {(recipePreview.consumption?.lines || []).length ? recipePreview.consumption.lines.map((line, index) => (
              <div key={`${line.orderItemId || line.menuItemName}-${line.inventoryItemId || index}`} className="rounded-md border border-neutral-100 px-3 py-2 text-sm">
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="font-semibold">{line.missingMapping ? line.menuItemName : line.inventoryItemName || 'Inventory item'}</p>
                    <p className="text-neutral-600">
                      {line.missingMapping
                        ? `${formatQuantity(line.orderQuantity)} ordered; recipe mapping missing`
                        : `${formatQuantity(line.totalRequiredQuantity)} ${line.unit} required for ${line.menuItemName}`}
                    </p>
                  </div>
                  {!line.missingMapping ? (
                    <div className="text-left md:text-right">
                      <p className="text-neutral-600">
                        Current: {line.currentStock === null ? 'Not recorded' : `${formatQuantity(line.currentStock)} ${line.unit}`}
                      </p>
                      {line.stockStatusLabel ? (
                        <span className={getStockBadgeClass(line)}>{line.stockStatusLabel}</span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            )) : (
              <p className="rounded-md border border-dashed border-neutral-200 px-4 py-6 text-center text-sm text-neutral-500">
                No recipe ingredient lines are available for this order.
              </p>
            )}
          </div>
        </section>
      ) : null}

      <section className="grid gap-3 md:grid-cols-4">
        <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-normal text-neutral-500">Active queue</p>
          <p className="mt-1 text-2xl font-semibold">{counters?.activeOrders ?? orders.length}</p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-normal text-neutral-500">New</p>
          <p className="mt-1 text-2xl font-semibold">{counters?.byStatus?.[ORDER_STATUSES.NEW] || 0}</p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-normal text-neutral-500">In progress</p>
          <p className="mt-1 text-2xl font-semibold">{counters?.byStatus?.[ORDER_STATUSES.IN_PROGRESS] || 0}</p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-normal text-neutral-500">Table orders</p>
          <p className="mt-1 text-2xl font-semibold">{counters?.tableOrders || 0}</p>
        </div>
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <select className={inputClass} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="ALL">All active statuses</option>
            {activeStatusOptions.map((status) => <option key={status} value={status}>{getOrderStatusLabel(status)}</option>)}
          </select>
          <select className={inputClass} value={contextFilter} onChange={(event) => setContextFilter(event.target.value)}>
            <option value="ALL">All order contexts</option>
            {Object.values(ORDER_CONTEXTS).map((context) => <option key={context} value={context}>{getOrderContextLabel(context)}</option>)}
          </select>
          <button
            type="button"
            onClick={() => load(false)}
            className="rounded-md border border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-700"
            disabled={loading}
          >
            Refresh
          </button>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {activeStatusOptions.map((status) => (
          <div key={status} className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold">{getOrderStatusLabel(status)}</h3>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusBadgeClasses[status]}`}>
                {(groupedOrders[status] || []).length}
              </span>
            </div>
            <div className="space-y-3">
              {(groupedOrders[status] || []).length ? groupedOrders[status].map((order) => {
                const currentStatus = order.status || ORDER_STATUSES.NEW;
                const context = order.orderContext || ORDER_CONTEXTS.STANDARD;
                const tableLabel = order.tableLabel || order.table?.label || order.tableSlug;
                const tableZone = order.table?.zone;
                const actions = kitchenActionOptions.filter((nextStatus) => canTransitionOrderStatus(currentStatus, nextStatus));

                return (
                  <article key={order.id} className="rounded-md border border-neutral-100 p-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold">{order.reference}</p>
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusBadgeClasses[currentStatus] || 'bg-neutral-100 text-neutral-700'}`}>
                            {getOrderStatusLabel(currentStatus)}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-neutral-600">{order.name} - {order.phone}</p>
                        <p className="mt-1 text-xs text-neutral-500">{formatDate(order.createdAt)}</p>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                      <span className="rounded-full bg-neutral-100 px-2 py-1 text-neutral-700">{getOrderContextLabel(context)}</span>
                      <span className="rounded-full bg-neutral-100 px-2 py-1 text-neutral-700">{getOrderSourceLabel(order.orderSource)}</span>
                      {tableLabel ? (
                        <span className="rounded-full bg-emerald-50 px-2 py-1 text-emerald-800">
                          Table order - {tableLabel}{tableZone ? ` - ${tableZone}` : ''}
                        </span>
                      ) : null}
                      <span className="rounded-full bg-neutral-100 px-2 py-1 text-neutral-700">{order.deliveryType}</span>
                    </div>

                    <div className="mt-3 rounded-md bg-neutral-50 px-3 py-2 text-sm text-neutral-700">
                      {(order.items || []).length ? order.items.map((item) => (
                        <div key={item.id} className="flex justify-between gap-3">
                          <span>{item.quantity} x {item.name}</span>
                          <span className="font-semibold">Prep</span>
                        </div>
                      )) : <span className="text-neutral-500">No items recorded</span>}
                    </div>

                    {order.notes ? <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">{order.notes}</p> : null}

                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => loadRecipePreview(order)}
                        disabled={previewLoadingId === order.id}
                        className="rounded-md border border-emerald-200 px-3 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {previewLoadingId === order.id ? 'Loading preview...' : 'Recipe preview'}
                      </button>
                      {actions.length ? actions.map((nextStatus) => (
                        <button
                          key={nextStatus}
                          type="button"
                          onClick={() => updateStatus(order, nextStatus)}
                          disabled={!writable || savingId === order.id}
                          className="rounded-md border border-neutral-200 px-3 py-2 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {getOrderStatusLabel(nextStatus)}
                        </button>
                      )) : (
                        <span className="text-sm text-neutral-500">No next prep action available</span>
                      )}
                    </div>
                  </article>
                );
              }) : (
                <p className="rounded-md border border-dashed border-neutral-200 px-4 py-6 text-center text-sm text-neutral-500">
                  {loading ? 'Loading kitchen queue...' : 'No active kitchen orders'}
                </p>
              )}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
