'use client';

import { useEffect, useState } from 'react';
import AdminLayout from '../../../components/AdminLayout';
import Button from '../../../components/Button';

async function fetchJson(url, options) {
  const res = await fetch(url, options);
  return res.json();
}

export default function AdminGalleryPage() {
  const [categories, setCategories] = useState([]);
  const [catForm, setCatForm] = useState({ name: '' });
  const [photoForm, setPhotoForm] = useState({ title: '', description: '', categoryId: '', imageUrl: '' });

  const load = async () => {
    const data = await fetchJson('/api/gallery/categories');
    setCategories(data.categories || []);
  };

  useEffect(() => {
    load();
  }, []);

  const addCategory = async (e) => {
    e.preventDefault();
    await fetchJson('/api/gallery/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(catForm),
    });
    setCatForm({ name: '' });
    load();
  };

  const addPhoto = async (e) => {
    e.preventDefault();
    await fetchJson('/api/gallery/photos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(photoForm),
    });
    setPhotoForm({ title: '', description: '', categoryId: '', imageUrl: '' });
    load();
  };

  const deleteCategory = async (id) => {
    await fetchJson(`/api/gallery/categories/${id}`, { method: 'DELETE' });
    load();
  };

  const deletePhoto = async (id) => {
    await fetchJson(`/api/gallery/photos/${id}`, { method: 'DELETE' });
    load();
  };

  return (
    <AdminLayout>
      <h1 className="text-2xl font-semibold mb-6">Gallery Management</h1>
      <div className="grid md:grid-cols-2 gap-6">
        <div className="section-bg p-4">
          <h3 className="font-semibold mb-3">Add Gallery Category</h3>
          <form className="grid gap-2" onSubmit={addCategory}>
            <input
              className="border rounded p-2"
              placeholder="Name"
              value={catForm.name}
              onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
            />
            <Button type="submit">Save Category</Button>
          </form>
        </div>
        <div className="section-bg p-4">
          <h3 className="font-semibold mb-3">Add Photo</h3>
          <form className="grid gap-2" onSubmit={addPhoto}>
            <input
              className="border rounded p-2"
              placeholder="Title"
              value={photoForm.title}
              onChange={(e) => setPhotoForm({ ...photoForm, title: e.target.value })}
            />
            <textarea
              className="border rounded p-2"
              placeholder="Description"
              value={photoForm.description}
              onChange={(e) => setPhotoForm({ ...photoForm, description: e.target.value })}
            />
            <select
              className="border rounded p-2"
              value={photoForm.categoryId}
              onChange={(e) => setPhotoForm({ ...photoForm, categoryId: e.target.value })}
            >
              <option value="">Select category</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
            <input
              className="border rounded p-2"
              placeholder="Image URL"
              value={photoForm.imageUrl}
              onChange={(e) => setPhotoForm({ ...photoForm, imageUrl: e.target.value })}
            />
            <Button type="submit">Save Photo</Button>
          </form>
        </div>
      </div>
      <div className="mt-6 space-y-4">
        {categories.map((cat) => (
          <div key={cat.id} className="section-bg p-4">
            <div className="flex justify-between items-center">
              <p className="font-semibold">{cat.name}</p>
              <button className="text-red-600 text-sm" onClick={() => deleteCategory(cat.id)}>
                Delete
              </button>
            </div>
            <div className="grid sm:grid-cols-2 gap-3 mt-3 text-sm">
              {cat.photos?.map((photo) => (
                <div key={photo.id} className="border rounded p-2 flex justify-between">
                  <div>
                    <p className="font-semibold">{photo.title}</p>
                    <p className="text-textdark/70">{photo.description}</p>
                  </div>
                  <button className="text-red-600" onClick={() => deletePhoto(photo.id)}>
                    Delete
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </AdminLayout>
  );
}