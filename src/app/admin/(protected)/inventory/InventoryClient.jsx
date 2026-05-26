'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import AdminCard from '../../components/AdminCard.jsx';
import AdminForm from '../../components/AdminForm.jsx';
import AdminPageHeader from '../../components/AdminPageHeader.jsx';
import AdminTable from '../../components/AdminTable.jsx';
import { useAdmin } from '../../components/AdminShell.jsx';
import ConfirmDialog from '../../components/ConfirmDialog.jsx';
import {
  INVENTORY_MOVEMENT_TYPES,
  INVENTORY_MOVEMENT_TYPE_LABELS,
  INVENTORY_STOCK_STATUSES,
  getInventoryUnitOptions,
  normalizeInventoryUnit,
} from '../../../../lib/inventory';

const emptyItemForm = {
  name: '',
  sku: '',
  category: '',
  unit: '',
  currentStock: '0',
  reorderLevel: '',
  costPerUnit: '',
  notes: '',
  isActive: true,
};

const emptyMovementForm = {
  itemId: '',
  type: INVENTORY_MOVEMENT_TYPES.STOCK_IN,
  quantity: '',
  reason: '',
  source: '',
};

const movementTypes = Object.values(INVENTORY_MOVEMENT_TYPES);
const unitOptions = getInventoryUnitOptions();
const allFilterValue = 'ALL';
const statusFilterOptions = [
  { value: allFilterValue, label: 'All' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
];
const stockFilterOptions = [
  { value: allFilterValue, label: 'All' },
  { value: INVENTORY_STOCK_STATUSES.LOW_STOCK, label: 'Low stock' },
  { value: INVENTORY_STOCK_STATUSES.OUT_OF_STOCK, label: 'Out of stock' },
  { value: INVENTORY_STOCK_STATUSES.OK, label: 'OK' },
];

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

function toOptionalNumber(value) {
  return value === '' || value === null || value === undefined ? null : Number(value);
}

function formatQuantity(value) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString();
}

function getStockStatusBadgeClass(status) {
  if (status === INVENTORY_STOCK_STATUSES.OUT_OF_STOCK) {
    return 'rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-700';
  }
  if (status === INVENTORY_STOCK_STATUSES.LOW_STOCK) {
    return 'rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800';
  }
  return 'rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-700';
}

function getStockTextClass(status) {
  if (status === INVENTORY_STOCK_STATUSES.OUT_OF_STOCK) return 'font-semibold text-red-700';
  if (status === INVENTORY_STOCK_STATUSES.LOW_STOCK) return 'font-semibold text-amber-800';
  return 'font-semibold text-neutral-900';
}

function toItemPayload(form) {
  return {
    name: form.name.trim(),
    sku: form.sku.trim() || null,
    category: form.category.trim() || null,
    unit: normalizeInventoryUnit(form.unit),
    currentStock: Number(form.currentStock || 0),
    reorderLevel: toOptionalNumber(form.reorderLevel),
    costPerUnit: toOptionalNumber(form.costPerUnit),
    notes: form.notes.trim() || null,
    isActive: Boolean(form.isActive),
  };
}

export default function InventoryClient() {
  const admin = useAdmin();
  const canManage = ['ADMIN', 'MANAGER'].includes(admin?.role);
  const [items, setItems] = useState([]);
  const [movements, setMovements] = useState([]);
  const [itemForm, setItemForm] = useState(emptyItemForm);
  const [movementForm, setMovementForm] = useState(emptyMovementForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [moving, setMoving] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(allFilterValue);
  const [stockFilter, setStockFilter] = useState(allFilterValue);
  const [categoryFilter, setCategoryFilter] = useState(allFilterValue);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [itemData, movementData] = await Promise.all([
        apiRequest('/api/admin/inventory/items'),
        apiRequest('/api/admin/inventory/movements'),
      ]);
      setItems(itemData.items || []);
      setMovements(movementData.movements || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const activeItems = useMemo(() => items.filter((item) => item.isActive !== false), [items]);
  const categorySuggestions = useMemo(() => {
    return [...new Set(items.map((item) => item.category).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  }, [items]);
  const summary = useMemo(() => {
    return {
      totalItems: items.length,
      activeItemsCount: items.filter((item) => item.isActive !== false).length,
      lowStockCount: items.filter((item) => item.stockStatus === INVENTORY_STOCK_STATUSES.LOW_STOCK).length,
      outOfStockCount: items.filter((item) => item.stockStatus === INVENTORY_STOCK_STATUSES.OUT_OF_STOCK).length,
    };
  }, [items]);
  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();

    return items.filter((item) => {
      const matchesSearch = !query || [item.name, item.sku, item.category]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query);
      const matchesStatus =
        statusFilter === allFilterValue ||
        (statusFilter === 'ACTIVE' && item.isActive !== false) ||
        (statusFilter === 'INACTIVE' && item.isActive === false);
      const matchesStock = stockFilter === allFilterValue || item.stockStatus === stockFilter;
      const matchesCategory = categoryFilter === allFilterValue || item.category === categoryFilter;

      return matchesSearch && matchesStatus && matchesStock && matchesCategory;
    });
  }, [items, search, statusFilter, stockFilter, categoryFilter]);
  const selectedMovementItem = useMemo(
    () => items.find((item) => item.id === movementForm.itemId) || null,
    [items, movementForm.itemId],
  );

  const resetItemForm = () => {
    setEditingId(null);
    setItemForm(emptyItemForm);
  };

  const handleItemSubmit = async (event) => {
    event.preventDefault();
    if (!canManage) return;

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const payload = toItemPayload(itemForm);
      const url = editingId ? `/api/admin/inventory/items/${editingId}` : '/api/admin/inventory/items';
      await apiRequest(url, {
        method: editingId ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      });
      setMessage(editingId ? 'Inventory item updated' : 'Inventory item created');
      resetItemForm();
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (item) => {
    setEditingId(item.id);
    setItemForm({
      name: item.name || '',
      sku: item.sku || '',
      category: item.category || '',
      unit: item.unit || '',
      currentStock: String(item.currentStock ?? 0),
      reorderLevel: item.reorderLevel === null || item.reorderLevel === undefined ? '' : String(item.reorderLevel),
      costPerUnit: item.costPerUnit === null || item.costPerUnit === undefined ? '' : String(item.costPerUnit),
      notes: item.notes || '',
      isActive: item.isActive !== false,
    });
    setError(null);
    setMessage(null);
  };

  const handleDeactivate = async (item) => {
    setError(null);
    setMessage(null);
    try {
      await apiRequest(`/api/admin/inventory/items/${item.id}`, { method: 'DELETE' });
      setMessage(`${item.name} was marked inactive`);
      if (editingId === item.id) resetItemForm();
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleMovementSubmit = async (event) => {
    event.preventDefault();
    if (!canManage) return;

    setMoving(true);
    setError(null);
    setMessage(null);

    try {
      if (!movementForm.itemId) {
        throw new Error('Choose an inventory item.');
      }

      await apiRequest('/api/admin/inventory/movements', {
        method: 'POST',
        body: JSON.stringify({
          itemId: movementForm.itemId,
          type: movementForm.type,
          quantity: Number(movementForm.quantity),
          reason: movementForm.reason.trim() || null,
          source: movementForm.source.trim() || null,
        }),
      });
      setMessage('Inventory movement recorded');
      setMovementForm(emptyMovementForm);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setMoving(false);
    }
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Inventory"
        description="Track stock items and manual movements. Recipe usage, supplier automation, and automatic order deductions are not enabled yet."
      />

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}
      {message && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div>
      )}
      {!canManage && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          SUPPORT users can view inventory items and movements, but only ADMIN and MANAGER users can change stock.
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Total items', value: summary.totalItems },
          { label: 'Active items', value: summary.activeItemsCount },
          { label: 'Low stock', value: summary.lowStockCount },
          { label: 'Out of stock', value: summary.outOfStockCount },
        ].map((item) => (
          <div key={item.label} className="rounded-lg border border-neutral-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-xs font-semibold uppercase text-neutral-500">{item.label}</p>
            <p className="mt-1 text-2xl font-bold text-neutral-900">{item.value}</p>
          </div>
        ))}
      </div>

      <div className={canManage ? 'grid gap-4 xl:grid-cols-[minmax(0,0.85fr),minmax(0,1.15fr)]' : 'grid gap-4'}>
        {canManage && (
          <div className="space-y-4">
            <AdminCard
              title={editingId ? 'Edit inventory item' : 'Add inventory item'}
              description="Create stock items with units, reorder levels, and optional SKU values."
            >
              <AdminForm
                onSubmit={handleItemSubmit}
                submitLabel={editingId ? 'Save item' : 'Create item'}
                submitting={saving}
                secondaryAction={
                  editingId ? (
                    <button
                      type="button"
                      className="text-sm font-semibold text-neutral-700 underline"
                      onClick={resetItemForm}
                    >
                      Cancel edit
                    </button>
                  ) : null
                }
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-neutral-800">Name</label>
                    <input
                      className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                      value={itemForm.name}
                      onChange={(event) => setItemForm((prev) => ({ ...prev, name: event.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-neutral-800">SKU optional</label>
                    <input
                      className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                      value={itemForm.sku}
                      onChange={(event) => setItemForm((prev) => ({ ...prev, sku: event.target.value }))}
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-neutral-800">Category optional</label>
                    <input
                      className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                      value={itemForm.category}
                      onChange={(event) => setItemForm((prev) => ({ ...prev, category: event.target.value }))}
                      list="inventory-category-options"
                      placeholder="Dry goods"
                    />
                    <datalist id="inventory-category-options">
                      {categorySuggestions.map((category) => (
                        <option key={category} value={category} />
                      ))}
                    </datalist>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-neutral-800">Unit</label>
                    <input
                      className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                      value={itemForm.unit}
                      onChange={(event) => setItemForm((prev) => ({ ...prev, unit: event.target.value }))}
                      list="inventory-unit-options"
                      placeholder="kg"
                      required
                    />
                    <datalist id="inventory-unit-options">
                      {unitOptions.map((unit) => (
                        <option key={unit.value} value={unit.value}>
                          {unit.label}
                        </option>
                      ))}
                    </datalist>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-neutral-800">Current stock</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                      value={itemForm.currentStock}
                      onChange={(event) => setItemForm((prev) => ({ ...prev, currentStock: event.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-neutral-800">Reorder level</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                      value={itemForm.reorderLevel}
                      onChange={(event) => setItemForm((prev) => ({ ...prev, reorderLevel: event.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-neutral-800">Cost/unit</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                      value={itemForm.costPerUnit}
                      onChange={(event) => setItemForm((prev) => ({ ...prev, costPerUnit: event.target.value }))}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-neutral-800">Notes</label>
                  <textarea
                    className="min-h-[84px] w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                    value={itemForm.notes}
                    onChange={(event) => setItemForm((prev) => ({ ...prev, notes: event.target.value }))}
                    placeholder="Optional internal note"
                  />
                </div>

                <label className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm font-semibold text-neutral-800">
                  <input
                    type="checkbox"
                    checked={itemForm.isActive}
                    onChange={(event) => setItemForm((prev) => ({ ...prev, isActive: event.target.checked }))}
                  />
                  Active inventory item
                </label>
              </AdminForm>
            </AdminCard>

            <AdminCard
              title="Add stock movement"
              description="Stock in adds quantity. Stock out and waste subtract. Adjustment/count correction set stock to the entered quantity."
            >
              <AdminForm onSubmit={handleMovementSubmit} submitLabel="Record movement" submitting={moving}>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-neutral-800">Item</label>
                  <select
                    className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                    value={movementForm.itemId}
                    onChange={(event) => setMovementForm((prev) => ({ ...prev, itemId: event.target.value }))}
                    required
                  >
                    <option value="">Choose item</option>
                    {activeItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} ({formatQuantity(item.currentStock)} {item.unit})
                      </option>
                    ))}
                  </select>
                </div>

                {selectedMovementItem && (
                  <div className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-secondary">
                    <p>
                      Current stock: {formatQuantity(selectedMovementItem.currentStock)} {selectedMovementItem.unit}
                    </p>
                    <p>Status: {selectedMovementItem.stockStatusLabel}</p>
                    {selectedMovementItem.reorderLevel !== null && (
                      <p>Reorder level: {formatQuantity(selectedMovementItem.reorderLevel)} {selectedMovementItem.unit}</p>
                    )}
                  </div>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-neutral-800">Movement type</label>
                    <select
                      className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                      value={movementForm.type}
                      onChange={(event) => setMovementForm((prev) => ({ ...prev, type: event.target.value }))}
                    >
                      {movementTypes.map((type) => (
                        <option key={type} value={type}>
                          {INVENTORY_MOVEMENT_TYPE_LABELS[type]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-neutral-800">Quantity</label>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                      value={movementForm.quantity}
                      onChange={(event) => setMovementForm((prev) => ({ ...prev, quantity: event.target.value }))}
                      required
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-neutral-800">Reason optional</label>
                    <input
                      className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                      value={movementForm.reason}
                      onChange={(event) => setMovementForm((prev) => ({ ...prev, reason: event.target.value }))}
                      placeholder="Manual count"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-neutral-800">Source optional</label>
                    <input
                      className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                      value={movementForm.source}
                      onChange={(event) => setMovementForm((prev) => ({ ...prev, source: event.target.value }))}
                      placeholder="Kitchen / receiving"
                    />
                  </div>
                </div>
              </AdminForm>
            </AdminCard>
          </div>
        )}

        <AdminCard
          title="Inventory items"
          description="Current stock, unit, and reorder visibility for active and inactive items."
          actions={loading && <span className="text-xs text-neutral-500">Refreshing...</span>}
        >
          <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-neutral-800">Search</label>
              <input
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Name, SKU, or category"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-neutral-800">Status</label>
              <select
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                {statusFilterOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-neutral-800">Stock</label>
              <select
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                value={stockFilter}
                onChange={(event) => setStockFilter(event.target.value)}
              >
                {stockFilterOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-neutral-800">Category</label>
              <select
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
              >
                <option value={allFilterValue}>All</option>
                {categorySuggestions.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>
          </div>

          <AdminTable
            dense
            columns={[
              {
                key: 'name',
                header: 'Item',
                render: (_value, row) => (
                  <div>
                    <p className="font-semibold text-neutral-900">{row.name}</p>
                    <p className="text-xs text-neutral-500">{row.sku || 'No SKU'}</p>
                    {row.category && <p className="text-xs text-neutral-600">{row.category}</p>}
                  </div>
                ),
              },
              {
                key: 'currentStock',
                header: 'Current stock',
                render: (_value, row) => (
                  <div>
                    <p className={getStockTextClass(row.stockStatus)}>
                      {formatQuantity(row.currentStock)} {row.unit}
                    </p>
                    {row.reorderLevel !== null && (
                      <p className={row.isLowStock ? 'text-xs font-semibold text-amber-800' : 'text-xs text-neutral-500'}>
                        Reorder level: {formatQuantity(row.reorderLevel)} {row.unit}
                      </p>
                    )}
                  </div>
                ),
              },
              {
                key: 'costPerUnit',
                header: 'Cost',
                render: (value) => (value === null || value === undefined ? '-' : formatQuantity(value)),
              },
              {
                key: 'isActive',
                header: 'Status',
                render: (value, row) => (
                  <div className="flex flex-col gap-1">
                    <span className={getStockStatusBadgeClass(row.stockStatus)}>
                      {row.stockStatusLabel}
                    </span>
                    <span
                      className={
                        value
                          ? 'rounded-full bg-neutral-100 px-2 py-1 text-xs font-semibold text-neutral-700'
                          : 'rounded-full bg-neutral-100 px-2 py-1 text-xs font-semibold text-neutral-600'
                      }
                    >
                      {value ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                ),
              },
              {
                key: 'actions',
                header: 'Actions',
                render: (_value, row) => (
                  <div className="flex flex-wrap gap-2">
                    {!canManage && <span className="text-xs text-neutral-500">View only</span>}
                    {canManage && (
                      <button
                        type="button"
                        className="rounded-md border border-neutral-200 px-2 py-1 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50"
                        onClick={() => handleEdit(row)}
                      >
                        Edit
                      </button>
                    )}
                    {canManage && row.isActive && (
                      <ConfirmDialog
                        confirmLabel="Mark inactive"
                        title="Deactivate inventory item?"
                        description={`Mark ${row.name} inactive? Existing movement history will remain available.`}
                        onConfirm={() => handleDeactivate(row)}
                        trigger={
                          <button className="rounded-md border border-red-200 px-2 py-1 text-xs font-semibold text-red-600 transition hover:bg-red-50">
                            Deactivate
                          </button>
                        }
                      />
                    )}
                  </div>
                ),
              },
            ]}
            rows={filteredItems}
            emptyMessage={loading ? 'Loading inventory items...' : items.length ? 'No inventory items match the current filters' : 'No inventory items yet'}
          />
        </AdminCard>
      </div>

      <AdminCard title="Recent movements" description="Latest manual stock movements across inventory items.">
        <AdminTable
          dense
          columns={[
            {
              key: 'itemName',
              header: 'Item',
              render: (value, row) => (
                <div>
                  <p className="font-semibold text-neutral-900">{value || row.itemId}</p>
                  {row.itemUnit && <p className="text-xs text-neutral-500">{row.itemUnit}</p>}
                </div>
              ),
            },
            {
              key: 'typeLabel',
              header: 'Type',
            },
            {
              key: 'quantity',
              header: 'Quantity',
              render: (value) => formatQuantity(value),
            },
            {
              key: 'reason',
              header: 'Reason',
              render: (value, row) => (
                <div>
                  <p>{value || '-'}</p>
                  {row.source && <p className="text-xs text-neutral-500">{row.source}</p>}
                </div>
              ),
            },
            {
              key: 'createdByAdminEmail',
              header: 'By',
              render: (value) => value || '-',
            },
            {
              key: 'createdAt',
              header: 'Created',
              render: (value) => formatDate(value),
            },
          ]}
          rows={movements}
          emptyMessage={loading ? 'Loading movements...' : 'No inventory movements yet'}
        />
      </AdminCard>
    </div>
  );
}
