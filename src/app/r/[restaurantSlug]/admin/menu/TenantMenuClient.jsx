'use client';

import { useEffect, useMemo, useState } from 'react';

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

function canWrite(role) {
  return role === 'OWNER' || role === 'MANAGER';
}

const inputClass = 'rounded-md border border-neutral-200 px-3 py-2 text-sm outline-none transition focus:border-emerald-700';

export default function TenantMenuClient({ restaurantSlug, staffRole }) {
  const writable = canWrite(staffRole);
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [categoryForm, setCategoryForm] = useState({ name: '', description: '', sortOrder: 0 });
  const [itemForm, setItemForm] = useState({
    name: '',
    description: '',
    price: '',
    categoryId: '',
    imageUrl: '',
    isAvailable: true,
    recommended: false,
    isSignature: false,
  });

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [categoryData, itemData] = await Promise.all([
        apiRequest(`/api/restaurant-admin/menu/categories?restaurantSlug=${encodeURIComponent(restaurantSlug)}`),
        apiRequest(`/api/restaurant-admin/menu/items?restaurantSlug=${encodeURIComponent(restaurantSlug)}`),
      ]);
      setCategories(categoryData.categories || []);
      setItems(itemData.items || []);
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

  async function submitCategory(event) {
    event.preventDefault();
    if (!writable) return;
    try {
      await apiRequest('/api/restaurant-admin/menu/categories', {
        method: 'POST',
        body: JSON.stringify({
          restaurantSlug,
          name: categoryForm.name,
          description: categoryForm.description,
          sortOrder: Number(categoryForm.sortOrder) || 0,
        }),
      });
      setCategoryForm({ name: '', description: '', sortOrder: 0 });
      await load();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function submitItem(event) {
    event.preventDefault();
    if (!writable) return;
    try {
      await apiRequest('/api/restaurant-admin/menu/items', {
        method: 'POST',
        body: JSON.stringify({
          ...itemForm,
          restaurantSlug,
          price: Number(itemForm.price) || 0,
        }),
      });
      setItemForm({
        name: '',
        description: '',
        price: '',
        categoryId: '',
        imageUrl: '',
        isAvailable: true,
        recommended: false,
        isSignature: false,
      });
      await load();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function toggleItem(item, field) {
    if (!writable) return;
    try {
      await apiRequest(`/api/restaurant-admin/menu/items/${item.id}`, {
        method: 'PUT',
        body: JSON.stringify({ restaurantSlug, [field]: !item[field] }),
      });
      await load();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function deleteCategory(category) {
    if (!writable) return;
    try {
      await apiRequest(`/api/restaurant-admin/menu/categories/${category.id}?restaurantSlug=${encodeURIComponent(restaurantSlug)}`, {
        method: 'DELETE',
      });
      await load();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function deleteItem(item) {
    if (!writable) return;
    try {
      await apiRequest(`/api/restaurant-admin/menu/items/${item.id}?restaurantSlug=${encodeURIComponent(restaurantSlug)}`, {
        method: 'DELETE',
      });
      await load();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  const categoryById = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);

  return (
    <div className="space-y-5">
      {error ? <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div> : null}
      {!writable ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          SUPPORT access is read-only. OWNER or MANAGER access is required to change menu content.
        </div>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-2">
        <form onSubmit={submitCategory} className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold">Add category</h2>
          <div className="mt-4 grid gap-3">
            <input className={inputClass} required disabled={!writable} placeholder="Category name" value={categoryForm.name} onChange={(event) => setCategoryForm((form) => ({ ...form, name: event.target.value }))} />
            <textarea className={inputClass} disabled={!writable} placeholder="Description" value={categoryForm.description} onChange={(event) => setCategoryForm((form) => ({ ...form, description: event.target.value }))} />
            <input className={inputClass} disabled={!writable} type="number" placeholder="Sort order" value={categoryForm.sortOrder} onChange={(event) => setCategoryForm((form) => ({ ...form, sortOrder: event.target.value }))} />
            <button disabled={!writable} className="rounded-md bg-[#10241f] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">Save category</button>
          </div>
        </form>

        <form onSubmit={submitItem} className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold">Add menu item</h2>
          <div className="mt-4 grid gap-3">
            <input className={inputClass} required disabled={!writable} placeholder="Item name" value={itemForm.name} onChange={(event) => setItemForm((form) => ({ ...form, name: event.target.value }))} />
            <textarea className={inputClass} disabled={!writable} placeholder="Description" value={itemForm.description} onChange={(event) => setItemForm((form) => ({ ...form, description: event.target.value }))} />
            <input className={inputClass} required disabled={!writable} type="number" step="0.01" placeholder="Price" value={itemForm.price} onChange={(event) => setItemForm((form) => ({ ...form, price: event.target.value }))} />
            <select className={inputClass} required disabled={!writable} value={itemForm.categoryId} onChange={(event) => setItemForm((form) => ({ ...form, categoryId: event.target.value }))}>
              <option value="">Select category</option>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
            <input className={inputClass} disabled={!writable} placeholder="Image URL or /path" value={itemForm.imageUrl} onChange={(event) => setItemForm((form) => ({ ...form, imageUrl: event.target.value }))} />
            <div className="flex flex-wrap gap-3 text-sm text-neutral-700">
              {[
                ['isAvailable', 'Available'],
                ['recommended', 'Recommended'],
                ['isSignature', 'Signature'],
              ].map(([field, label]) => (
                <label key={field} className="flex items-center gap-2">
                  <input type="checkbox" disabled={!writable} checked={Boolean(itemForm[field])} onChange={(event) => setItemForm((form) => ({ ...form, [field]: event.target.checked }))} />
                  {label}
                </label>
              ))}
            </div>
            <button disabled={!writable} className="rounded-md bg-[#10241f] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">Save item</button>
          </div>
        </form>
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold">Categories</h2>
        <div className="mt-3 grid gap-2">
          {categories.length ? categories.map((category) => (
            <div key={category.id} className="flex flex-col gap-2 rounded-md border border-neutral-100 px-3 py-2 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-semibold">{category.name}</p>
                <p className="text-sm text-neutral-600">{category.description || 'No description'} · order {category.sortOrder}</p>
              </div>
              <button disabled={!writable} onClick={() => deleteCategory(category)} className="text-left text-sm font-semibold text-red-700 disabled:cursor-not-allowed disabled:opacity-40">Delete</button>
            </div>
          )) : <p className="text-sm text-neutral-500">{loading ? 'Loading categories...' : 'No menu categories yet.'}</p>}
        </div>
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold">Menu items</h2>
        <div className="mt-3 grid gap-3">
          {items.length ? items.map((item) => (
            <div key={item.id} className="rounded-md border border-neutral-100 px-3 py-3">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="font-semibold">{item.name}</p>
                  <p className="text-sm text-neutral-600">{categoryById.get(item.categoryId)?.name || item.category?.name || 'Uncategorized'} · AED {Number(item.price).toFixed(2)}</p>
                  {item.description ? <p className="mt-1 text-sm text-neutral-600">{item.description}</p> : null}
                </div>
                <button disabled={!writable} onClick={() => deleteItem(item)} className="text-left text-sm font-semibold text-red-700 disabled:cursor-not-allowed disabled:opacity-40">Delete</button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {[
                  ['isAvailable', item.isAvailable ? 'Available' : 'Unavailable'],
                  ['recommended', item.recommended ? 'Recommended' : 'Not recommended'],
                  ['isSignature', item.isSignature ? 'Signature' : 'Standard'],
                ].map(([field, label]) => (
                  <button key={field} disabled={!writable} onClick={() => toggleItem(item, field)} className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-700 disabled:cursor-not-allowed disabled:opacity-50">{label}</button>
                ))}
              </div>
            </div>
          )) : <p className="text-sm text-neutral-500">{loading ? 'Loading menu items...' : 'No menu items yet.'}</p>}
        </div>
      </section>
    </div>
  );
}
