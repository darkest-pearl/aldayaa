'use client';

import { useEffect, useMemo, useState } from 'react';
import { getInventoryUnitOptions, normalizeInventoryUnit } from '../../../../../lib/inventory';
import {
  getMenuItemIngredientCount,
  getRecipeMappingCoverage,
  hasRecipeMapping,
} from '../../../../../lib/recipes';

const emptyIngredientForm = {
  inventoryItemId: '',
  quantity: '',
  unit: '',
  notes: '',
};

const allFilterValue = 'ALL';
const inputClass = 'rounded-md border border-neutral-200 px-3 py-2 text-sm outline-none transition focus:border-emerald-700 disabled:bg-neutral-50 disabled:text-neutral-500';
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

function formatQuantity(value) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 }).format(Number(value || 0));
}

function formatMoney(value) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(Number(value || 0));
}

function getStockBadgeClass(status) {
  if (status === 'OUT_OF_STOCK') return 'rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-700';
  if (status === 'LOW_STOCK') return 'rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800';
  return 'rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-700';
}

function getIngredientPayload(restaurantSlug, form, ingredientId = '') {
  return {
    restaurantSlug,
    ...(ingredientId ? { ingredientId } : {}),
    inventoryItemId: form.inventoryItemId,
    quantity: Number(form.quantity || 0),
    unit: normalizeInventoryUnit(form.unit),
    notes: form.notes.trim() || null,
  };
}

export default function TenantRecipesClient({ restaurantSlug, staffRole }) {
  const writable = canWrite(staffRole);
  const [recipes, setRecipes] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [selectedRecipeId, setSelectedRecipeId] = useState('');
  const [ingredientForm, setIngredientForm] = useState(emptyIngredientForm);
  const [editingIngredientId, setEditingIngredientId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [search, setSearch] = useState('');
  const [coverageFilter, setCoverageFilter] = useState(allFilterValue);

  async function load(showLoading = true) {
    if (showLoading) setLoading(true);
    setError('');
    try {
      const data = await apiRequest(`/api/restaurant-admin/recipes?restaurantSlug=${encodeURIComponent(restaurantSlug)}`);
      const nextRecipes = data.recipes || [];
      setRecipes(nextRecipes);
      setInventoryItems(data.inventoryItems || []);
      setSelectedRecipeId((currentId) => {
        if (currentId && nextRecipes.some((recipe) => recipe.id === currentId)) return currentId;
        return nextRecipes[0]?.id || '';
      });
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

  const coverage = useMemo(() => getRecipeMappingCoverage(recipes), [recipes]);
  const filteredRecipes = useMemo(() => {
    const query = search.trim().toLowerCase();
    return recipes.filter((recipe) => {
      const matchesSearch = !query || [recipe.name, recipe.categoryName]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query);
      const matchesCoverage =
        coverageFilter === allFilterValue ||
        (coverageFilter === 'MAPPED' && hasRecipeMapping(recipe)) ||
        (coverageFilter === 'UNMAPPED' && !hasRecipeMapping(recipe));
      return matchesSearch && matchesCoverage;
    });
  }, [coverageFilter, recipes, search]);
  const selectedRecipe = useMemo(
    () => recipes.find((recipe) => recipe.id === selectedRecipeId) || null,
    [recipes, selectedRecipeId],
  );
  const selectedInventoryItem = useMemo(
    () => inventoryItems.find((item) => item.id === ingredientForm.inventoryItemId) || null,
    [ingredientForm.inventoryItemId, inventoryItems],
  );

  function resetIngredientForm() {
    setEditingIngredientId('');
    setIngredientForm(emptyIngredientForm);
  }

  function handleInventoryChange(inventoryItemId) {
    const inventoryItem = inventoryItems.find((item) => item.id === inventoryItemId);
    setIngredientForm((current) => ({
      ...current,
      inventoryItemId,
      unit: editingIngredientId ? current.unit : inventoryItem?.unit || current.unit,
    }));
  }

  function startEditIngredient(ingredient) {
    setEditingIngredientId(ingredient.id);
    setIngredientForm({
      inventoryItemId: ingredient.inventoryItemId || '',
      quantity: String(ingredient.quantity ?? ''),
      unit: ingredient.unit || '',
      notes: ingredient.notes || '',
    });
    setError('');
    setSuccessMessage('');
  }

  async function submitIngredient(event) {
    event.preventDefault();
    if (!writable || !selectedRecipeId) return;
    setSaving(true);
    setError('');
    setSuccessMessage('');

    try {
      await apiRequest(`/api/restaurant-admin/recipes/${selectedRecipeId}/ingredients`, {
        method: editingIngredientId ? 'PUT' : 'POST',
        body: JSON.stringify(getIngredientPayload(restaurantSlug, ingredientForm, editingIngredientId)),
      });
      setSuccessMessage(editingIngredientId ? 'Recipe ingredient updated.' : 'Recipe ingredient added.');
      resetIngredientForm();
      await load(false);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function removeIngredient(ingredient) {
    if (!writable || !selectedRecipeId) return;
    if (!window.confirm(`Remove ${ingredient.inventoryItemName || 'this ingredient'} from this recipe?`)) return;
    setError('');
    setSuccessMessage('');

    try {
      await apiRequest(`/api/restaurant-admin/recipes/${selectedRecipeId}/ingredients`, {
        method: 'DELETE',
        body: JSON.stringify({ restaurantSlug, ingredientId: ingredient.id }),
      });
      setSuccessMessage('Recipe ingredient removed.');
      if (editingIngredientId === ingredient.id) resetIngredientForm();
      await load(false);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  return (
    <div className="space-y-5">
      {error ? <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div> : null}
      {successMessage ? <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{successMessage}</div> : null}
      {loading ? <div className="rounded-md border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-600">Loading recipes...</div> : null}
      {!writable ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          SUPPORT access is read-only. OWNER or MANAGER access is required to change recipe mappings.
        </div>
      ) : null}
      <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950">
        Recipe linkage only. No order consumption, stock depletion, inventory movement, supplier, invoice, payment,
        messaging, billing, domain, CRM, payroll, or analytics workflow is triggered.
      </div>

      <section className="grid gap-3 md:grid-cols-4">
        <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-normal text-neutral-500">Menu items</p>
          <p className="mt-1 text-2xl font-semibold">{coverage.totalMenuItems}</p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-normal text-neutral-500">Mapped</p>
          <p className="mt-1 text-2xl font-semibold">{coverage.mappedMenuItems}</p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-normal text-neutral-500">Unmapped</p>
          <p className="mt-1 text-2xl font-semibold">{coverage.unmappedMenuItems}</p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-normal text-neutral-500">Ingredient lines</p>
          <p className="mt-1 text-2xl font-semibold">{coverage.totalIngredientMappings}</p>
        </div>
      </section>

      <section className={writable ? 'grid gap-4 xl:grid-cols-[minmax(260px,0.9fr),minmax(0,1.1fr)]' : 'grid gap-4'}>
        <div className="space-y-4">
          <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-semibold">Menu items</h2>
                <p className="mt-1 text-sm text-neutral-600">Select a menu item to manage its recipe ingredients.</p>
              </div>
              <button type="button" onClick={() => load(false)} disabled={loading} className="rounded-md border border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-700">
                Refresh
              </button>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <input className={inputClass} placeholder="Search menu items" value={search} onChange={(event) => setSearch(event.target.value)} />
              <select className={inputClass} value={coverageFilter} onChange={(event) => setCoverageFilter(event.target.value)}>
                <option value={allFilterValue}>All mapping states</option>
                <option value="MAPPED">Mapped</option>
                <option value="UNMAPPED">Unmapped</option>
              </select>
            </div>
            <div className="mt-4 max-h-[560px] space-y-2 overflow-y-auto pr-1">
              {filteredRecipes.length ? filteredRecipes.map((recipe) => {
                const ingredientCount = getMenuItemIngredientCount(recipe);
                const mapped = hasRecipeMapping(recipe);
                const selected = selectedRecipeId === recipe.id;
                return (
                  <button
                    key={recipe.id}
                    type="button"
                    onClick={() => {
                      setSelectedRecipeId(recipe.id);
                      resetIngredientForm();
                    }}
                    className={`w-full rounded-md border px-3 py-2 text-left transition ${
                      selected ? 'border-emerald-700 bg-emerald-50' : 'border-neutral-200 bg-white hover:bg-neutral-50'
                    }`}
                  >
                    <span className="flex items-start justify-between gap-2">
                      <span>
                        <span className="block text-sm font-semibold">{recipe.name}</span>
                        <span className="text-xs text-neutral-500">
                          {recipe.categoryName || 'No category'} - {ingredientCount} ingredients
                        </span>
                      </span>
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${mapped ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-800'}`}>
                        {mapped ? 'Mapped' : 'Unmapped'}
                      </span>
                    </span>
                  </button>
                );
              }) : (
                <p className="rounded-md border border-dashed border-neutral-200 px-4 py-6 text-center text-sm text-neutral-500">
                  {loading ? 'Loading menu items...' : 'No menu items match these filters.'}
                </p>
              )}
            </div>
          </div>

          {writable ? (
            <form onSubmit={submitIngredient} className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
              <h2 className="text-lg font-semibold">{editingIngredientId ? 'Edit ingredient' : 'Add ingredient'}</h2>
              <p className="mt-1 text-sm text-neutral-600">Choose an active inventory item and quantity for the selected menu item.</p>
              <div className="mt-4 grid gap-3">
                <select className={inputClass} required disabled={saving || !selectedRecipeId} value={ingredientForm.inventoryItemId} onChange={(event) => handleInventoryChange(event.target.value)}>
                  <option value="">Select tenant inventory item</option>
                  {inventoryItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({formatQuantity(item.currentStock)} {item.unit})
                    </option>
                  ))}
                </select>
                {selectedInventoryItem ? (
                  <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-700">
                    <p className="font-semibold">{selectedInventoryItem.name}</p>
                    <p>
                      Stock: {formatQuantity(selectedInventoryItem.currentStock)} {selectedInventoryItem.unit} - {selectedInventoryItem.stockStatusLabel}
                    </p>
                    <p>Cost/unit: {selectedInventoryItem.costPerUnit === null ? 'Not set' : `AED ${formatMoney(selectedInventoryItem.costPerUnit)}`}</p>
                  </div>
                ) : null}
                <div className="grid gap-3 sm:grid-cols-2">
                  <input className={inputClass} required type="number" min="0.001" step="0.001" disabled={saving || !selectedRecipeId} placeholder="Quantity" value={ingredientForm.quantity} onChange={(event) => setIngredientForm((current) => ({ ...current, quantity: event.target.value }))} />
                  <input className={inputClass} required disabled={saving || !selectedRecipeId} list="tenant-recipe-unit-options" placeholder="Unit" value={ingredientForm.unit} onChange={(event) => setIngredientForm((current) => ({ ...current, unit: event.target.value }))} />
                  <datalist id="tenant-recipe-unit-options">
                    {unitOptions.map((unit) => <option key={unit.value} value={unit.value}>{unit.label}</option>)}
                  </datalist>
                </div>
                <textarea className={`${inputClass} min-h-[78px]`} disabled={saving || !selectedRecipeId} placeholder="Prep or usage notes" value={ingredientForm.notes} onChange={(event) => setIngredientForm((current) => ({ ...current, notes: event.target.value }))} />
                <div className="flex flex-wrap gap-2">
                  <button type="submit" disabled={saving || !selectedRecipeId} className="rounded-md bg-[#10241f] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
                    {saving ? 'Saving...' : editingIngredientId ? 'Update ingredient' : 'Add ingredient'}
                  </button>
                  {editingIngredientId ? (
                    <button type="button" onClick={resetIngredientForm} className="rounded-md border border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-700">
                      Cancel edit
                    </button>
                  ) : null}
                </div>
              </div>
            </form>
          ) : null}
        </div>

        <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold">{selectedRecipe?.name || 'Recipe details'}</h2>
          {selectedRecipe ? (
            <div className="mt-3 rounded-md bg-neutral-50 px-3 py-2 text-sm text-neutral-700">
              <p>{selectedRecipe.categoryName || 'No category'} - AED {formatMoney(selectedRecipe.price)}</p>
              <p>Estimated recipe cost: AED {formatMoney(selectedRecipe.estimatedCost)}</p>
              {selectedRecipe.missingCostCount ? <p>{selectedRecipe.missingCostCount} ingredient costs are not set.</p> : null}
              {selectedRecipe.lowStockIngredientCount ? <p className="font-semibold text-amber-800">{selectedRecipe.lowStockIngredientCount} linked ingredients need stock attention.</p> : null}
            </div>
          ) : (
            <p className="mt-3 rounded-md border border-dashed border-neutral-200 px-4 py-6 text-center text-sm text-neutral-500">
              {loading ? 'Loading recipe details...' : 'Select a menu item to manage its recipe.'}
            </p>
          )}

          {selectedRecipe && !selectedRecipe.ingredients.length ? (
            <div className="mt-4 rounded-md border border-dashed border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <p className="font-semibold">No ingredients mapped yet.</p>
              <p>Add tenant inventory items to define this menu item's recipe. This will not deduct stock.</p>
            </div>
          ) : null}

          <div className="mt-4 grid gap-3">
            {selectedRecipe?.ingredients.map((ingredient) => (
              <article key={ingredient.id} className="rounded-md border border-neutral-100 px-3 py-3">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{ingredient.inventoryItemName || 'Inventory item'}</h3>
                      {ingredient.inventoryItemStockStatusLabel ? (
                        <span className={getStockBadgeClass(ingredient.inventoryItemStockStatus)}>
                          {ingredient.inventoryItemStockStatusLabel}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-neutral-600">
                      Uses {formatQuantity(ingredient.quantity)} {ingredient.unit}
                    </p>
                    <p className="text-xs text-neutral-500">
                      Stock: {ingredient.inventoryItemStock === null ? 'Not recorded' : `${formatQuantity(ingredient.inventoryItemStock)} ${ingredient.inventoryItemUnit || ''}`}
                    </p>
                    <p className="text-xs text-neutral-500">
                      Estimated line cost: {ingredient.estimatedCost === null ? 'Not set' : `AED ${formatMoney(ingredient.estimatedCost)}`}
                    </p>
                    {ingredient.notes ? <p className="mt-2 rounded-md bg-neutral-50 px-3 py-2 text-sm text-neutral-700">{ingredient.notes}</p> : null}
                  </div>
                  {writable ? (
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => startEditIngredient(ingredient)} className="rounded-md border border-neutral-200 px-3 py-2 text-sm font-semibold text-neutral-700">
                        Edit
                      </button>
                      <button type="button" onClick={() => removeIngredient(ingredient)} className="rounded-md border border-red-200 px-3 py-2 text-sm font-semibold text-red-700">
                        Remove
                      </button>
                    </div>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
