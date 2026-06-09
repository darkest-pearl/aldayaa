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

export default function TenantGalleryClient({ restaurantSlug, staffRole }) {
  const writable = canWrite(staffRole);
  const [categories, setCategories] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [categoryForm, setCategoryForm] = useState({ name: '' });
  const [photoForm, setPhotoForm] = useState({
    title: '',
    description: '',
    imageUrl: '',
    categoryId: '',
  });

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [categoryData, photoData] = await Promise.all([
        apiRequest(`/api/restaurant-admin/gallery/categories?restaurantSlug=${encodeURIComponent(restaurantSlug)}`),
        apiRequest(`/api/restaurant-admin/gallery/photos?restaurantSlug=${encodeURIComponent(restaurantSlug)}`),
      ]);
      setCategories(categoryData.categories || []);
      setPhotos(photoData.photos || []);
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
      await apiRequest('/api/restaurant-admin/gallery/categories', {
        method: 'POST',
        body: JSON.stringify({ restaurantSlug, name: categoryForm.name }),
      });
      setCategoryForm({ name: '' });
      await load();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function submitPhoto(event) {
    event.preventDefault();
    if (!writable) return;
    try {
      await apiRequest('/api/restaurant-admin/gallery/photos', {
        method: 'POST',
        body: JSON.stringify({ ...photoForm, restaurantSlug }),
      });
      setPhotoForm({ title: '', description: '', imageUrl: '', categoryId: '' });
      await load();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function deleteCategory(category) {
    if (!writable) return;
    try {
      await apiRequest(`/api/restaurant-admin/gallery/categories/${category.id}?restaurantSlug=${encodeURIComponent(restaurantSlug)}`, {
        method: 'DELETE',
      });
      await load();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function deletePhoto(photo) {
    if (!writable) return;
    try {
      await apiRequest(`/api/restaurant-admin/gallery/photos/${photo.id}?restaurantSlug=${encodeURIComponent(restaurantSlug)}`, {
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
          SUPPORT access is read-only. OWNER or MANAGER access is required to change gallery content.
        </div>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-2">
        <form onSubmit={submitCategory} className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold">Add gallery category</h2>
          <div className="mt-4 grid gap-3">
            <input className={inputClass} required disabled={!writable} placeholder="Category name" value={categoryForm.name} onChange={(event) => setCategoryForm({ name: event.target.value })} />
            <button disabled={!writable} className="rounded-md bg-[#10241f] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">Save category</button>
          </div>
        </form>

        <form onSubmit={submitPhoto} className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold">Add photo</h2>
          <div className="mt-4 grid gap-3">
            <input className={inputClass} required disabled={!writable} placeholder="Photo title" value={photoForm.title} onChange={(event) => setPhotoForm((form) => ({ ...form, title: event.target.value }))} />
            <textarea className={inputClass} disabled={!writable} placeholder="Description" value={photoForm.description} onChange={(event) => setPhotoForm((form) => ({ ...form, description: event.target.value }))} />
            <input className={inputClass} required disabled={!writable} placeholder="Image URL or /path" value={photoForm.imageUrl} onChange={(event) => setPhotoForm((form) => ({ ...form, imageUrl: event.target.value }))} />
            <select className={inputClass} required disabled={!writable} value={photoForm.categoryId} onChange={(event) => setPhotoForm((form) => ({ ...form, categoryId: event.target.value }))}>
              <option value="">Select category</option>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
            <button disabled={!writable} className="rounded-md bg-[#10241f] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">Save photo</button>
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
                <p className="text-sm text-neutral-600">{category.photos?.length || 0} photos</p>
              </div>
              <button disabled={!writable} onClick={() => deleteCategory(category)} className="text-left text-sm font-semibold text-red-700 disabled:cursor-not-allowed disabled:opacity-40">Delete</button>
            </div>
          )) : <p className="text-sm text-neutral-500">{loading ? 'Loading categories...' : 'No gallery categories yet.'}</p>}
        </div>
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold">Photos</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {photos.length ? photos.map((photo) => (
            <div key={photo.id} className="rounded-md border border-neutral-100 p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.imageUrl} alt={photo.title} className="aspect-[4/3] w-full rounded-md object-cover" />
              <div className="mt-3 flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{photo.title}</p>
                  <p className="text-sm text-neutral-600">{categoryById.get(photo.categoryId)?.name || photo.category?.name || 'Uncategorized'}</p>
                  {photo.description ? <p className="mt-1 text-sm text-neutral-600">{photo.description}</p> : null}
                </div>
                <button disabled={!writable} onClick={() => deletePhoto(photo)} className="text-sm font-semibold text-red-700 disabled:cursor-not-allowed disabled:opacity-40">Delete</button>
              </div>
            </div>
          )) : <p className="text-sm text-neutral-500">{loading ? 'Loading photos...' : 'No gallery photos yet.'}</p>}
        </div>
      </section>
    </div>
  );
}
