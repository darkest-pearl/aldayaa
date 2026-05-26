'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import AdminCard from '../../components/AdminCard.jsx';
import AdminForm from '../../components/AdminForm.jsx';
import AdminPageHeader from '../../components/AdminPageHeader.jsx';
import AdminTable from '../../components/AdminTable.jsx';
import { useAdmin } from '../../components/AdminShell.jsx';
import ConfirmDialog from '../../components/ConfirmDialog.jsx';
import { getInventoryUnitOptions, normalizeInventoryUnit } from '../../../../lib/inventory';
import {
  getMenuItemIngredientCount,
  getRecipeMappingCoverage,
  hasRecipeMapping,
} from '../../../../lib/recipes';

const emptyIngredientForm = {
  inventoryItemId: '',
  quantity: '',
  unit: '',
  notes: '',
};

const unitOptions = getInventoryUnitOptions();

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

function formatQuantity(value) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 }).format(Number(value || 0));
}

function getStockStatusBadgeClass(status) {
  if (status === 'OUT_OF_STOCK') {
    return 'rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-700';
  }
  if (status === 'LOW_STOCK') {
    return 'rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800';
  }
  return 'rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-700';
}

export default function RecipesClient() {
  const admin = useAdmin();
  const canManage = ['ADMIN', 'MANAGER'].includes(admin?.role);
  const [menuItems, setMenuItems] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [selectedMenuItemId, setSelectedMenuItemId] = useState('');
  const [ingredientForm, setIngredientForm] = useState(emptyIngredientForm);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState('');
  const [coverageFilter, setCoverageFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await apiRequest('/api/admin/recipes/menu-items');
      const nextMenuItems = data.menuItems || [];
      setMenuItems(nextMenuItems);
      setInventoryItems(data.inventoryItems || []);
      setSelectedMenuItemId((currentId) => {
        if (currentId && nextMenuItems.some((item) => item.id === currentId)) return currentId;
        return nextMenuItems[0]?.id || '';
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const mappingCoverage = useMemo(() => getRecipeMappingCoverage(menuItems), [menuItems]);

  const mappingSummaryItems = useMemo(
    () => [
      { label: 'Total menu items', value: mappingCoverage.totalMenuItems },
      { label: 'Mapped menu items', value: mappingCoverage.mappedMenuItems },
      { label: 'Unmapped menu items', value: mappingCoverage.unmappedMenuItems },
      { label: 'Total ingredient mappings', value: mappingCoverage.totalIngredientMappings },
    ],
    [mappingCoverage],
  );

  const filteredMenuItems = useMemo(() => {
    const query = search.trim().toLowerCase();

    return menuItems.filter((item) => {
      const matchesSearch = query
        ? [item.name, item.categoryName]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(query)
        : true;
      const matchesCoverage =
        coverageFilter === 'ALL' ||
        (coverageFilter === 'MAPPED' && hasRecipeMapping(item)) ||
        (coverageFilter === 'UNMAPPED' && !hasRecipeMapping(item));

      return matchesSearch && matchesCoverage;
    });
  }, [coverageFilter, menuItems, search]);

  const selectedMenuItem = useMemo(
    () => menuItems.find((item) => item.id === selectedMenuItemId) || null,
    [menuItems, selectedMenuItemId],
  );

  const selectedInventoryItem = useMemo(
    () => inventoryItems.find((item) => item.id === ingredientForm.inventoryItemId) || null,
    [inventoryItems, ingredientForm.inventoryItemId],
  );

  const selectedIngredientCount = useMemo(
    () => (selectedMenuItem ? getMenuItemIngredientCount(selectedMenuItem) : 0),
    [selectedMenuItem],
  );

  const resetIngredientForm = () => {
    setEditingId(null);
    setIngredientForm(emptyIngredientForm);
  };

  const handleInventoryChange = (inventoryItemId) => {
    const inventoryItem = inventoryItems.find((item) => item.id === inventoryItemId);
    setIngredientForm((prev) => ({
      ...prev,
      inventoryItemId,
      unit: editingId ? prev.unit : inventoryItem?.unit || prev.unit,
    }));
  };

  const handleEdit = (ingredient) => {
    setEditingId(ingredient.id);
    setIngredientForm({
      inventoryItemId: ingredient.inventoryItemId || '',
      quantity: String(ingredient.quantity ?? ''),
      unit: ingredient.unit || '',
      notes: ingredient.notes || '',
    });
    setError(null);
    setMessage(null);
  };

  const handleIngredientSubmit = async (event) => {
    event.preventDefault();
    if (!canManage) return;

    if (!selectedMenuItemId) {
      setError('Choose a menu item before adding ingredients.');
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const payload = {
        menuItemId: selectedMenuItemId,
        inventoryItemId: ingredientForm.inventoryItemId,
        quantity: Number(ingredientForm.quantity),
        unit: normalizeInventoryUnit(ingredientForm.unit),
        notes: ingredientForm.notes.trim() || null,
      };
      await apiRequest(
        editingId ? `/api/admin/recipes/ingredients/${editingId}` : '/api/admin/recipes/ingredients',
        {
          method: editingId ? 'PUT' : 'POST',
          body: JSON.stringify(payload),
        },
      );
      setMessage(editingId ? 'Recipe ingredient updated' : 'Recipe ingredient added');
      resetIngredientForm();
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (ingredient) => {
    setError(null);
    setMessage(null);

    try {
      await apiRequest(`/api/admin/recipes/ingredients/${ingredient.id}`, { method: 'DELETE' });
      setMessage('Recipe ingredient removed');
      if (editingId === ingredient.id) resetIngredientForm();
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Recipes"
        description="Map menu items to inventory ingredients for future recipe consumption."
      />

      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        This defines recipe usage only. It does not deduct stock yet.
      </div>
      {!canManage && (
        <div className="rounded-lg border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-700">
          SUPPORT users can view recipe mappings, but only ADMIN and MANAGER users can change them.
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}
      {message && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {mappingSummaryItems.map((item) => (
          <div key={item.label} className="rounded-lg border border-neutral-200 bg-white px-4 py-3">
            <p className="text-xs font-semibold uppercase text-neutral-500">{item.label}</p>
            <p className="mt-1 text-2xl font-bold text-neutral-950">{item.value}</p>
          </div>
        ))}
      </div>

      <div className={canManage ? 'grid gap-4 xl:grid-cols-[minmax(260px,0.8fr),minmax(0,1.2fr)]' : 'grid gap-4'}>
        <div className="space-y-4">
          <AdminCard
            title="Menu items"
            description="Select a menu item to view and edit ingredient mappings."
            actions={loading && <span className="text-xs text-neutral-500">Refreshing...</span>}
          >
            <div className="mb-3 space-y-2">
              <label className="text-sm font-semibold text-neutral-800">Search</label>
              <input
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Menu item or category"
              />
            </div>
            <div className="mb-3 space-y-2">
              <label className="text-sm font-semibold text-neutral-800">Mapping filter</label>
              <select
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                value={coverageFilter}
                onChange={(event) => setCoverageFilter(event.target.value)}
              >
                <option value="ALL">All</option>
                <option value="MAPPED">Mapped</option>
                <option value="UNMAPPED">Unmapped</option>
              </select>
            </div>
            <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
              {filteredMenuItems.map((item) => {
                const ingredientCount = getMenuItemIngredientCount(item);
                const isMapped = hasRecipeMapping(item);
                const isSelected = selectedMenuItemId === item.id;

                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                      isSelected
                        ? 'border-primary bg-primary/10 text-secondary ring-2 ring-primary/20'
                        : 'border-neutral-200 bg-white hover:bg-neutral-50'
                    }`}
                    onClick={() => {
                      setSelectedMenuItemId(item.id);
                      resetIngredientForm();
                    }}
                  >
                    <span className="flex items-start justify-between gap-2">
                      <span>
                        <span className="block text-sm font-semibold">{item.name}</span>
                        <span className="text-xs text-neutral-500">
                          {item.categoryName || 'No category'} - {ingredientCount} ingredients
                        </span>
                      </span>
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-semibold ${
                          isMapped ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {isMapped ? 'Mapped' : 'Unmapped'}
                      </span>
                    </span>
                  </button>
                );
              })}
              {!loading && filteredMenuItems.length === 0 && (
                <p className="rounded-lg border border-neutral-200 px-3 py-4 text-center text-sm text-neutral-500">
                  No menu items found
                </p>
              )}
            </div>
          </AdminCard>

          {canManage && (
            <AdminCard
              title={editingId ? 'Edit ingredient' : 'Add ingredient'}
              description="Choose an active inventory item and the quantity used by the selected menu item."
            >
              <AdminForm
                onSubmit={handleIngredientSubmit}
                submitLabel={editingId ? 'Save ingredient' : 'Add ingredient'}
                submitting={saving}
                submitDisabled={!selectedMenuItemId}
                secondaryAction={
                  editingId ? (
                    <button
                      type="button"
                      className="text-sm font-semibold text-neutral-700 underline"
                      onClick={resetIngredientForm}
                    >
                      Cancel edit
                    </button>
                  ) : null
                }
              >
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-neutral-800">Inventory item</label>
                  <select
                    className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                    value={ingredientForm.inventoryItemId}
                    onChange={(event) => handleInventoryChange(event.target.value)}
                    required
                  >
                    <option value="">Choose inventory item</option>
                    {inventoryItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} ({formatQuantity(item.currentStock)} {item.unit})
                      </option>
                    ))}
                  </select>
                </div>

                {selectedInventoryItem && (
                  <div className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-secondary">
                    <p className="font-semibold">Selected inventory stock</p>
                    <div className="mt-2 grid gap-2 sm:grid-cols-3">
                      <p>
                        <span className="block text-xs font-semibold uppercase text-secondary/70">Current stock</span>
                        {formatQuantity(selectedInventoryItem.currentStock)} {selectedInventoryItem.unit}
                      </p>
                      <p>
                        <span className="block text-xs font-semibold uppercase text-secondary/70">Status</span>
                        {selectedInventoryItem.stockStatusLabel}
                      </p>
                      <p>
                        <span className="block text-xs font-semibold uppercase text-secondary/70">Recipe unit</span>
                        {selectedInventoryItem.unit}
                      </p>
                    </div>
                  </div>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-neutral-800">Quantity</label>
                    <input
                      type="number"
                      min="0.001"
                      step="0.001"
                      className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                      value={ingredientForm.quantity}
                      onChange={(event) => setIngredientForm((prev) => ({ ...prev, quantity: event.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-neutral-800">Unit</label>
                    <input
                      className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                      value={ingredientForm.unit}
                      onChange={(event) => setIngredientForm((prev) => ({ ...prev, unit: event.target.value }))}
                      list="recipe-unit-options"
                      placeholder="kg"
                      required
                    />
                    <datalist id="recipe-unit-options">
                      {unitOptions.map((unit) => (
                        <option key={unit.value} value={unit.value}>
                          {unit.label}
                        </option>
                      ))}
                    </datalist>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-neutral-800">Notes optional</label>
                  <textarea
                    className="min-h-[72px] w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                    value={ingredientForm.notes}
                    onChange={(event) => setIngredientForm((prev) => ({ ...prev, notes: event.target.value }))}
                    placeholder="Prep note, trimming note, or usage context"
                  />
                </div>
              </AdminForm>
            </AdminCard>
          )}
        </div>

        <AdminCard
          title={selectedMenuItem ? selectedMenuItem.name : 'Ingredient mappings'}
          description="Inventory items and quantities mapped to this menu item."
        >
          {selectedMenuItem && (
            <div className="mb-4 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase text-neutral-500">Selected menu item</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <p className="text-base font-semibold text-neutral-950">{selectedMenuItem.name}</p>
                <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-neutral-600">
                  {selectedMenuItem.categoryName || 'No category'}
                </span>
                <span
                  className={`rounded-full px-2 py-1 text-xs font-semibold ${
                    selectedIngredientCount > 0 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {selectedIngredientCount > 0 ? 'Mapped' : 'Unmapped'}
                </span>
              </div>
            </div>
          )}

          {selectedMenuItem && !loading && selectedIngredientCount === 0 && (
            <div className="mb-4 rounded-lg border border-dashed border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <p className="font-semibold">No ingredients mapped yet</p>
              <p>Choose an inventory item and quantity to start mapping this recipe.</p>
            </div>
          )}

          <AdminTable
            dense
            columns={[
              {
                key: 'inventoryItemName',
                header: 'Ingredient',
                render: (value, row) => (
                  <div>
                    <p className="font-semibold text-neutral-900">{value || 'Inventory item'}</p>
                    <p className="text-xs text-neutral-500">{row.inventoryItemSku || 'No SKU'}</p>
                  </div>
                ),
              },
              {
                key: 'quantity',
                header: 'Recipe usage',
                render: (value, row) => (
                  <span className="font-semibold text-neutral-900">
                    {formatQuantity(value)} {row.unit}
                  </span>
                ),
              },
              {
                key: 'inventoryItemStock',
                header: 'Current stock',
                render: (value, row) => (
                  <div>
                    <p className="font-semibold text-neutral-900">
                      {value === null || value === undefined ? '-' : `${formatQuantity(value)} ${row.inventoryItemUnit || ''}`}
                    </p>
                    {row.inventoryItemStockStatusLabel && (
                      <span className={getStockStatusBadgeClass(row.inventoryItemStockStatus)}>
                        {row.inventoryItemStockStatusLabel}
                      </span>
                    )}
                  </div>
                ),
              },
              {
                key: 'notes',
                header: 'Notes',
                render: (value) => value || '-',
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
                    {canManage && (
                      <ConfirmDialog
                        confirmLabel="Remove"
                        title="Remove recipe ingredient?"
                        description={`Remove ${row.inventoryItemName || 'this ingredient'} from ${selectedMenuItem?.name || 'this menu item'}?`}
                        onConfirm={() => handleDelete(row)}
                        trigger={
                          <button className="rounded-md border border-red-200 px-2 py-1 text-xs font-semibold text-red-600 transition hover:bg-red-50">
                            Remove
                          </button>
                        }
                      />
                    )}
                  </div>
                ),
              },
            ]}
            rows={selectedMenuItem?.ingredients || []}
            emptyMessage={loading ? 'Loading recipe mappings...' : 'No ingredients mapped to this menu item yet'}
          />
        </AdminCard>
      </div>
    </div>
  );
}
