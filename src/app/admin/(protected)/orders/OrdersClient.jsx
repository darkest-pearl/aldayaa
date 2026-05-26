'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import AdminCard from '../../components/AdminCard.jsx';
import AdminPageHeader from '../../components/AdminPageHeader.jsx';
import AdminTable from '../../components/AdminTable.jsx';
import ConfirmDialog from '../../components/ConfirmDialog.jsx';
import { useAdmin } from '../../components/AdminShell.jsx';
import {
  ORDER_CONTEXTS,
  ORDER_SOURCES,
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
  } catch (err) {
    throw new Error('Invalid server response');
  }

  if (!data?.success) {
    throw new Error(data?.error || 'Request failed');
  }
  return data.data;
}

const ORDER_STATUS_OPTIONS = Object.values(ORDER_STATUSES);
const ORDER_CONTEXT_OPTIONS = Object.values(ORDER_CONTEXTS);

const STATUS_BADGE_CLASSES = {
  [ORDER_STATUSES.NEW]: 'bg-blue-50 text-blue-700 ring-blue-200',
  [ORDER_STATUSES.IN_PROGRESS]: 'bg-amber-50 text-amber-800 ring-amber-200',
  [ORDER_STATUSES.COMPLETED]: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  [ORDER_STATUSES.CANCELLED]: 'bg-red-50 text-red-700 ring-red-200',
};

function getStatusBadgeClass(status) {
  return STATUS_BADGE_CLASSES[status] || 'bg-neutral-100 text-neutral-700 ring-neutral-200';
}

function formatQuantity(value) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 }).format(Number(value || 0));
}

export default function OrdersClient() {
  const admin = useAdmin();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [recipePreview, setRecipePreview] = useState(null);
  const [recipePreviewError, setRecipePreviewError] = useState(null);
  const [recipePreviewLoadingId, setRecipePreviewLoadingId] = useState(null);
  const [recipeApplyError, setRecipeApplyError] = useState(null);
  const [recipeApplySuccess, setRecipeApplySuccess] = useState(null);
  const [recipeApplyLoading, setRecipeApplyLoading] = useState(false);

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
      setError(null);
      await apiRequest('/api/orders', {
        method: 'PUT',
        body: JSON.stringify({ id, status }),
      });
      await load();
    } catch (err) {
      setError(`Status update failed: ${err.message}`);
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

  const loadRecipePreview = async (order) => {
    setRecipePreviewError(null);
    setRecipeApplyError(null);
    setRecipeApplySuccess(null);
    setRecipePreviewLoadingId(order.id);

    try {
      const data = await apiRequest(`/api/admin/orders/${order.id}/recipe-consumption-preview`);
      setRecipePreview(data);
    } catch (err) {
      setRecipePreview(null);
      setRecipePreviewError(`Recipe preview failed: ${err.message}`);
    } finally {
      setRecipePreviewLoadingId(null);
    }
  };

  const applyRecipeConsumption = async () => {
    const orderId = recipePreview?.order?.id;
    if (!orderId) return;

    setRecipeApplyError(null);
    setRecipeApplySuccess(null);
    setRecipeApplyLoading(true);

    try {
      const data = await apiRequest(`/api/admin/orders/${orderId}/apply-recipe-consumption`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      setRecipePreview(data);
      setRecipeApplySuccess('Recipe consumption applied. Inventory stock was deducted for this order.');
      await load(false);
    } catch (err) {
      setRecipeApplyError(`Recipe consumption apply failed: ${err.message}`);
    } finally {
      setRecipeApplyLoading(false);
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
      if (contextFilter !== 'ALL' && (o.orderContext || ORDER_CONTEXTS.STANDARD) !== contextFilter) return false;

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

  const recipePreviewLines = recipePreview?.consumption?.lines || [];
  const canApplyRecipeConsumption = ['ADMIN', 'MANAGER'].includes(admin?.role);
  const hasMissingRecipeMappings = recipePreviewLines.some((line) => line.missingMapping);
  const recipeConsumptionAlreadyApplied = Boolean(recipePreview?.appliedConsumption || recipeApplySuccess);
  const canApplyCurrentPreview =
    canApplyRecipeConsumption &&
    recipePreviewLines.length > 0 &&
    !hasMissingRecipeMappings &&
    !recipeConsumptionAlreadyApplied;

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
      {recipePreviewError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {recipePreviewError}
        </div>
      )}
      {recipeApplyError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {recipeApplyError}
        </div>
      )}
      {recipeApplySuccess && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {recipeApplySuccess}
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
              {ORDER_STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {getOrderStatusLabel(status)}
                </option>
              ))}
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
              {ORDER_CONTEXT_OPTIONS.map((context) => (
                <option key={context} value={context}>
                  {getOrderContextLabel(context)}
                </option>
              ))}
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

      {recipePreview && (
        <AdminCard
          title={`Recipe preview${recipePreview.order?.reference ? ` ${recipePreview.order.reference}` : ''}`}
          description="Inventory items that would be consumed by this order."
          actions={
            <div className="flex flex-wrap gap-2">
              {canApplyRecipeConsumption && (
                canApplyCurrentPreview ? (
                  <ConfirmDialog
                    title="Apply recipe consumption?"
                    description="This will deduct inventory stock. This action should only be used after reviewing the dry-run preview."
                    confirmLabel="Apply recipe consumption"
                    onConfirm={applyRecipeConsumption}
                    trigger={
                      <button
                        type="button"
                        className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={recipeApplyLoading}
                      >
                        {recipeApplyLoading ? 'Applying...' : 'Apply recipe consumption'}
                      </button>
                    }
                  />
                ) : (
                  <button
                    type="button"
                    className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-semibold text-neutral-400"
                    disabled
                  >
                    Apply recipe consumption
                  </button>
                )
              )}
              <button
                type="button"
                className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50"
                onClick={() => setRecipePreview(null)}
              >
                Close
              </button>
            </div>
          }
        >
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            This is a dry-run preview of what would be consumed. No inventory is deducted and no stock movement is created.
          </div>
          {canApplyRecipeConsumption && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              This will deduct inventory stock. Apply only after the recipe preview has been reviewed.
              {hasMissingRecipeMappings && (
                <span className="mt-1 block font-semibold">
                  Complete missing recipe mappings before applying consumption.
                </span>
              )}
              {recipeConsumptionAlreadyApplied && (
                <span className="mt-1 block font-semibold">
                  Recipe consumption has already been applied for this order.
                </span>
              )}
            </div>
          )}
          <div className="-mx-4 overflow-x-auto sm:mx-0">
            <table className="min-w-full divide-y divide-neutral-200 text-left text-sm">
              <thead className="bg-neutral-50 text-xs uppercase text-neutral-500">
                <tr>
                  <th className="px-3 py-2">Menu item</th>
                  <th className="px-3 py-2">Inventory item</th>
                  <th className="px-3 py-2">Recipe qty</th>
                  <th className="px-3 py-2">Order qty</th>
                  <th className="px-3 py-2">Required</th>
                  <th className="px-3 py-2">Current stock</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 bg-white">
                {recipePreviewLines.map((line, index) => (
                  <tr key={`${line.menuItemId || line.menuItemName}-${line.inventoryItemId || 'missing'}-${index}`}>
                    <td className="px-3 py-2 font-semibold text-neutral-900">{line.menuItemName}</td>
                    <td className="px-3 py-2">
                      {line.missingMapping ? (
                        <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">
                          Missing recipe mapping
                        </span>
                      ) : (
                        line.inventoryItemName || 'Inventory item'
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {line.missingMapping ? '-' : `${formatQuantity(line.recipeQuantity)} ${line.unit}`}
                    </td>
                    <td className="px-3 py-2">{formatQuantity(line.orderQuantity)}</td>
                    <td className="px-3 py-2 font-semibold text-neutral-900">
                      {line.missingMapping ? '-' : `${formatQuantity(line.totalRequiredQuantity)} ${line.unit}`}
                    </td>
                    <td className="px-3 py-2">
                      {line.currentStock === null || line.currentStock === undefined
                        ? '-'
                        : `${formatQuantity(line.currentStock)} ${line.unit}`}
                    </td>
                    <td className="px-3 py-2">{line.stockStatusLabel || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {recipePreviewLines.length === 0 && (
              <p className="rounded-lg border border-neutral-200 px-3 py-4 text-center text-sm text-neutral-500">
                No recipe consumption lines are available for this order.
              </p>
            )}
          </div>
        </AdminCard>
      )}

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
                  const context = order.orderContext || ORDER_CONTEXTS.STANDARD;
                  const tableLabel = order.tableLabel || order.table?.label || order.tableSlug;
                  const tableZone = order.table?.zone;

                  return (
                    <div>
                      <span
                        className={
                          context === ORDER_CONTEXTS.TABLE
                            ? 'rounded-full bg-primary/15 px-2 py-1 text-xs font-semibold text-secondary'
                            : 'rounded-full bg-neutral-100 px-2 py-1 text-xs font-semibold text-neutral-700'
                        }
                      >
                        {getOrderContextLabel(context)}
                      </span>
                      {context === ORDER_CONTEXTS.TABLE && tableLabel && (
                        <p className="mt-1 text-xs text-neutral-500">
                          Table: {tableLabel}
                        </p>
                      )}
                      {context === ORDER_CONTEXTS.TABLE && tableZone && (
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
                  const source = order.orderSource || ORDER_SOURCES.CUSTOMER;
                  const isStaffAssisted = source === ORDER_SOURCES.STAFF_ASSISTED;

                  return (
                    <div>
                      <span
                        className={
                          isStaffAssisted
                            ? 'rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800'
                            : 'rounded-full bg-neutral-100 px-2 py-1 text-xs font-semibold text-neutral-700'
                        }
                      >
                        {getOrderSourceLabel(source)}
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
                render: (_val, row) => {
                  const currentStatus = row.status || ORDER_STATUSES.NEW;

                  return (
                    <div className="space-y-2">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${getStatusBadgeClass(currentStatus)}`}
                      >
                        {getOrderStatusLabel(currentStatus)}
                      </span>
                      <select
                        className="min-h-[36px] rounded-lg border border-neutral-200 px-2.5 py-1.5 text-xs focus:border-primary focus:outline-none"
                        value={currentStatus}
                        onChange={(e) => updateStatus(row.id, e.target.value)}
                      >
                        {ORDER_STATUS_OPTIONS.map((status) => (
                          <option
                            key={status}
                            value={status}
                            disabled={!canTransitionOrderStatus(currentStatus, status)}
                          >
                            {getOrderStatusLabel(status)}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                },
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
                    <button
                      type="button"
                      className="min-h-[36px] rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={() => loadRecipePreview(row)}
                      disabled={recipePreviewLoadingId === row.id}
                    >
                      {recipePreviewLoadingId === row.id ? 'Loading...' : 'Recipe preview'}
                    </button>
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
