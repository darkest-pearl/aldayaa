'use client';
import { useEffect, useState } from 'react';
import AdminLayout from '../../../components/AdminLayout';
import Button from '../../../components/Button';

async function fetchJson(url, options) {
  const res = await fetch(url, options);
  return res.json();
}

export default function AdminMenuPage() {
  const [categories, setCategories] = useState([]);
  const [catForm, setCatForm] = useState({ name: '', description: '' });
  const [itemForm, setItemForm] = useState({ name: '', description: '', price: '', categoryId: '', isAvailable: true });

  const load = async () => {
    const data = await fetchJson('/api/menu/categories');
    setCategories(data.categories || []);
  };

  useEffect(() => { load(); }, []);

  const addCategory = async (e) => {
    e.preventDefault();
    await fetchJson('/api/menu/categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(catForm) });
    setCatForm({ name: '', description: '' });
    load();
  };

  const addItem = async (e) => {
    e.preventDefault();
    await fetchJson('/api/menu/items', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(itemForm) });
    setItemForm({ name: '', description: '', price: '', categoryId: '', isAvailable: true });
    load();
  };

  const deleteCategory = async (id) => {
    await fetchJson(`/api/menu/categories/${id}`, { method: 'DELETE' });
    load();
  };

  const deleteItem = async (id) => {
    await fetchJson(`/api/menu/items/${id}`, { method: 'DELETE' });
    load();
  };

  return (
    <AdminLayout>
      <div className="grid md:grid-cols-2 gap-6">
        <div className="section-bg p-4">
          <h3 className="font-semibold mb-3">Add Category</h3>
          <form className="grid gap-2" onSubmit={addCategory}>
            <input className="border rounded p-2" placeholder="Name" value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })} />
            <textarea className="border rounded p-2" placeholder="Description" value={catForm.description} onChange={(e) => setCatForm({ ...catForm, description: e.target.value })} />
            <Button type="submit">Save Category</Button>
          </form>
        </div>
        <div className="section-bg p-4">
          <h3 className="font-semibold mb-3">Add Menu Item</h3>
          <form className="grid gap-2" onSubmit={addItem}>
            <input className="border rounded p-2" placeholder="Name" value={itemForm.name} onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })} />
            <textarea className="border rounded p-2" placeholder="Description" value={itemForm.description} onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })} />
            <input type="number" className="border rounded p-2" placeholder="Price" value={itemForm.price} onChange={(e) => setItemForm({ ...itemForm, price: parseFloat(e.target.value) })} />
            <select className="border rounded p-2" value={itemForm.categoryId} onChange={(e) => setItemForm({ ...itemForm, categoryId: e.target.value })}>
              <option value="">Select category</option>
              {categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
            </select>
            <label className="text-sm flex items-center gap-2"><input type="checkbox" checked={itemForm.isAvailable} onChange={(e) => setItemForm({ ...itemForm, isAvailable: e.target.checked })} /> Available</label>
            <Button type="submit">Save Item</Button>
          </form>
        </div>
      </div>
      <div className="mt-6 space-y-4">
        {categories.map((cat) => (
          <div key={cat.id} className="section-bg p-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="font-semibold">{cat.name}</p>
                <p className="text-sm text-textdark/70">{cat.description}</p>
              </div>
              <button className="text-red-600 text-sm" onClick={() => deleteCategory(cat.id)}>Delete</button>
            </div>
            <div className="mt-3 space-y-2 text-sm">
              {cat.items?.map((item) => (
                <div key={item.id} className="flex justify-between">
                  <div>
                    <p className="font-semibold">{item.name}</p>
                    <p className="text-textdark/70">AED {item.price?.toFixed(2)}</p>
                  </div>
                  <button className="text-red-600" onClick={() => deleteItem(item.id)}>Delete</button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </AdminLayout>
  );
}