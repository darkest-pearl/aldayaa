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
  } catch {
    throw new Error('Invalid server response');
  }

  if (!data?.success) {
    throw new Error(data?.error || 'Request failed');
  }
  return data.data;
}

export default function GalleryClient() {
  const [categories, setCategories] = useState([]);
  const [photos, setPhotos] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  const [categoryForm, setCategoryForm] = useState({ name: '' });
  const [photoForm, setPhotoForm] = useState({
    title: '',
    description: '',
    imageUrl: '',
    categoryId: '',
  });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [catData, photoData] = await Promise.all([
        apiRequest('/api/gallery/categories'),
        apiRequest('/api/gallery/photos'),
      ]);

      setCategories(catData.categories || []);
      setPhotos(photoData.photos || []);
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
      await apiRequest('/api/gallery/categories', {
        method: 'POST',
        body: JSON.stringify(categoryForm),
      });
      setCategoryForm({ name: '' });
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const deleteCategory = async (id) => {
    try {
      await apiRequest('/api/gallery/categories', {
        method: 'DELETE',
        body: JSON.stringify({ id }),
      });
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const handlePhotoSubmit = async (e) => {
    e.preventDefault();
    try {
      await apiRequest('/api/gallery/photos', {
        method: 'POST',
        body: JSON.stringify(photoForm),
      });
      setPhotoForm({
        title: '',
        description: '',
        imageUrl: '',
        categoryId: '',
      });
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const deletePhoto = async (id) => {
    try {
      await apiRequest('/api/gallery/photos', {
        method: 'DELETE',
        body: JSON.stringify({ id }),
      });
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const filteredPhotos = useMemo(() => {
    return (photos || []).filter((p) => {
      const q = search.toLowerCase().trim();
      if (q) {
        const haystack = [p.title, p.description]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      if (categoryFilter !== 'ALL' && p.categoryId !== categoryFilter) {
        return false;
      }

      return true;
    });
  }, [photos, search, categoryFilter]);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Gallery"
        description="Manage food, interior, and vibe photos for the public gallery."
      />

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <AdminCard title="Add gallery category">
          <AdminForm
            onSubmit={handleCategorySubmit}
            submitLabel="Save category"
          >
            <div className="space-y-2">
              <label className="text-xs font-semibold text-neutral-800">
                Name
              </label>
              <input
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                value={categoryForm.name}
                onChange={(e) =>
                  setCategoryForm((f) => ({ ...f, name: e.target.value }))
                }
                required
              />
            </div>
          </AdminForm>
        </AdminCard>

        <AdminCard title="Categories">
          <AdminTable
            columns={[
              { key: 'name', header: 'Name' },
              { key: 'createdAt', header: 'Created' },
              {
                key: 'actions',
                header: 'Actions',
                render: (_val, row) => (
                  <ConfirmDialog
                    confirmLabel="Delete"
                    description={`Delete category “${row.name}”?`}
                    onConfirm={() => deleteCategory(row.id)}
                  />
                ),
              },
            ]}
            rows={categories.map((c) => ({
              ...c,
              createdAt: c.createdAt
                ? new Date(c.createdAt).toLocaleDateString()
                : '',
            }))}
            emptyMessage={loading ? 'Loading categories…' : 'No categories found'}
          />
        </AdminCard>
      </div>

      <AdminCard title="Photo filters">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-neutral-700">
              Search photos
            </label>
            <input
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
              placeholder="Search by title or description…"
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
        </div>
      </AdminCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <AdminCard title="Add photo">
          <AdminForm onSubmit={handlePhotoSubmit} submitLabel="Save photo">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-neutral-800">
                Title
              </label>
              <input
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                value={photoForm.title}
                onChange={(e) =>
                  setPhotoForm((f) => ({ ...f, title: e.target.value }))
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
                value={photoForm.description}
                onChange={(e) =>
                  setPhotoForm((f) => ({
                    ...f,
                    description: e.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-neutral-800">
                Image URL
              </label>
              <input
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                value={photoForm.imageUrl}
                onChange={(e) =>
                  setPhotoForm((f) => ({ ...f, imageUrl: e.target.value }))
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
                value={photoForm.categoryId}
                onChange={(e) =>
                  setPhotoForm((f) => ({
                    ...f,
                    categoryId: e.target.value,
                  }))
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
          </AdminForm>
        </AdminCard>

        <AdminCard title="Photos">
          <AdminTable
            columns={[
              {
                key: 'title',
                header: 'Photo',
                render: (_val, row) => (
                  <div className="flex items-center gap-3">
                    {row.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={row.imageUrl}
                        alt={row.title}
                        className="h-12 w-16 rounded-md object-cover"
                      />
                    )}
                    <div>
                      <div className="font-semibold text-sm">{row.title}</div>
                      {row.description && (
                        <div className="text-xs text-neutral-600">
                          {row.description}
                        </div>
                      )}
                    </div>
                  </div>
                ),
              },
              {
                key: 'categoryId',
                header: 'Category',
                render: (val) =>
                  categories.find((c) => c.id === val)?.name || '—',
              },
              {
                key: 'actions',
                header: 'Actions',
                render: (_val, row) => (
                  <ConfirmDialog
                    confirmLabel="Delete"
                    description={`Delete photo “${row.title}”?`}
                    onConfirm={() => deletePhoto(row.id)}
                  />
                ),
              },
            ]}
            rows={filteredPhotos}
            emptyMessage={loading ? 'Loading photos…' : 'No photos found'}
          />
        </AdminCard>
      </div>
    </div>
  );
}
