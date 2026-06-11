'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  PURCHASE_REQUEST_STATUSES,
  getPurchaseRequestStatusLabel,
  getPurchaseRequestStatusOptions,
} from '../../../../../lib/purchase-requests';

const inputClass = 'rounded-md border border-neutral-200 px-3 py-2 text-sm outline-none transition focus:border-emerald-700 disabled:bg-neutral-50 disabled:text-neutral-500';
const statusOptions = getPurchaseRequestStatusOptions();

const emptyRequestForm = {
  supplierId: '',
  status: PURCHASE_REQUEST_STATUSES.DRAFT,
  expectedDate: '',
  notes: '',
  lines: [{ inventoryItemId: '', quantity: '1', notes: '' }],
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

function formatDate(value) {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not recorded';
  return date.toLocaleString();
}

function formatDateInput(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function formatQuantity(value) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(Number(value || 0));
}

function isLowStock(item) {
  return item.stockStatus === 'LOW_STOCK' || item.stockStatus === 'OUT_OF_STOCK';
}

function getStatusBadgeClass(status) {
  if (status === PURCHASE_REQUEST_STATUSES.RECEIVED) return 'rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800';
  if (status === PURCHASE_REQUEST_STATUSES.CANCELLED) return 'rounded-full bg-red-50 px-2 py-1 text-xs font-semibold text-red-700';
  if (status === PURCHASE_REQUEST_STATUSES.APPROVED) return 'rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-800';
  if (status === PURCHASE_REQUEST_STATUSES.REQUESTED) return 'rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800';
  return 'rounded-full bg-neutral-100 px-2 py-1 text-xs font-semibold text-neutral-700';
}

function toCreatePayload(restaurantSlug, form) {
  return {
    restaurantSlug,
    supplierId: form.supplierId || null,
    status: form.status,
    expectedDate: form.expectedDate || null,
    notes: form.notes.trim() || null,
    lines: form.lines.map((line) => ({
      inventoryItemId: line.inventoryItemId,
      quantity: Number(line.quantity || 0),
      notes: line.notes.trim() || null,
    })),
  };
}

function toUpdatePayload(restaurantSlug, form) {
  return {
    restaurantSlug,
    supplierId: form.supplierId || null,
    status: form.status,
    expectedDate: form.expectedDate || null,
    notes: form.notes.trim() || null,
  };
}

export default function TenantPurchaseRequestsClient({ restaurantSlug, staffRole }) {
  const writable = canWrite(staffRole);
  const [purchaseRequests, setPurchaseRequests] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [form, setForm] = useState(emptyRequestForm);
  const [editingId, setEditingId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [receivingId, setReceivingId] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  async function load(showLoading = true) {
    if (showLoading) setLoading(true);
    setError('');
    try {
      const [requestData, supplierData, itemData] = await Promise.all([
        apiRequest(`/api/restaurant-admin/purchase-requests?restaurantSlug=${encodeURIComponent(restaurantSlug)}`),
        apiRequest(`/api/restaurant-admin/suppliers?restaurantSlug=${encodeURIComponent(restaurantSlug)}`),
        apiRequest(`/api/restaurant-admin/inventory/items?restaurantSlug=${encodeURIComponent(restaurantSlug)}`),
      ]);
      setPurchaseRequests(requestData.purchaseRequests || []);
      setSuppliers(supplierData.suppliers || []);
      setInventoryItems(itemData.items || []);
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

  const activeSuppliers = useMemo(() => suppliers.filter((supplier) => supplier.isActive !== false), [suppliers]);
  const activeItems = useMemo(() => inventoryItems.filter((item) => item.isActive !== false), [inventoryItems]);
  const lowStockItems = useMemo(() => activeItems.filter(isLowStock), [activeItems]);
  const summary = useMemo(() => ({
    total: purchaseRequests.length,
    open: purchaseRequests.filter((request) =>
      ![PURCHASE_REQUEST_STATUSES.RECEIVED, PURCHASE_REQUEST_STATUSES.CANCELLED].includes(request.status)
    ).length,
    received: purchaseRequests.filter((request) => request.status === PURCHASE_REQUEST_STATUSES.RECEIVED).length,
    lowStock: lowStockItems.length,
  }), [lowStockItems.length, purchaseRequests]);
  const filteredRequests = useMemo(() => {
    const query = search.trim().toLowerCase();
    return purchaseRequests.filter((request) => {
      const matchesStatus = statusFilter === 'ALL' || request.status === statusFilter;
      const matchesSearch = !query || [request.reference, request.statusLabel, request.supplier?.name, request.notes]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query);
      return matchesStatus && matchesSearch;
    });
  }, [purchaseRequests, search, statusFilter]);

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function resetForm() {
    setEditingId('');
    setForm(emptyRequestForm);
  }

  function updateLine(index, field, value) {
    setForm((current) => ({
      ...current,
      lines: current.lines.map((line, lineIndex) =>
        lineIndex === index ? { ...line, [field]: value } : line
      ),
    }));
  }

  function addLineFromItem(item) {
    if (!writable || editingId) return;
    setForm((current) => ({
      ...current,
      lines: [
        ...current.lines,
        {
          inventoryItemId: item.id,
          quantity: item.reorderLevel ? String(Math.max(Number(item.reorderLevel) - Number(item.currentStock || 0), 1)) : '1',
          notes: 'Low-stock review',
        },
      ],
    }));
  }

  function addBlankLine() {
    setForm((current) => ({
      ...current,
      lines: [...current.lines, { inventoryItemId: '', quantity: '1', notes: '' }],
    }));
  }

  function removeLine(index) {
    setForm((current) => ({
      ...current,
      lines: current.lines.length > 1 ? current.lines.filter((_, lineIndex) => lineIndex !== index) : current.lines,
    }));
  }

  function startEdit(request) {
    setEditingId(request.id);
    setForm({
      supplierId: request.supplierId || '',
      status: request.status || PURCHASE_REQUEST_STATUSES.DRAFT,
      expectedDate: formatDateInput(request.expectedDate),
      notes: request.notes || '',
      lines: request.lines?.length
        ? request.lines.map((line) => ({
            inventoryItemId: line.inventoryItemId,
            quantity: String(line.quantity || 1),
            notes: line.notes || '',
          }))
        : [{ inventoryItemId: '', quantity: '1', notes: '' }],
    });
    setError('');
    setSuccessMessage('');
  }

  function canReceiveRequest(request) {
    return Boolean(
      writable &&
      request.status !== PURCHASE_REQUEST_STATUSES.RECEIVED &&
      request.status !== PURCHASE_REQUEST_STATUSES.CANCELLED &&
      request.lines?.length
    );
  }

  async function submitRequest(event) {
    event.preventDefault();
    if (!writable) return;
    setSaving(true);
    setError('');
    setSuccessMessage('');
    try {
      if (editingId) {
        await apiRequest(`/api/restaurant-admin/purchase-requests/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(toUpdatePayload(restaurantSlug, form)),
        });
        setSuccessMessage('Purchase request updated.');
      } else {
        await apiRequest('/api/restaurant-admin/purchase-requests', {
          method: 'POST',
          body: JSON.stringify(toCreatePayload(restaurantSlug, form)),
        });
        setSuccessMessage('Purchase request created.');
      }
      resetForm();
      await load(false);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(request, status) {
    if (!writable || request.status === status) return;
    setError('');
    setSuccessMessage('');
    try {
      await apiRequest(`/api/restaurant-admin/purchase-requests/${request.id}`, {
        method: 'PUT',
        body: JSON.stringify({ restaurantSlug, status }),
      });
      setSuccessMessage(`Purchase request ${request.reference} moved to ${getPurchaseRequestStatusLabel(status)}.`);
      await load(false);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function receiveRequest(request) {
    if (!canReceiveRequest(request)) return;
    if (!window.confirm(`Receive stock for ${request.reference}? Receiving stock increases inventory and records inventory movements for every line. No invoice, payment, supplier sending, email, or WhatsApp workflow is connected.`)) return;
    setReceivingId(request.id);
    setError('');
    setSuccessMessage('');
    try {
      await apiRequest(`/api/restaurant-admin/purchase-requests/${request.id}/receive`, {
        method: 'POST',
        body: JSON.stringify({ restaurantSlug }),
      });
      setSuccessMessage(`Stock received for ${request.reference}. Inventory increased and inventory movements were recorded.`);
      await load(false);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setReceivingId('');
    }
  }

  return (
    <div className="space-y-5">
      {error ? <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div> : null}
      {successMessage ? <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{successMessage}</div> : null}
      {loading ? <div className="rounded-md border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-600">Loading purchase requests...</div> : null}
      {!writable ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          SUPPORT access is read-only. OWNER or MANAGER access is required to create or update purchase requests.
        </div>
      ) : null}
      <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950">
        Receiving stock increases inventory and records inventory movements from full request lines. No invoice, payment, supplier sending, email, or WhatsApp workflow is connected. No send-to-vendor action is added.
      </div>

      <section className="grid gap-3 md:grid-cols-4">
        <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-normal text-neutral-500">Requests</p>
          <p className="mt-1 text-2xl font-semibold">{summary.total}</p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-normal text-neutral-500">Open</p>
          <p className="mt-1 text-2xl font-semibold">{summary.open}</p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-normal text-neutral-500">Received</p>
          <p className="mt-1 text-2xl font-semibold">{summary.received}</p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-normal text-neutral-500">Low-stock review</p>
          <p className="mt-1 text-2xl font-semibold">{summary.lowStock}</p>
        </div>
      </section>

      <section className={writable ? 'grid gap-4 xl:grid-cols-[0.95fr_1.05fr]' : 'grid gap-4'}>
        {writable ? (
          <div className="space-y-4">
            <form onSubmit={submitRequest} className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
              <h2 className="text-lg font-semibold">{editingId ? 'Edit purchase request' : 'Create purchase request'}</h2>
              <p className="mt-1 text-sm text-neutral-600">
                {editingId ? 'Editing updates request details and status. Line editing can be handled by creating a new request if needed.' : 'Create a manual request from scoped inventory items.'}
              </p>
              <div className="mt-4 grid gap-3">
                <select className={inputClass} disabled={saving} value={form.supplierId} onChange={(event) => updateForm('supplierId', event.target.value)}>
                  <option value="">No supplier selected</option>
                  {activeSuppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
                </select>
                <div className="grid gap-3 sm:grid-cols-2">
                  <select className={inputClass} disabled={saving} value={form.status} onChange={(event) => updateForm('status', event.target.value)}>
                    {statusOptions.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
                  </select>
                  <input className={inputClass} type="date" disabled={saving} value={form.expectedDate} onChange={(event) => updateForm('expectedDate', event.target.value)} />
                </div>
                <textarea className={`${inputClass} min-h-[76px]`} disabled={saving} placeholder="Internal request notes" value={form.notes} onChange={(event) => updateForm('notes', event.target.value)} />

                {!editingId ? (
                  <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold">Line items</p>
                      <button type="button" onClick={addBlankLine} className="rounded-md border border-neutral-200 bg-white px-3 py-1 text-xs font-semibold text-neutral-700">
                        Add line
                      </button>
                    </div>
                    <div className="mt-3 grid gap-3">
                      {form.lines.map((line, index) => (
                        <div key={`${index}-${line.inventoryItemId || 'blank'}`} className="grid gap-2 rounded-md border border-neutral-200 bg-white p-3">
                          <select className={inputClass} required disabled={saving} value={line.inventoryItemId} onChange={(event) => updateLine(index, 'inventoryItemId', event.target.value)}>
                            <option value="">Select inventory item</option>
                            {activeItems.map((item) => <option key={item.id} value={item.id}>{item.name} ({formatQuantity(item.currentStock)} {item.unit})</option>)}
                          </select>
                          <div className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
                            <input className={inputClass} required type="number" min="0.01" step="0.01" disabled={saving} placeholder="Quantity" value={line.quantity} onChange={(event) => updateLine(index, 'quantity', event.target.value)} />
                            <input className={inputClass} disabled={saving} placeholder="Line notes" value={line.notes} onChange={(event) => updateLine(index, 'notes', event.target.value)} />
                            <button type="button" onClick={() => removeLine(index)} disabled={form.lines.length <= 1} className="rounded-md border border-neutral-200 px-3 py-2 text-sm font-semibold text-neutral-700 disabled:cursor-not-allowed disabled:opacity-50">
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  <button type="submit" disabled={saving} className="rounded-md bg-[#10241f] px-4 py-2 text-sm font-semibold text-white">
                    {saving ? 'Saving...' : editingId ? 'Update request' : 'Create request'}
                  </button>
                  {editingId ? (
                    <button type="button" onClick={resetForm} className="rounded-md border border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-700">
                      Cancel edit
                    </button>
                  ) : null}
                </div>
              </div>
            </form>

            <section className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
              <h2 className="text-lg font-semibold">Low-stock helper view</h2>
              <p className="mt-1 text-sm text-neutral-600">Review tenant inventory items below reorder level and add them to a draft request manually.</p>
              <div className="mt-4 grid gap-2">
                {lowStockItems.length ? lowStockItems.map((item) => (
                  <div key={item.id} className="rounded-md border border-neutral-100 px-3 py-2 text-sm">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-semibold">{item.name}</p>
                        <p className="text-neutral-600">{formatQuantity(item.currentStock)} {item.unit} in stock; reorder at {item.reorderLevel === null ? 'not set' : `${formatQuantity(item.reorderLevel)} ${item.unit}`}</p>
                      </div>
                      <button type="button" onClick={() => addLineFromItem(item)} disabled={Boolean(editingId)} className="rounded-md border border-neutral-200 px-3 py-2 text-sm font-semibold text-neutral-700 disabled:cursor-not-allowed disabled:opacity-50">
                        Add to request
                      </button>
                    </div>
                  </div>
                )) : (
                  <p className="rounded-md border border-dashed border-neutral-200 px-4 py-6 text-center text-sm text-neutral-500">
                    No low-stock inventory items need review right now.
                  </p>
                )}
              </div>
            </section>
          </div>
        ) : null}

        <section className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Purchase request list</h2>
              <p className="mt-1 text-sm text-neutral-600">Status tracking only; no request is sent to vendors automatically.</p>
            </div>
            <button type="button" onClick={() => load(false)} disabled={loading} className="rounded-md border border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-700">
              Refresh
            </button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <input className={inputClass} placeholder="Search requests" value={search} onChange={(event) => setSearch(event.target.value)} />
            <select className={inputClass} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="ALL">All statuses</option>
              {statusOptions.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
            </select>
          </div>
          <div className="mt-4 grid gap-3">
            {filteredRequests.length ? filteredRequests.map((request) => (
              <article key={request.id} className="rounded-md border border-neutral-100 p-3">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{request.reference}</h3>
                      <span className={getStatusBadgeClass(request.status)}>{request.statusLabel}</span>
                    </div>
                    <p className="mt-1 text-sm text-neutral-600">{request.supplier?.name || 'No supplier selected'}</p>
                    <p className="text-xs text-neutral-500">Expected: {request.expectedDate ? formatDate(request.expectedDate) : 'Not set'} - Created: {formatDate(request.createdAt)}</p>
                    {request.notes ? <p className="mt-2 rounded-md bg-neutral-50 px-3 py-2 text-sm text-neutral-700">{request.notes}</p> : null}
                  </div>
                  {writable ? (
                    <div className="flex flex-wrap gap-2">
                      {canReceiveRequest(request) ? (
                        <button
                          type="button"
                          onClick={() => receiveRequest(request)}
                          disabled={receivingId === request.id}
                          className="rounded-md bg-emerald-700 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {receivingId === request.id ? 'Receiving...' : 'Receive stock'}
                        </button>
                      ) : request.status === PURCHASE_REQUEST_STATUSES.RECEIVED ? (
                        <span className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
                          Stock received
                        </span>
                      ) : null}
                      <button type="button" onClick={() => startEdit(request)} className="rounded-md border border-neutral-200 px-3 py-2 text-sm font-semibold text-neutral-700">
                        Edit
                      </button>
                      <select className={inputClass} value={request.status} disabled={receivingId === request.id} onChange={(event) => updateStatus(request, event.target.value)}>
                        {statusOptions.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
                      </select>
                    </div>
                  ) : null}
                </div>
                <div className="mt-3 grid gap-2 rounded-md bg-neutral-50 px-3 py-2 text-sm">
                  {request.lines?.length ? request.lines.map((line) => (
                    <div key={line.id} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <span>{line.itemName}</span>
                      <span className="font-semibold">{formatQuantity(line.quantity)} {line.unit}</span>
                    </div>
                  )) : <span className="text-neutral-500">No line items recorded.</span>}
                </div>
              </article>
            )) : (
              <p className="rounded-md border border-dashed border-neutral-200 px-4 py-6 text-center text-sm text-neutral-500">
                {loading ? 'Loading purchase requests...' : 'No purchase requests match the current filters.'}
              </p>
            )}
          </div>
        </section>
      </section>
    </div>
  );
}
