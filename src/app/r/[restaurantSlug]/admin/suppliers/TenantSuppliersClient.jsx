'use client';

import { useEffect, useMemo, useState } from 'react';

const inputClass = 'rounded-md border border-neutral-200 px-3 py-2 text-sm outline-none transition focus:border-emerald-700 disabled:bg-neutral-50 disabled:text-neutral-500';

const emptySupplierForm = {
  name: '',
  contactName: '',
  phone: '',
  email: '',
  whatsapp: '',
  address: '',
  notes: '',
  isActive: true,
};

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

function toSupplierPayload(restaurantSlug, form) {
  return {
    restaurantSlug,
    name: form.name.trim(),
    contactName: form.contactName.trim() || null,
    phone: form.phone.trim() || null,
    email: form.email.trim() || null,
    whatsapp: form.whatsapp.trim() || null,
    address: form.address.trim() || null,
    notes: form.notes.trim() || null,
    isActive: Boolean(form.isActive),
  };
}

function formatDate(value) {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not recorded';
  return date.toLocaleString();
}

export default function TenantSuppliersClient({ restaurantSlug, staffRole }) {
  const writable = canWrite(staffRole);
  const [suppliers, setSuppliers] = useState([]);
  const [form, setForm] = useState(emptySupplierForm);
  const [editingId, setEditingId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  async function load(showLoading = true) {
    if (showLoading) setLoading(true);
    setError('');
    try {
      const data = await apiRequest(`/api/restaurant-admin/suppliers?restaurantSlug=${encodeURIComponent(restaurantSlug)}`);
      setSuppliers(data.suppliers || []);
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

  const summary = useMemo(() => ({
    total: suppliers.length,
    active: suppliers.filter((supplier) => supplier.isActive !== false).length,
    inactive: suppliers.filter((supplier) => supplier.isActive === false).length,
  }), [suppliers]);

  const filteredSuppliers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return suppliers.filter((supplier) => {
      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && supplier.isActive !== false) ||
        (statusFilter === 'INACTIVE' && supplier.isActive === false);
      const matchesSearch = !query || [supplier.name, supplier.contactName, supplier.phone, supplier.email, supplier.whatsapp]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query);
      return matchesStatus && matchesSearch;
    });
  }, [search, statusFilter, suppliers]);

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function resetForm() {
    setEditingId('');
    setForm(emptySupplierForm);
  }

  function startEdit(supplier) {
    setEditingId(supplier.id);
    setForm({
      name: supplier.name || '',
      contactName: supplier.contactName || '',
      phone: supplier.phone || '',
      email: supplier.email || '',
      whatsapp: supplier.whatsapp || '',
      address: supplier.address || '',
      notes: supplier.notes || '',
      isActive: supplier.isActive !== false,
    });
    setError('');
    setSuccessMessage('');
  }

  async function submitSupplier(event) {
    event.preventDefault();
    if (!writable) return;
    setSaving(true);
    setError('');
    setSuccessMessage('');
    try {
      await apiRequest(editingId ? `/api/restaurant-admin/suppliers/${editingId}` : '/api/restaurant-admin/suppliers', {
        method: editingId ? 'PUT' : 'POST',
        body: JSON.stringify(toSupplierPayload(restaurantSlug, form)),
      });
      setSuccessMessage(editingId ? 'Supplier updated.' : 'Supplier created.');
      resetForm();
      await load(false);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function deactivateSupplier(supplier) {
    if (!writable) return;
    if (!window.confirm(`Deactivate ${supplier.name}? Purchase request history remains available.`)) return;
    setError('');
    setSuccessMessage('');
    try {
      await apiRequest(`/api/restaurant-admin/suppliers/${supplier.id}`, {
        method: 'PUT',
        body: JSON.stringify({ restaurantSlug, isActive: false }),
      });
      setSuccessMessage(`${supplier.name} was marked inactive.`);
      if (editingId === supplier.id) resetForm();
      await load(false);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  return (
    <div className="space-y-5">
      {error ? <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div> : null}
      {successMessage ? <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{successMessage}</div> : null}
      {loading ? <div className="rounded-md border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-600">Loading suppliers...</div> : null}
      {!writable ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          SUPPORT access is read-only. OWNER or MANAGER access is required to create, edit, or deactivate suppliers.
        </div>
      ) : null}
      <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950">
        Supplier records are internal references only. No send-to-vendor button, email, WhatsApp, invoice, payment, or automation is connected.
      </div>

      <section className="grid gap-3 md:grid-cols-3">
        <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-normal text-neutral-500">Suppliers</p>
          <p className="mt-1 text-2xl font-semibold">{summary.total}</p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-normal text-neutral-500">Active</p>
          <p className="mt-1 text-2xl font-semibold">{summary.active}</p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-normal text-neutral-500">Inactive</p>
          <p className="mt-1 text-2xl font-semibold">{summary.inactive}</p>
        </div>
      </section>

      <section className={writable ? 'grid gap-4 lg:grid-cols-[0.9fr_1.1fr]' : 'grid gap-4'}>
        {writable ? (
          <form onSubmit={submitSupplier} className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold">{editingId ? 'Edit supplier' : 'Add supplier'}</h2>
            <div className="mt-4 grid gap-3">
              <input className={inputClass} required disabled={saving} placeholder="Supplier name" value={form.name} onChange={(event) => updateForm('name', event.target.value)} />
              <input className={inputClass} disabled={saving} placeholder="Contact name" value={form.contactName} onChange={(event) => updateForm('contactName', event.target.value)} />
              <div className="grid gap-3 sm:grid-cols-2">
                <input className={inputClass} disabled={saving} placeholder="Phone" value={form.phone} onChange={(event) => updateForm('phone', event.target.value)} />
                <input className={inputClass} disabled={saving} placeholder="WhatsApp" value={form.whatsapp} onChange={(event) => updateForm('whatsapp', event.target.value)} />
              </div>
              <input className={inputClass} disabled={saving} type="email" placeholder="Email" value={form.email} onChange={(event) => updateForm('email', event.target.value)} />
              <input className={inputClass} disabled={saving} placeholder="Address" value={form.address} onChange={(event) => updateForm('address', event.target.value)} />
              <textarea className={`${inputClass} min-h-[84px]`} disabled={saving} placeholder="Internal notes" value={form.notes} onChange={(event) => updateForm('notes', event.target.value)} />
              <label className="flex items-center gap-3 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm font-semibold text-neutral-800">
                <input type="checkbox" checked={form.isActive} disabled={saving} onChange={(event) => updateForm('isActive', event.target.checked)} />
                Active supplier
              </label>
              <div className="flex flex-wrap gap-2">
                <button type="submit" disabled={saving} className="rounded-md bg-[#10241f] px-4 py-2 text-sm font-semibold text-white">
                  {saving ? 'Saving...' : editingId ? 'Update supplier' : 'Create supplier'}
                </button>
                {editingId ? (
                  <button type="button" onClick={resetForm} className="rounded-md border border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-700">
                    Cancel edit
                  </button>
                ) : null}
              </div>
            </div>
          </form>
        ) : null}

        <section className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Supplier list</h2>
              <p className="mt-1 text-sm text-neutral-600">Vendor contacts are scoped to this tenant only.</p>
            </div>
            <button type="button" onClick={() => load(false)} disabled={loading} className="rounded-md border border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-700">
              Refresh
            </button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <input className={inputClass} placeholder="Search suppliers" value={search} onChange={(event) => setSearch(event.target.value)} />
            <select className={inputClass} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="ALL">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>
          <div className="mt-4 grid gap-3">
            {filteredSuppliers.length ? filteredSuppliers.map((supplier) => (
              <article key={supplier.id} className="rounded-md border border-neutral-100 p-3">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{supplier.name}</h3>
                      <span className={supplier.isActive ? 'rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800' : 'rounded-full bg-neutral-100 px-2 py-1 text-xs font-semibold text-neutral-600'}>
                        {supplier.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    {supplier.contactName ? <p className="mt-1 text-sm text-neutral-600">{supplier.contactName}</p> : null}
                    {[supplier.phone, supplier.whatsapp, supplier.email].filter(Boolean).length ? (
                      <p className="mt-1 text-xs text-neutral-500">{[supplier.phone, supplier.whatsapp, supplier.email].filter(Boolean).join(' - ')}</p>
                    ) : null}
                    {supplier.address ? <p className="mt-1 text-xs text-neutral-500">{supplier.address}</p> : null}
                    {supplier.notes ? <p className="mt-2 rounded-md bg-neutral-50 px-3 py-2 text-sm text-neutral-700">{supplier.notes}</p> : null}
                    <p className="mt-2 text-xs text-neutral-400">Updated {formatDate(supplier.updatedAt)}</p>
                  </div>
                  {writable ? (
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => startEdit(supplier)} className="rounded-md border border-neutral-200 px-3 py-2 text-sm font-semibold text-neutral-700">
                        Edit
                      </button>
                      {supplier.isActive ? (
                        <button type="button" onClick={() => deactivateSupplier(supplier)} className="rounded-md border border-red-200 px-3 py-2 text-sm font-semibold text-red-700">
                          Deactivate
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </article>
            )) : (
              <p className="rounded-md border border-dashed border-neutral-200 px-4 py-6 text-center text-sm text-neutral-500">
                {loading ? 'Loading suppliers...' : 'No suppliers match the current filters.'}
              </p>
            )}
          </div>
        </section>
      </section>
    </div>
  );
}
