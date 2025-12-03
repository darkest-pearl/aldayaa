'use client';

import { useEffect, useMemo, useState } from 'react';
import AdminCard from '../../components/AdminCard.jsx';
import AdminForm from '../../components/AdminForm.jsx';
import AdminPageHeader from '../../components/AdminPageHeader.jsx';
import AdminTable from '../../components/AdminTable.jsx';
import ConfirmDialog from '../../components/ConfirmDialog.jsx';

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

export default function MenuClient() {
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [availabilityFilter, setAvailabilityFilter] = useState('ALL');

  const [categoryForm, setCategoryForm] = useState({
    name: '',
    description: '',
    sortOrder: 0,
  });

  const [itemForm, setItemForm] = useState({
    name: '',
    description: '',
    price: '',
    categoryId: '',
    imageUrl: '',
    recommended: false,
  });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [catData, itemData] = await Promise.all([
        apiRequest('/api/menu/categories'),
        apiRequest('/api/menu/items'),
      ]);

      setCategories(catData.categories || []);
      setItems(itemData.items || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCategorySubmit = async (e) => {
    e.preventDefault();
    try {
      await apiRequest('/api/menu/categories', {
        method: 'POST',
        body: JSON.stringify({
          ...categoryForm,
          sortOrder: Number(categoryForm.sortOrder) || 0,
        }),
      });
      setCategoryForm({ name: '', description: '', sortOrder: 0 });
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const deleteCategory = async (id) => {
    try {
      await apiRequest('/api/menu/categories', {
        method: 'DELETE',
        body: JSON.stringify({ id }),
      });
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const toggleItemField = async (id, field) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;

    try {
      await apiRequest('/api/menu/items', {
        method: 'PUT',
        body: JSON.stringify({
          id,
          [field]: !item[field],
        }),
      });
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleItemSubmit = async (e) => {
    e.preventDefault();
    try {
      await apiRequest('/api/menu/items', {
        method: 'POST',
        body: JSON.stringify({
          ...itemForm,
          price: Number(itemForm.price) || 0,
        }),
      });
      setItemForm({
        name: '',
        description: '',
        price: '',
        categoryId: '',
        imageUrl: '',
        recommended: false,
      });
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const deleteItem = async (id) => {
    try {
      await apiRequest('/api/menu/items', {
        method: 'DELETE',
        body: JSON.stringify({ id }),
      });
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const filteredItems = useMemo(() => {
    return (items || []).filter((item) => {
      const q = search.toLowerCase().trim();
      if (q) {
        const haystack = [
          item.name,
          item.description,
          categories.find((c) => c.id === item.categoryId)?.name,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      if (categoryFilter !== 'ALL' && item.categoryId !== categoryFilter) {
        return false;
      }

      if (availabilityFilter === 'AVAILABLE' && !item.isAvailable) return false;
      if (availabilityFilter === 'UNAVAILABLE' && item.isAvailable) return false;

      return true;
    });
  }, [items, search, categoryFilter, availabilityFilter, categories]);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Menu"
        description="Manage categories, dishes, visibility, and recommendations."
      />

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Categories */}
      <div className="grid gap-4 lg:grid-cols-2">
        <AdminCard title="Add category" description="Create a new menu category.">
          <AdminForm onSubmit={handleCategorySubmit} submitLabel="Save category">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-neutral-800">Name</label>
              <input
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                value={categoryForm.name}
                onChange={(e) =>
                  setCategoryForm((f) => ({ ...f, name: e.target.value }))
                }
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-neutral-800">
                Description
              </label>
              <textarea
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                value={categoryForm.description}
                onChange={(e) =>
                  setCategoryForm((f) => ({
                    ...f,
                    description: e.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-neutral-800">
                Sort order
              </label>
              <input
                type="number"
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                value={categoryForm.sortOrder}
                onChange={(e) =>
                  setCategoryForm((f) => ({
                    ...f,
                    sortOrder: e.target.value,
                  }))
                }
              />
            </div>
          </AdminForm>
        </AdminCard>

        <AdminCard title="Categories">
          <AdminTable
            columns={[
              { key: 'name', header: 'Name' },
              { key: 'description', header: 'Description' },
              { key: 'sortOrder', header: 'Order' },
              {
                key: 'actions',
                header: 'Actions',
                render: (_val, row) => (
                  <ConfirmDialog
                    confirmLabel="Delete"
                    description={`Delete category “${row.name}”? Items will need re-assigning.`}
                    onConfirm={() => deleteCategory(row.id)}
                  />
                ),
              },
            ]}
            rows={categories}
            emptyMessage={loading ? 'Loading categories…' : 'No categories found'}
          />
        </AdminCard>
      </div>

      {/* Filters for items */}
      <AdminCard title="Item filters">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-neutral-700">
              Search dishes
            </label>
            <input
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
              placeholder="Search by name or description…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-neutral-700">
              Category
            </label>
            <select
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="ALL">All</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-neutral-700">
              Availability
            </label>
            <select
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
              value={availabilityFilter}
              onChange={(e) => setAvailabilityFilter(e.target.value)}
            >
              <option value="ALL">All</option>
              <option value="AVAILABLE">Available</option>
              <option value="UNAVAILABLE">Unavailable</option>
            </select>
          </div>
        </div>
      </AdminCard>

      {/* Items */}
      <div className="grid gap-4 lg:grid-cols-2">
        <AdminCard title="Add dish">
          <AdminForm onSubmit={handleItemSubmit} submitLabel="Save dish">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-neutral-800">Name</label>
              <input
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                value={itemForm.name}
                onChange={(e) =>
                  setItemForm((f) => ({ ...f, name: e.target.value }))
                }
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-neutral-800">
                Description
              </label>
              <textarea
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                value={itemForm.description}
                onChange={(e) =>
                  setItemForm((f) => ({
                    ...f,
                    description: e.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-neutral-800">
                Price (AED)
              </label>
              <input
                type="number"
                step="0.01"
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                value={itemForm.price}
                onChange={(e) =>
                  setItemForm((f) => ({ ...f, price: e.target.value }))
                }
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-neutral-800">
                Category
              </label>
              <select
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                value={itemForm.categoryId}
                onChange={(e) =>
                  setItemForm((f) => ({ ...f, categoryId: e.target.value }))
                }
                required
              >
                <option value="">Select a category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-neutral-800">
                Image URL (optional)
              </label>
              <input
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                value={itemForm.imageUrl}
                onChange={(e) =>
                  setItemForm((f) => ({ ...f, imageUrl: e.target.value }))
                }
              />
            </div>
            <label className="flex items-center gap-2 text-xs font-semibold text-neutral-800">
              <input
                type="checkbox"
                checked={itemForm.recommended}
                onChange={(e) =>
                  setItemForm((f) => ({
                    ...f,
                    recommended: e.target.checked,
                  }))
                }
              />
              Mark as recommended
            </label>
          </AdminForm>
        </AdminCard>

        <AdminCard title="Dishes">
          <AdminTable
            columns={[
              {
                key: 'name',
                header: 'Dish',
                render: (_val, row) => (
                  <div>
                    <div className="font-semibold">{row.name}</div>
                    {row.description && (
                      <div className="text-xs text-neutral-600">
                        {row.description}
                      </div>
                    )}
                  </div>
                ),
              },
              {
                key: 'categoryId',
                header: 'Category',
                render: (val) =>
                  categories.find((c) => c.id === val)?.name || '—',
              },
              { key: 'price', header: 'Price (AED)' },
              {
                key: 'isAvailable',
                header: 'Available',
                render: (val, row) => (
                  <button
                    type="button"
                    className={
                      val
                        ? 'rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-700'
                        : 'rounded-full bg-neutral-100 px-2 py-1 text-xs font-semibold text-neutral-600'
                    }
                    onClick={() => toggleItemField(row.id, 'isAvailable')}
                  >
                    {val ? 'Yes' : 'No'}
                  </button>
                ),
              },
              {
                key: 'recommended',
                header: 'Recommended',
                render: (val, row) =>
                  val ? (
                    <button
                      type="button"
                      className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700"
                      onClick={() => toggleItemField(row.id, 'recommended')}
                    >
                      Yes
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="rounded-full bg-neutral-100 px-2 py-1 text-xs font-semibold text-neutral-600"
                      onClick={() => toggleItemField(row.id, 'recommended')}
                    >
                      No
                    </button>
                  ),
              },
              {
                key: 'actions',
                header: 'Actions',
                render: (_val, row) => (
                  <ConfirmDialog
                    confirmLabel="Delete"
                    description={`Delete “${row.name}”?`}
                    onConfirm={() => deleteItem(row.id)}
                  />
                ),
              },
            ]}
            rows={filteredItems.map((i) => ({
              ...i,
              price:
                typeof i.price === 'number' ? i.price.toFixed(2) : i.price,
            }))}
            emptyMessage={loading ? 'Loading dishes…' : 'No dishes found'}
          />
        </AdminCard>
      </div>
    </div>
  );
}
