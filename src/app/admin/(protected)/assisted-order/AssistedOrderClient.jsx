'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import AdminCard from '../../components/AdminCard.jsx';
import AdminForm from '../../components/AdminForm.jsx';
import AdminPageHeader from '../../components/AdminPageHeader.jsx';
import AdminTable from '../../components/AdminTable.jsx';

const emptyForm = {
  name: '',
  phone: '',
  tableId: '',
  notes: '',
};

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

function toQuantity(value) {
  const quantity = Number(value);
  return Number.isInteger(quantity) && quantity > 0 ? Math.min(quantity, 99) : 0;
}

export default function AssistedOrderClient() {
  const [items, setItems] = useState([]);
  const [tables, setTables] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [quantities, setQuantities] = useState({});
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [itemData, tableData] = await Promise.all([
        apiRequest('/api/menu/items'),
        apiRequest('/api/admin/tables'),
      ]);
      setItems(itemData.items || []);
      setTables((tableData.tables || []).filter((table) => table.isActive !== false));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const selectedItems = useMemo(() => {
    return items
      .map((item) => ({ item, quantity: toQuantity(quantities[item.id]) }))
      .filter(({ item, quantity }) => item.isAvailable !== false && quantity > 0);
  }, [items, quantities]);

  const total = useMemo(() => {
    return selectedItems.reduce((sum, { item, quantity }) => sum + item.price * quantity, 0);
  }, [selectedItems]);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (items || []).filter((item) => {
      if (!query) return true;
      const haystack = [item.name, item.description, item.category?.name]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [items, search]);

  const selectedTable = useMemo(
    () => tables.find((table) => table.id === form.tableId) || null,
    [tables, form.tableId],
  );

  const setQuantity = (id, value) => {
    setQuantities((prev) => ({
      ...prev,
      [id]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      if (selectedItems.length === 0) {
        throw new Error('Choose at least one available menu item.');
      }

      const data = await apiRequest('/api/admin/orders/assisted', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name.trim(),
          phone: form.phone.trim() || null,
          tableId: form.tableId || null,
          notes: form.notes.trim() || null,
          items: selectedItems.map(({ item, quantity }) => ({ id: item.id, quantity })),
        }),
      });

      setMessage(`Assisted order created: ${data.reference}`);
      setForm(emptyForm);
      setQuantities({});
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Assisted order"
        description="Create a staff-entered order for a customer or table. Pricing is calculated by the server."
      />

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}
      {message && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div>
      )}

      <AdminCard
        title="Create assisted order"
        description="Use this for ADMIN/MANAGER staff order entry. No payment, receipt, or kitchen workflow is added here."
        actions={loading && <span className="text-xs text-neutral-500">Loading menu...</span>}
      >
        <AdminForm onSubmit={handleSubmit} submitLabel="Create assisted order" submitting={saving}>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-neutral-800">Customer name</label>
              <input
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-neutral-800">Phone optional</label>
              <input
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                value={form.phone}
                onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-neutral-800">Table optional</label>
              <select
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                value={form.tableId}
                onChange={(e) => setForm((prev) => ({ ...prev, tableId: e.target.value }))}
              >
                <option value="">No table</option>
                {tables.map((table) => (
                  <option key={table.id} value={table.id}>
                    {table.label}{table.zone ? ` - ${table.zone}` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedTable && (
            <div className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-secondary">
              Table context: {selectedTable.label}{selectedTable.zone ? ` - ${selectedTable.zone}` : ''}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-semibold text-neutral-800">Notes</label>
            <textarea
              className="min-h-[84px] w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
              value={form.notes}
              onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder="Optional preparation or service note"
            />
          </div>

          <div className="space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-neutral-800">Menu items</p>
                <p className="text-sm text-neutral-600">Enter quantities for the items staff should add.</p>
              </div>
              <input
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary focus:outline-none sm:max-w-xs"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search menu"
              />
            </div>

            <AdminTable
              dense
              columns={[
                {
                  key: 'name',
                  header: 'Item',
                  render: (_value, item) => (
                    <div>
                      <p className="font-semibold text-neutral-900">{item.name}</p>
                      {item.category?.name && (
                        <p className="text-xs text-neutral-500">{item.category.name}</p>
                      )}
                      {item.isAvailable === false && (
                        <p className="text-xs font-semibold text-red-600">Unavailable</p>
                      )}
                    </div>
                  ),
                },
                {
                  key: 'price',
                  header: 'Price',
                  render: (value) => `AED ${Number(value || 0).toFixed(2)}`,
                },
                {
                  key: 'quantity',
                  header: 'Qty',
                  render: (_value, item) => (
                    <input
                      type="number"
                      min="0"
                      max="99"
                      className="w-20 rounded-lg border border-neutral-200 px-2 py-1.5 text-sm focus:border-primary focus:outline-none disabled:bg-neutral-50"
                      value={quantities[item.id] || ''}
                      onChange={(e) => setQuantity(item.id, e.target.value)}
                      disabled={item.isAvailable === false}
                    />
                  ),
                },
              ]}
              rows={filteredItems}
              emptyMessage={loading ? 'Loading menu...' : 'No menu items found'}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm">
            <span className="font-semibold text-neutral-800">
              Selected items: {selectedItems.length}
            </span>
            <span className="text-base font-semibold text-secondary">
              Total preview: AED {total.toFixed(2)}
            </span>
          </div>
        </AdminForm>
      </AdminCard>
    </div>
  );
}
