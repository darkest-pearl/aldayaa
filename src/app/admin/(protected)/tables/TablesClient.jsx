'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import AdminCard from '../../components/AdminCard.jsx';
import AdminForm from '../../components/AdminForm.jsx';
import AdminPageHeader from '../../components/AdminPageHeader.jsx';
import { useAdmin } from '../../components/AdminShell.jsx';
import AdminTable from '../../components/AdminTable.jsx';
import ConfirmDialog from '../../components/ConfirmDialog.jsx';

const emptyForm = {
  label: '',
  seats: '',
  zone: '',
  notes: '',
  isActive: true,
};

async function apiRequest(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const data = await res.json();
  if (!data?.success) {
    throw new Error(data?.error || 'Request failed');
  }
  return data.data;
}

function toPayload(form) {
  return {
    label: form.label.trim(),
    seats: form.seats ? Number(form.seats) : null,
    zone: form.zone.trim() || null,
    notes: form.notes.trim() || null,
    isActive: Boolean(form.isActive),
  };
}

export default function TablesClient({
  tableQrOrderingEnabled = true,
  tableQrOrderingMessage = 'QR table ordering is disabled',
  canEnableModules = false,
}) {
  const admin = useAdmin();
  const canManage = ['ADMIN', 'MANAGER'].includes(admin?.role);
  const [tables, setTables] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest('/api/admin/tables');
      setTables(data.tables || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setForm(emptyForm);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const payload = toPayload(form);
      const url = editingId ? `/api/admin/tables/${editingId}` : '/api/admin/tables';
      await apiRequest(url, {
        method: editingId ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      });
      setMessage(editingId ? 'Table updated successfully' : 'Table created successfully');
      resetForm();
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (table) => {
    setEditingId(table.id);
    setForm({
      label: table.label || '',
      seats: table.seats ? String(table.seats) : '',
      zone: table.zone || '',
      notes: table.notes || '',
      isActive: table.isActive !== false,
    });
    setMessage(null);
    setError(null);
  };

  const handleDeactivate = async (table) => {
    setError(null);
    setMessage(null);
    try {
      await apiRequest(`/api/admin/tables/${table.id}`, { method: 'DELETE' });
      setMessage(`${table.label} was marked inactive`);
      if (editingId === table.id) resetForm();
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCopy = async (table) => {
    if (!table.orderUrl) return;
    try {
      await navigator.clipboard.writeText(table.orderUrl);
      setCopiedId(table.id);
      window.setTimeout(() => setCopiedId(null), 1400);
    } catch (err) {
      setError('Unable to copy URL. Please copy it manually.');
    }
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Tables / QR Ordering"
        description="Create QR-ready table landing links. Full dine-in/POS ordering is not enabled yet."
      />

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}
      {message && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div>
      )}
      {!canManage && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          SUPPORT users can view table QR links, but only ADMIN and MANAGER users can change them.
        </div>
      )}
      {!tableQrOrderingEnabled && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="font-semibold">{tableQrOrderingMessage}</p>
              <p>
                You can prepare tables now, but public QR table ordering stays unavailable until this
                module is enabled.
              </p>
            </div>
            {canEnableModules && (
              <Link
                href="/admin/settings"
                className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-semibold text-amber-900 transition hover:bg-amber-100"
              >
                Open Settings
              </Link>
            )}
          </div>
        </div>
      )}

      <div className={canManage ? 'grid gap-4 lg:grid-cols-[minmax(0,0.8fr),minmax(0,1.2fr)]' : 'grid gap-4'}>
        {canManage && (
          <AdminCard
            title={editingId ? 'Edit table' : 'Add table'}
            description="Create a table slug and QR landing URL."
          >
          <AdminForm
            onSubmit={handleSubmit}
            submitLabel={editingId ? 'Save table' : 'Create table'}
            submitting={saving}
            secondaryAction={
              editingId ? (
                <button
                  type="button"
                  className="text-sm font-semibold text-neutral-700 underline"
                  onClick={resetForm}
                >
                  Cancel edit
                </button>
              ) : null
            }
          >
            <div className="space-y-2">
              <label className="text-sm font-semibold text-neutral-800">Table label</label>
              <input
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                value={form.label}
                onChange={(e) => setForm((prev) => ({ ...prev, label: e.target.value }))}
                placeholder="Table 12"
                required
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-neutral-800">Seats</label>
                <input
                  type="number"
                  min="1"
                  max="999"
                  className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  value={form.seats}
                  onChange={(e) => setForm((prev) => ({ ...prev, seats: e.target.value }))}
                  placeholder="4"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-neutral-800">Zone</label>
                <input
                  className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  value={form.zone}
                  onChange={(e) => setForm((prev) => ({ ...prev, zone: e.target.value }))}
                  placeholder="Patio"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-neutral-800">Notes</label>
              <textarea
                className="min-h-[90px] w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                value={form.notes}
                onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="Optional internal note"
              />
            </div>

            <label className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm font-semibold text-neutral-800">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
              />
              Active QR landing page
            </label>
          </AdminForm>
          </AdminCard>
        )}

        <AdminCard
          title="Restaurant tables"
          description="Use the URL column for QR code generation outside this app."
          actions={loading && <span className="text-xs text-neutral-500">Refreshing...</span>}
        >
          <AdminTable
            dense
            columns={[
              {
                key: 'label',
                header: 'Table',
                render: (_value, row) => (
                  <div>
                    <p className="font-semibold text-neutral-900">{row.label}</p>
                    <p className="text-xs text-neutral-500">{row.slug}</p>
                    {row.zone && <p className="text-xs text-neutral-600">{row.zone}</p>}
                  </div>
                ),
              },
              {
                key: 'seats',
                header: 'Seats',
                render: (value) => value || '-',
              },
              {
                key: 'isActive',
                header: 'Status',
                render: (value) => (
                  <span
                    className={
                      value
                        ? 'rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-700'
                        : 'rounded-full bg-neutral-100 px-2 py-1 text-xs font-semibold text-neutral-600'
                    }
                  >
                    {value ? 'Active' : 'Inactive'}
                  </span>
                ),
              },
              {
                key: 'orderUrl',
                header: 'QR / order URL',
                render: (value, row) => (
                  <div className="max-w-xs space-y-2">
                    <p className="break-all font-mono text-xs text-neutral-700">{value}</p>
                    <button
                      type="button"
                      className="rounded-md border border-neutral-200 px-2 py-1 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50"
                      onClick={() => handleCopy(row)}
                    >
                      {copiedId === row.id ? 'Copied' : 'Copy URL'}
                    </button>
                  </div>
                ),
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
                    {canManage && row.isActive && (
                      <ConfirmDialog
                        confirmLabel="Mark inactive"
                        title="Deactivate table?"
                        description={`Mark ${row.label} inactive? Its public QR landing page will show unavailable.`}
                        onConfirm={() => handleDeactivate(row)}
                        trigger={
                          <button className="rounded-md border border-red-200 px-2 py-1 text-xs font-semibold text-red-600 transition hover:bg-red-50">
                            Deactivate
                          </button>
                        }
                      />
                    )}
                  </div>
                ),
              },
            ]}
            rows={tables}
            emptyMessage={loading ? 'Loading tables...' : 'No tables created yet'}
          />
        </AdminCard>
      </div>
    </div>
  );
}
