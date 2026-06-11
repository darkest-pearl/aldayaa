'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  INVENTORY_MOVEMENT_TYPES,
  INVENTORY_STOCK_STATUSES,
  getInventoryMovementTypeLabel,
  getInventoryUnitOptions,
  normalizeInventoryUnit,
} from '../../../../../lib/inventory';

const emptyItemForm = {
  name: '',
  sku: '',
  category: '',
  unit: 'piece',
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

const allFilterValue = 'ALL';
const inputClass = 'rounded-md border border-neutral-200 px-3 py-2 text-sm outline-none transition focus:border-emerald-700 disabled:bg-neutral-50 disabled:text-neutral-500';
const movementTypes = Object.values(INVENTORY_MOVEMENT_TYPES);
const unitOptions = getInventoryUnitOptions();

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

function toOptionalNumber(value) {
  return value === '' || value === null || value === undefined ? null : Number(value);
}

function toItemPayload(restaurantSlug, form) {
  return {
    restaurantSlug,
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

function toMovementPayload(restaurantSlug, form) {
  return {
    restaurantSlug,
    itemId: form.itemId,
    type: form.type,
    quantity: Number(form.quantity || 0),
    reason: form.reason.trim() || null,
    source: form.source.trim() || null,
  };
}

function formatQuantity(value) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not recorded';
  return date.toLocaleString();
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

export default function TenantInventoryClient({ restaurantSlug, staffRole }) {
  const writable = canWrite(staffRole);
  const [items, setItems] = useState([]);
  const [movements, setMovements] = useState([]);
  const [itemForm, setItemForm] = useState(emptyItemForm);
  const [movementForm, setMovementForm] = useState(emptyMovementForm);
  const [editingId, setEditingId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [moving, setMoving] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(allFilterValue);
  const [stockFilter, setStockFilter] = useState(allFilterValue);
  const [categoryFilter, setCategoryFilter] = useState(allFilterValue);

  async function load(showLoading = true) {
    if (showLoading) setLoading(true);
    setError('');
    try {
      const [itemData, movementData] = await Promise.all([
        apiRequest(`/api/restaurant-admin/inventory/items?restaurantSlug=${encodeURIComponent(restaurantSlug)}`),
        apiRequest(`/api/restaurant-admin/inventory/movements?restaurantSlug=${encodeURIComponent(restaurantSlug)}`),
      ]);
      setItems(itemData.items || []);
      setMovements(movementData.movements || []);
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

  const activeItems = useMemo(() => items.filter((item) => item.isActive !== false), [items]);
  const categoryOptions = useMemo(() => {
    return [...new Set(items.map((item) => item.category).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  }, [items]);
  const summary = useMemo(() => ({
    totalItems: items.length,
    activeItems: activeItems.length,
    lowStock: items.filter((item) => item.stockStatus === INVENTORY_STOCK_STATUSES.LOW_STOCK).length,
    outOfStock: items.filter((item) => item.stockStatus === INVENTORY_STOCK_STATUSES.OUT_OF_STOCK).length,
  }), [activeItems.length, items]);
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
  }, [categoryFilter, items, search, statusFilter, stockFilter]);
  const selectedMovementItem = useMemo(
    () => activeItems.find((item) => item.id === movementForm.itemId) || null,
    [activeItems, movementForm.itemId],
  );

  function resetItemForm() {
    setEditingId('');
    setItemForm(emptyItemForm);
  }

  function startEdit(item) {
    setEditingId(item.id);
    setItemForm({
      name: item.name || '',
      sku: item.sku || '',
      category: item.category || '',
      unit: item.unit || 'piece',
      currentStock: String(item.currentStock ?? 0),
      reorderLevel: item.reorderLevel === null || item.reorderLevel === undefined ? '' : String(item.reorderLevel),
      costPerUnit: item.costPerUnit === null || item.costPerUnit === undefined ? '' : String(item.costPerUnit),
      notes: item.notes || '',
      isActive: item.isActive !== false,
    });
    setError('');
    setSuccessMessage('');
  }

  async function submitItem(event) {
    event.preventDefault();
    if (!writable) return;
    setSaving(true);
    setError('');
    setSuccessMessage('');
    try {
      await apiRequest(editingId ? `/api/restaurant-admin/inventory/items/${editingId}` : '/api/restaurant-admin/inventory/items', {
        method: editingId ? 'PUT' : 'POST',
        body: JSON.stringify(toItemPayload(restaurantSlug, itemForm)),
      });
      setSuccessMessage(editingId ? 'Inventory item updated.' : 'Inventory item created.');
      resetItemForm();
      await load(false);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function deactivateItem(item) {
    if (!writable) return;
    if (!window.confirm(`Mark "${item.name}" inactive? This keeps movement history and does not delete the item.`)) return;
    setError('');
    setSuccessMessage('');
    try {
      await apiRequest(`/api/restaurant-admin/inventory/items/${item.id}?restaurantSlug=${encodeURIComponent(restaurantSlug)}`, {
        method: 'DELETE',
      });
      setSuccessMessage(`${item.name} was marked inactive.`);
      if (editingId === item.id) resetItemForm();
      await load(false);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function submitMovement(event) {
    event.preventDefault();
    if (!writable) return;
    setMoving(true);
    setError('');
    setSuccessMessage('');
    try {
      await apiRequest('/api/restaurant-admin/inventory/movements', {
        method: 'POST',
        body: JSON.stringify(toMovementPayload(restaurantSlug, movementForm)),
      });
      setSuccessMessage('Manual stock adjustment recorded.');
      setMovementForm(emptyMovementForm);
      await load(false);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setMoving(false);
    }
  }

  return (
    <div className="space-y-5">
      {error ? <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div> : null}
      {successMessage ? <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{successMessage}</div> : null}
      {loading ? <div className="rounded-md border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-600">Loading inventory...</div> : null}
      {!writable ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          SUPPORT access is read-only. OWNER or MANAGER access is required to change inventory records.
        </div>
      ) : null}
      <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950">
        Manual inventory management only. No order consumption, recipe depletion, payment, messaging, billing, or advanced automation is triggered.
      </div>

      <section className="grid gap-3 md:grid-cols-4">
        <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-normal text-neutral-500">Items</p>
          <p className="mt-1 text-2xl font-semibold">{summary.totalItems}</p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-normal text-neutral-500">Active</p>
          <p className="mt-1 text-2xl font-semibold">{summary.activeItems}</p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-normal text-neutral-500">Low stock</p>
          <p className="mt-1 text-2xl font-semibold">{summary.lowStock}</p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-normal text-neutral-500">Out of stock</p>
          <p className="mt-1 text-2xl font-semibold">{summary.outOfStock}</p>
        </div>
      </section>

      <section className={writable ? 'grid gap-4 xl:grid-cols-[minmax(0,0.95fr),minmax(0,1.05fr)]' : 'grid gap-4'}>
        {writable ? (
          <div className="grid gap-4">
            <form onSubmit={submitItem} className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
              <h2 className="text-lg font-semibold">{editingId ? 'Edit inventory item' : 'Add inventory item'}</h2>
              <div className="mt-4 grid gap-3">
                <input className={inputClass} required disabled={saving} placeholder="Item name" value={itemForm.name} onChange={(event) => setItemForm((current) => ({ ...current, name: event.target.value }))} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <input className={inputClass} disabled={saving} placeholder="SKU" value={itemForm.sku} onChange={(event) => setItemForm((current) => ({ ...current, sku: event.target.value }))} />
                  <input className={inputClass} disabled={saving} placeholder="Category" value={itemForm.category} onChange={(event) => setItemForm((current) => ({ ...current, category: event.target.value }))} />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <select className={inputClass} disabled={saving} value={itemForm.unit} onChange={(event) => setItemForm((current) => ({ ...current, unit: event.target.value }))}>
                    {unitOptions.map((unit) => <option key={unit.value} value={unit.value}>{unit.label}</option>)}
                  </select>
                  <input className={inputClass} type="number" min="0" step="0.01" disabled={saving} placeholder="Current stock" value={itemForm.currentStock} onChange={(event) => setItemForm((current) => ({ ...current, currentStock: event.target.value }))} />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <input className={inputClass} type="number" min="0" step="0.01" disabled={saving} placeholder="Reorder level" value={itemForm.reorderLevel} onChange={(event) => setItemForm((current) => ({ ...current, reorderLevel: event.target.value }))} />
                  <input className={inputClass} type="number" min="0" step="0.01" disabled={saving} placeholder="Cost per unit" value={itemForm.costPerUnit} onChange={(event) => setItemForm((current) => ({ ...current, costPerUnit: event.target.value }))} />
                </div>
                <textarea className={`${inputClass} min-h-[84px]`} disabled={saving} placeholder="Internal notes" value={itemForm.notes} onChange={(event) => setItemForm((current) => ({ ...current, notes: event.target.value }))} />
                <label className="flex items-center gap-3 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm font-semibold text-neutral-800">
                  <input type="checkbox" checked={itemForm.isActive} disabled={saving} onChange={(event) => setItemForm((current) => ({ ...current, isActive: event.target.checked }))} />
                  Active item
                </label>
                <div className="flex flex-wrap gap-2">
                  <button type="submit" disabled={saving} className="rounded-md bg-[#10241f] px-4 py-2 text-sm font-semibold text-white">
                    {saving ? 'Saving...' : editingId ? 'Update item' : 'Create item'}
                  </button>
                  {editingId ? (
                    <button type="button" onClick={resetItemForm} className="rounded-md border border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-700">
                      Cancel edit
                    </button>
                  ) : null}
                </div>
              </div>
            </form>

            <form onSubmit={submitMovement} className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
              <h2 className="text-lg font-semibold">Manual stock adjustment</h2>
              <p className="mt-1 text-sm text-neutral-600">Manual movements update stock and record a scoped movement history entry.</p>
              <div className="mt-4 grid gap-3">
                <select className={inputClass} required disabled={moving} value={movementForm.itemId} onChange={(event) => setMovementForm((current) => ({ ...current, itemId: event.target.value }))}>
                  <option value="">Select active item</option>
                  {activeItems.map((item) => <option key={item.id} value={item.id}>{item.name} ({formatQuantity(item.currentStock)} {item.unit})</option>)}
                </select>
                <div className="grid gap-3 sm:grid-cols-2">
                  <select className={inputClass} disabled={moving} value={movementForm.type} onChange={(event) => setMovementForm((current) => ({ ...current, type: event.target.value }))}>
                    {movementTypes.map((type) => <option key={type} value={type}>{getInventoryMovementTypeLabel(type)}</option>)}
                  </select>
                  <input className={inputClass} required type="number" min="0.01" step="0.01" disabled={moving} placeholder="Quantity" value={movementForm.quantity} onChange={(event) => setMovementForm((current) => ({ ...current, quantity: event.target.value }))} />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <input className={inputClass} disabled={moving} placeholder="Reason" value={movementForm.reason} onChange={(event) => setMovementForm((current) => ({ ...current, reason: event.target.value }))} />
                  <input className={inputClass} disabled={moving} placeholder="Source" value={movementForm.source} onChange={(event) => setMovementForm((current) => ({ ...current, source: event.target.value }))} />
                </div>
                {selectedMovementItem ? (
                  <p className="rounded-md bg-neutral-50 px-3 py-2 text-sm text-neutral-700">
                    Current stock: {formatQuantity(selectedMovementItem.currentStock)} {selectedMovementItem.unit}
                  </p>
                ) : null}
                <button type="submit" disabled={moving || !movementForm.itemId} className="rounded-md bg-[#10241f] px-4 py-2 text-sm font-semibold text-white">
                  {moving ? 'Recording...' : 'Record movement'}
                </button>
              </div>
            </form>
          </div>
        ) : null}

        <div className="space-y-4">
          <section className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-semibold">Inventory items</h2>
                <p className="mt-1 text-sm text-neutral-600">Low stock badges are based on each item's reorder level.</p>
              </div>
              <button type="button" onClick={() => load(false)} disabled={loading} className="rounded-md border border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-700">
                Refresh
              </button>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <input className={inputClass} placeholder="Search items" value={search} onChange={(event) => setSearch(event.target.value)} />
              <select className={inputClass} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value={allFilterValue}>All statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
              <select className={inputClass} value={stockFilter} onChange={(event) => setStockFilter(event.target.value)}>
                <option value={allFilterValue}>All stock states</option>
                <option value={INVENTORY_STOCK_STATUSES.LOW_STOCK}>Low stock</option>
                <option value={INVENTORY_STOCK_STATUSES.OUT_OF_STOCK}>Out of stock</option>
                <option value={INVENTORY_STOCK_STATUSES.OK}>OK</option>
              </select>
              <select className={inputClass} value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
                <option value={allFilterValue}>All categories</option>
                {categoryOptions.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
            </div>
            <div className="mt-4 grid gap-3">
              {filteredItems.length ? filteredItems.map((item) => (
                <article key={item.id} className="rounded-md border border-neutral-100 p-3">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">{item.name}</h3>
                        <span className={getStockStatusBadgeClass(item.stockStatus)}>{item.stockStatusLabel}</span>
                        {item.isActive === false ? <span className="rounded-full bg-neutral-100 px-2 py-1 text-xs font-semibold text-neutral-600">Inactive</span> : null}
                      </div>
                      <p className="mt-1 text-sm text-neutral-600">{formatQuantity(item.currentStock)} {item.unit} in stock</p>
                      <p className="text-xs text-neutral-500">
                        Reorder: {item.reorderLevel === null ? 'Not set' : `${formatQuantity(item.reorderLevel)} ${item.unit}`}
                      </p>
                      {item.sku || item.category ? <p className="mt-1 text-xs text-neutral-500">{[item.sku, item.category].filter(Boolean).join(' - ')}</p> : null}
                      {item.notes ? <p className="mt-2 rounded-md bg-neutral-50 px-3 py-2 text-sm text-neutral-700">{item.notes}</p> : null}
                    </div>
                    {writable ? (
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => startEdit(item)} className="rounded-md border border-neutral-200 px-3 py-2 text-sm font-semibold text-neutral-700">
                          Edit
                        </button>
                        {item.isActive !== false ? (
                          <button type="button" onClick={() => deactivateItem(item)} className="rounded-md border border-red-200 px-3 py-2 text-sm font-semibold text-red-700">
                            Deactivate
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </article>
              )) : (
                <p className="rounded-md border border-dashed border-neutral-200 px-4 py-6 text-center text-sm text-neutral-500">
                  {loading ? 'Loading inventory...' : 'No inventory items yet'}
                </p>
              )}
            </div>
          </section>

          <section className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold">Movement history</h2>
            <p className="mt-1 text-sm text-neutral-600">Recent manual movements for this tenant only.</p>
            <div className="mt-4 grid gap-2">
              {movements.length ? movements.map((movement) => (
                <div key={movement.id} className="rounded-md border border-neutral-100 px-3 py-2 text-sm">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <span className="font-semibold">{movement.itemName || 'Inventory item'}</span>
                    <span className="text-neutral-500">{formatDate(movement.createdAt)}</span>
                  </div>
                  <p className="mt-1 text-neutral-700">
                    {movement.typeLabel}: {formatQuantity(movement.quantity)} {movement.itemUnit || ''}
                  </p>
                  {movement.reason || movement.source ? <p className="text-xs text-neutral-500">{[movement.reason, movement.source].filter(Boolean).join(' - ')}</p> : null}
                </div>
              )) : (
                <p className="rounded-md border border-dashed border-neutral-200 px-4 py-6 text-center text-sm text-neutral-500">
                  No manual stock movements recorded yet.
                </p>
              )}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
