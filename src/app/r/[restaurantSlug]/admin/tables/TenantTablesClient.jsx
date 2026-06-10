'use client';

import { useEffect, useState } from 'react';

const emptyForm = {
  label: '',
  seats: '',
  zone: '',
  notes: '',
  isActive: true,
};

const inputClass = 'rounded-md border border-neutral-200 px-3 py-2 text-sm outline-none transition focus:border-emerald-700 disabled:bg-neutral-50 disabled:text-neutral-500';

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

function toPayload(restaurantSlug, form) {
  return {
    restaurantSlug,
    label: form.label.trim(),
    seats: form.seats ? Number(form.seats) : null,
    zone: form.zone.trim() || null,
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

export default function TenantTablesClient({ restaurantSlug, staffRole }) {
  const writable = canWrite(staffRole);
  const [tables, setTables] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [copiedId, setCopiedId] = useState('');

  async function load(showLoading = true) {
    if (showLoading) setLoading(true);
    setError('');
    try {
      const data = await apiRequest(`/api/restaurant-admin/tables?restaurantSlug=${encodeURIComponent(restaurantSlug)}`);
      setTables(data.tables || []);
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

  function resetForm() {
    setEditingId('');
    setForm(emptyForm);
  }

  function startEdit(table) {
    setEditingId(table.id);
    setForm({
      label: table.label || '',
      seats: table.seats ? String(table.seats) : '',
      zone: table.zone || '',
      notes: table.notes || '',
      isActive: table.isActive !== false,
    });
    setError('');
    setSuccessMessage('');
  }

  async function submitTable(event) {
    event.preventDefault();
    if (!writable) return;
    setSaving(true);
    setError('');
    setSuccessMessage('');
    try {
      await apiRequest(editingId ? `/api/restaurant-admin/tables/${editingId}` : '/api/restaurant-admin/tables', {
        method: editingId ? 'PUT' : 'POST',
        body: JSON.stringify(toPayload(restaurantSlug, form)),
      });
      setSuccessMessage(editingId ? 'Table updated.' : 'Table created.');
      resetForm();
      await load(false);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function deactivateTable(table) {
    if (!writable) return;
    if (!window.confirm(`Mark "${table.label}" inactive? This will not delete the table record.`)) return;
    setError('');
    setSuccessMessage('');
    try {
      await apiRequest(`/api/restaurant-admin/tables/${table.id}?restaurantSlug=${encodeURIComponent(restaurantSlug)}`, {
        method: 'DELETE',
      });
      setSuccessMessage(`${table.label} was marked inactive.`);
      if (editingId === table.id) resetForm();
      await load(false);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function copyToken(table) {
    if (!table.qrToken) return;
    try {
      await navigator.clipboard.writeText(table.qrToken);
      setCopiedId(table.id);
      window.setTimeout(() => setCopiedId(''), 1400);
    } catch (copyError) {
      setError('Unable to copy token. Please copy it manually.');
    }
  }

  return (
    <div className="space-y-5">
      {error ? <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div> : null}
      {successMessage ? <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{successMessage}</div> : null}
      {loading ? <div className="rounded-md border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-600">Loading tables...</div> : null}
      {!writable ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          SUPPORT access is read-only. OWNER or MANAGER access is required to change table records.
        </div>
      ) : null}
      <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950">
        This does not activate tenant table ordering. Orders, payments, inventory, recipes, messaging, billing, and domains remain separate future work.
      </div>

      <section className={writable ? 'grid gap-4 lg:grid-cols-[minmax(0,0.85fr),minmax(0,1.15fr)]' : 'grid gap-4'}>
        {writable ? (
          <form onSubmit={submitTable} className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold">{editingId ? 'Edit table' : 'Add table'}</h2>
            <p className="mt-1 text-sm text-neutral-600">
              Table labels are kept unique within this restaurant. Slugs and QR tokens are generated automatically.
            </p>
            <div className="mt-4 grid gap-3">
              <input
                className={inputClass}
                required
                disabled={!writable || saving}
                placeholder="Table label"
                value={form.label}
                onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  className={inputClass}
                  type="number"
                  min="1"
                  max="999"
                  disabled={!writable || saving}
                  placeholder="Seats"
                  value={form.seats}
                  onChange={(event) => setForm((current) => ({ ...current, seats: event.target.value }))}
                />
                <input
                  className={inputClass}
                  disabled={!writable || saving}
                  placeholder="Zone"
                  value={form.zone}
                  onChange={(event) => setForm((current) => ({ ...current, zone: event.target.value }))}
                />
              </div>
              <textarea
                className={`${inputClass} min-h-[90px]`}
                disabled={!writable || saving}
                placeholder="Internal notes"
                value={form.notes}
                onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
              />
              <label className="flex items-center gap-3 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm font-semibold text-neutral-800">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  disabled={!writable || saving}
                  onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))}
                />
                Active table
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  disabled={!writable || saving}
                  className="rounded-md bg-[#10241f] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {editingId ? 'Update table' : 'Create table'}
                </button>
                {editingId ? (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="rounded-md border border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-700"
                  >
                    Cancel edit
                  </button>
                ) : null}
              </div>
            </div>
          </form>
        ) : null}

        <section className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Restaurant tables</h2>
              <p className="mt-1 text-sm text-neutral-600">Manage tenant table records without creating orders or enabling table ordering.</p>
            </div>
            <button
              type="button"
              onClick={() => load(false)}
              className="rounded-md border border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-700"
            >
              Refresh
            </button>
          </div>

          <div className="mt-4 grid gap-3">
            {tables.length ? tables.map((table) => (
              <article key={table.id} className="rounded-md border border-neutral-100 p-3">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{table.label}</p>
                      <span className={table.isActive ? 'rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800' : 'rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-700'}>
                        {table.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div className="mt-2 grid gap-1 text-sm text-neutral-600 md:grid-cols-2">
                      <p>Slug: <span className="font-mono text-xs text-neutral-700">{table.slug}</span></p>
                      <p>Seats: {table.seats || '-'}</p>
                      <p>Zone: {table.zone || '-'}</p>
                      <p>Updated: {formatDate(table.updatedAt)}</p>
                    </div>
                    {table.notes ? <p className="mt-2 rounded-md bg-neutral-50 px-3 py-2 text-sm text-neutral-700">{table.notes}</p> : null}
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                      <span className="break-all font-mono">{table.qrToken}</span>
                      <button
                        type="button"
                        onClick={() => copyToken(table)}
                        className="rounded-md border border-neutral-200 px-2 py-1 text-xs font-semibold text-neutral-700"
                      >
                        {copiedId === table.id ? 'Copied' : 'Copy token'}
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {writable ? (
                      <button
                        type="button"
                        onClick={() => startEdit(table)}
                        className="rounded-md border border-neutral-200 px-3 py-2 text-sm font-semibold text-neutral-700"
                      >
                        Edit
                      </button>
                    ) : <span className="text-sm text-neutral-500">View only</span>}
                    {writable && table.isActive ? (
                      <button
                        type="button"
                        onClick={() => deactivateTable(table)}
                        className="rounded-md border border-red-200 px-3 py-2 text-sm font-semibold text-red-700"
                      >
                        Mark inactive
                      </button>
                    ) : null}
                  </div>
                </div>
              </article>
            )) : (
              <p className="rounded-md border border-dashed border-neutral-200 px-4 py-6 text-center text-sm text-neutral-500">
                {loading ? 'Loading tables...' : 'No tables created yet'}
              </p>
            )}
          </div>
        </section>
      </section>
    </div>
  );
}
