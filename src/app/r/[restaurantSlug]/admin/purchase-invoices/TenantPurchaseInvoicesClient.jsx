'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  PURCHASE_INVOICE_PAYMENT_STATUSES,
  PURCHASE_INVOICE_STATUSES,
  getPurchaseInvoiceStatusOptions,
} from '../../../../../lib/purchase-invoices';

const inputClass = 'rounded-md border border-neutral-200 px-3 py-2 text-sm outline-none transition focus:border-emerald-700 disabled:bg-neutral-50 disabled:text-neutral-500';
const statusOptions = getPurchaseInvoiceStatusOptions();

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function createEmptyInvoiceForm() {
  return {
    invoiceNumber: '',
    supplierId: '',
    purchaseRequestId: '',
    status: PURCHASE_INVOICE_STATUSES.DRAFT,
    invoiceDate: todayInputValue(),
    dueDate: '',
    currency: 'AED',
    taxAmount: '0',
    notes: '',
    lines: [
      {
        description: '',
        inventoryItemId: '',
        quantity: '1',
        unit: 'unit',
        unitCost: '0',
        notes: '',
      },
    ],
  };
}

function createEmptyPaymentForm(invoice = null) {
  const balanceDue = invoice?.paymentSummary?.balanceDue ?? invoice?.totalAmount ?? 0;
  return {
    invoiceId: invoice?.id || '',
    amount: balanceDue > 0 ? String(balanceDue) : '',
    currency: invoice?.currency || 'AED',
    method: 'Cash',
    reference: '',
    paidAt: todayInputValue(),
    notes: '',
  };
}

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

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function formatDate(value) {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not recorded';
  return date.toLocaleDateString();
}

function formatDateInput(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function formatMoney(value, currency = 'AED') {
  return `${currency || 'AED'} ${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(toNumber(value))}`;
}

function getStatusBadgeClass(status) {
  if (status === PURCHASE_INVOICE_STATUSES.RECORDED) return 'rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800';
  if (status === PURCHASE_INVOICE_STATUSES.VOID) return 'rounded-full bg-red-50 px-2 py-1 text-xs font-semibold text-red-700';
  return 'rounded-full bg-neutral-100 px-2 py-1 text-xs font-semibold text-neutral-700';
}

function getPaymentStatusBadgeClass(status) {
  if (status === 'PAID') return 'rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800';
  if (status === 'PARTIALLY_PAID') return 'rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800';
  if (status === 'VOID') return 'rounded-full bg-red-50 px-2 py-1 text-xs font-semibold text-red-700';
  return 'rounded-full bg-neutral-100 px-2 py-1 text-xs font-semibold text-neutral-700';
}

function getLineTotal(line) {
  return Math.round(toNumber(line.quantity) * toNumber(line.unitCost) * 100) / 100;
}

function toCreatePayload(restaurantSlug, form) {
  return {
    restaurantSlug,
    invoiceNumber: form.invoiceNumber.trim(),
    supplierId: form.supplierId || null,
    purchaseRequestId: form.purchaseRequestId || null,
    status: form.status,
    invoiceDate: form.invoiceDate,
    dueDate: form.dueDate || null,
    currency: form.currency.trim() || 'AED',
    taxAmount: toNumber(form.taxAmount),
    notes: form.notes.trim() || null,
    lines: form.lines.map((line) => ({
      description: line.description.trim(),
      inventoryItemId: line.inventoryItemId || null,
      quantity: toNumber(line.quantity),
      unit: line.unit.trim(),
      unitCost: toNumber(line.unitCost),
      notes: line.notes.trim() || null,
    })),
  };
}

function toUpdatePayload(restaurantSlug, form) {
  return {
    restaurantSlug,
    invoiceNumber: form.invoiceNumber.trim(),
    supplierId: form.supplierId || null,
    purchaseRequestId: form.purchaseRequestId || null,
    status: form.status,
    invoiceDate: form.invoiceDate,
    dueDate: form.dueDate || null,
    currency: form.currency.trim() || 'AED',
    taxAmount: toNumber(form.taxAmount),
    notes: form.notes.trim() || null,
  };
}

function toPaymentPayload(restaurantSlug, form) {
  return {
    restaurantSlug,
    amount: toNumber(form.amount),
    currency: form.currency.trim() || 'AED',
    method: form.method.trim(),
    reference: form.reference.trim() || null,
    paidAt: form.paidAt,
    notes: form.notes.trim() || null,
  };
}

export default function TenantPurchaseInvoicesClient({ restaurantSlug, staffRole }) {
  const writable = canWrite(staffRole);
  const [purchaseInvoices, setPurchaseInvoices] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [purchaseRequests, setPurchaseRequests] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [form, setForm] = useState(createEmptyInvoiceForm);
  const [paymentForm, setPaymentForm] = useState(createEmptyPaymentForm);
  const [editingId, setEditingId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [voidingPaymentId, setVoidingPaymentId] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  async function load(showLoading = true) {
    if (showLoading) setLoading(true);
    setError('');
    try {
      const [invoiceData, supplierData, requestData, itemData] = await Promise.all([
        apiRequest(`/api/restaurant-admin/purchase-invoices?restaurantSlug=${encodeURIComponent(restaurantSlug)}`),
        apiRequest(`/api/restaurant-admin/suppliers?restaurantSlug=${encodeURIComponent(restaurantSlug)}`),
        apiRequest(`/api/restaurant-admin/purchase-requests?restaurantSlug=${encodeURIComponent(restaurantSlug)}`),
        apiRequest(`/api/restaurant-admin/inventory/items?restaurantSlug=${encodeURIComponent(restaurantSlug)}`),
      ]);
      setPurchaseInvoices(invoiceData.purchaseInvoices || []);
      setSuppliers(supplierData.suppliers || []);
      setPurchaseRequests(requestData.purchaseRequests || []);
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
  const invoiceTotals = useMemo(() => {
    const subtotal = form.lines.reduce((sum, line) => sum + getLineTotal(line), 0);
    const taxAmount = toNumber(form.taxAmount);
    return {
      subtotal,
      taxAmount,
      totalAmount: subtotal + taxAmount,
    };
  }, [form.lines, form.taxAmount]);
  const summary = useMemo(() => ({
    total: purchaseInvoices.length,
    draft: purchaseInvoices.filter((invoice) => invoice.status === PURCHASE_INVOICE_STATUSES.DRAFT).length,
    recorded: purchaseInvoices.filter((invoice) => invoice.status === PURCHASE_INVOICE_STATUSES.RECORDED).length,
    void: purchaseInvoices.filter((invoice) => invoice.status === PURCHASE_INVOICE_STATUSES.VOID).length,
    unpaid: purchaseInvoices.filter((invoice) => invoice.paymentSummary?.paymentStatus === 'UNPAID').length,
    partiallyPaid: purchaseInvoices.filter((invoice) => invoice.paymentSummary?.paymentStatus === 'PARTIALLY_PAID').length,
    paid: purchaseInvoices.filter((invoice) => invoice.paymentSummary?.paymentStatus === 'PAID').length,
  }), [purchaseInvoices]);
  const filteredInvoices = useMemo(() => {
    const query = search.trim().toLowerCase();
    return purchaseInvoices.filter((invoice) => {
      const matchesStatus = statusFilter === 'ALL' || invoice.status === statusFilter;
      const matchesSearch = !query || [
        invoice.invoiceNumber,
        invoice.statusLabel,
        invoice.supplier?.name,
        invoice.purchaseRequest?.reference,
        invoice.notes,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query);
      return matchesStatus && matchesSearch;
    });
  }, [purchaseInvoices, search, statusFilter]);

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updatePaymentForm(field, value) {
    setPaymentForm((current) => ({ ...current, [field]: value }));
  }

  function resetForm() {
    setEditingId('');
    setForm(createEmptyInvoiceForm());
  }

  function resetPaymentForm() {
    setPaymentForm(createEmptyPaymentForm());
  }

  function updateLine(index, field, value) {
    setForm((current) => ({
      ...current,
      lines: current.lines.map((line, lineIndex) =>
        lineIndex === index ? { ...line, [field]: value } : line
      ),
    }));
  }

  function updateLineInventoryItem(index, inventoryItemId) {
    const item = activeItems.find((inventoryItem) => inventoryItem.id === inventoryItemId);
    setForm((current) => ({
      ...current,
      lines: current.lines.map((line, lineIndex) =>
        lineIndex === index
          ? {
              ...line,
              inventoryItemId,
              description: item?.name || line.description,
              unit: item?.unit || line.unit,
              unitCost: item?.costPerUnit === null || item?.costPerUnit === undefined ? line.unitCost : String(item.costPerUnit),
            }
          : line
      ),
    }));
  }

  function addBlankLine() {
    setForm((current) => ({
      ...current,
      lines: [
        ...current.lines,
        {
          description: '',
          inventoryItemId: '',
          quantity: '1',
          unit: 'unit',
          unitCost: '0',
          notes: '',
        },
      ],
    }));
  }

  function removeLine(index) {
    setForm((current) => ({
      ...current,
      lines: current.lines.length > 1 ? current.lines.filter((_, lineIndex) => lineIndex !== index) : current.lines,
    }));
  }

  function startEdit(invoice) {
    setEditingId(invoice.id);
    setForm({
      invoiceNumber: invoice.invoiceNumber || '',
      supplierId: invoice.supplierId || '',
      purchaseRequestId: invoice.purchaseRequestId || '',
      status: invoice.status || PURCHASE_INVOICE_STATUSES.DRAFT,
      invoiceDate: formatDateInput(invoice.invoiceDate),
      dueDate: formatDateInput(invoice.dueDate),
      currency: invoice.currency || 'AED',
      taxAmount: String(invoice.taxAmount || 0),
      notes: invoice.notes || '',
      lines: invoice.lines?.length
        ? invoice.lines.map((line) => ({
            description: line.description || '',
            inventoryItemId: line.inventoryItemId || '',
            quantity: String(line.quantity || 1),
            unit: line.unit || 'unit',
            unitCost: String(line.unitCost || 0),
            notes: line.notes || '',
          }))
        : createEmptyInvoiceForm().lines,
    });
    setError('');
    setSuccessMessage('');
  }

  function startPayment(invoice) {
    if (!writable || invoice.status !== PURCHASE_INVOICE_STATUSES.RECORDED) return;
    setPaymentForm(createEmptyPaymentForm(invoice));
    setError('');
    setSuccessMessage('');
  }

  function canRecordPayment(invoice) {
    return (
      writable &&
      invoice.status === PURCHASE_INVOICE_STATUSES.RECORDED &&
      toNumber(invoice.paymentSummary?.balanceDue) > 0
    );
  }

  function canVoidPayment(invoice, payment) {
    return (
      writable &&
      invoice.status === PURCHASE_INVOICE_STATUSES.RECORDED &&
      payment.status === PURCHASE_INVOICE_PAYMENT_STATUSES.RECORDED
    );
  }

  async function submitInvoice(event) {
    event.preventDefault();
    if (!writable) return;
    setSaving(true);
    setError('');
    setSuccessMessage('');
    try {
      if (editingId) {
        await apiRequest(`/api/restaurant-admin/purchase-invoices/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(toUpdatePayload(restaurantSlug, form)),
        });
        setSuccessMessage('Purchase invoice updated.');
      } else {
        await apiRequest('/api/restaurant-admin/purchase-invoices', {
          method: 'POST',
          body: JSON.stringify(toCreatePayload(restaurantSlug, form)),
        });
        setSuccessMessage('Purchase invoice recorded.');
      }
      resetForm();
      await load(false);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function submitPayment(event, invoice) {
    event.preventDefault();
    if (!canRecordPayment(invoice)) return;
    if (!window.confirm('Record this manual payment? No real payment processing, No refunds, no supplier sending, no email/WhatsApp, and no accounting/bank integration is connected.')) return;
    setPaymentSaving(true);
    setError('');
    setSuccessMessage('');
    try {
      await apiRequest(`/api/restaurant-admin/purchase-invoices/${invoice.id}/payments`, {
        method: 'POST',
        body: JSON.stringify(toPaymentPayload(restaurantSlug, paymentForm)),
      });
      setSuccessMessage(`Manual payment recorded for ${invoice.invoiceNumber}.`);
      resetPaymentForm();
      await load(false);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setPaymentSaving(false);
    }
  }

  async function voidPayment(invoice, payment) {
    if (!canVoidPayment(invoice, payment)) return;
    if (!window.confirm(`Void payment ${formatMoney(payment.amount, payment.currency)} for ${invoice.invoiceNumber}? No refunds or payment reversals are processed.`)) return;
    setVoidingPaymentId(payment.id);
    setError('');
    setSuccessMessage('');
    try {
      await apiRequest(`/api/restaurant-admin/purchase-invoices/${invoice.id}/payments/${payment.id}`, {
        method: 'PUT',
        body: JSON.stringify({ restaurantSlug, status: PURCHASE_INVOICE_PAYMENT_STATUSES.VOID }),
      });
      setSuccessMessage(`Manual payment voided for ${invoice.invoiceNumber}.`);
      await load(false);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setVoidingPaymentId('');
    }
  }

  async function updateStatus(invoice, status) {
    if (!writable || invoice.status === status) return;
    setError('');
    setSuccessMessage('');
    try {
      await apiRequest(`/api/restaurant-admin/purchase-invoices/${invoice.id}`, {
        method: 'PUT',
        body: JSON.stringify({ restaurantSlug, status }),
      });
      setSuccessMessage(`Purchase invoice ${invoice.invoiceNumber} moved to ${status.toLowerCase()}.`);
      await load(false);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  return (
    <div className="space-y-5">
      {error ? <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div> : null}
      {successMessage ? <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{successMessage}</div> : null}
      {loading ? <div className="rounded-md border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-600">Loading purchase invoices...</div> : null}
      {!writable ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          SUPPORT access is read-only. OWNER or MANAGER access is required to create or update purchase invoices.
        </div>
      ) : null}
      <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950">
        Invoice and manual payment recording only. No real payment processing, No refunds, no supplier sending, no email/WhatsApp,
        no accounting/bank integration, billing, tax, or analytics automation is connected. No inventory stock change and No inventory movement creation happens from invoices.
      </div>

      <section className="grid gap-3 md:grid-cols-4 xl:grid-cols-7">
        <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-normal text-neutral-500">Invoices</p>
          <p className="mt-1 text-2xl font-semibold">{summary.total}</p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-normal text-neutral-500">Draft</p>
          <p className="mt-1 text-2xl font-semibold">{summary.draft}</p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-normal text-neutral-500">Recorded</p>
          <p className="mt-1 text-2xl font-semibold">{summary.recorded}</p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-normal text-neutral-500">Void</p>
          <p className="mt-1 text-2xl font-semibold">{summary.void}</p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-normal text-neutral-500">Unpaid</p>
          <p className="mt-1 text-2xl font-semibold">{summary.unpaid}</p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-normal text-neutral-500">Partial</p>
          <p className="mt-1 text-2xl font-semibold">{summary.partiallyPaid}</p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-normal text-neutral-500">Paid</p>
          <p className="mt-1 text-2xl font-semibold">{summary.paid}</p>
        </div>
      </section>

      <section className={writable ? 'grid gap-4 xl:grid-cols-[0.95fr_1.05fr]' : 'grid gap-4'}>
        {writable ? (
          <form onSubmit={submitInvoice} className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold">{editingId ? 'Edit purchase invoice' : 'Record purchase invoice'}</h2>
            <p className="mt-1 text-sm text-neutral-600">
              {editingId ? 'Editing updates invoice details and status. Line changes can be handled by recording a corrected invoice if needed.' : 'Record invoice lines from supplier paperwork without changing stock or payment state.'}
            </p>
            <div className="mt-4 grid gap-3">
              <input className={inputClass} required disabled={saving} placeholder="Invoice number" value={form.invoiceNumber} onChange={(event) => updateForm('invoiceNumber', event.target.value)} />
              <div className="grid gap-3 sm:grid-cols-2">
                <select className={inputClass} disabled={saving} value={form.supplierId} onChange={(event) => updateForm('supplierId', event.target.value)}>
                  <option value="">No supplier selected</option>
                  {activeSuppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
                </select>
                <select className={inputClass} disabled={saving} value={form.purchaseRequestId} onChange={(event) => updateForm('purchaseRequestId', event.target.value)}>
                  <option value="">No purchase request linked</option>
                  {purchaseRequests.map((request) => <option key={request.id} value={request.id}>{request.reference} ({request.statusLabel})</option>)}
                </select>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <select className={inputClass} disabled={saving} value={form.status} onChange={(event) => updateForm('status', event.target.value)}>
                  {statusOptions.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
                </select>
                <input className={inputClass} required type="date" disabled={saving} value={form.invoiceDate} onChange={(event) => updateForm('invoiceDate', event.target.value)} />
                <input className={inputClass} type="date" disabled={saving} value={form.dueDate} onChange={(event) => updateForm('dueDate', event.target.value)} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <input className={inputClass} disabled={saving} placeholder="Currency" value={form.currency} onChange={(event) => updateForm('currency', event.target.value.toUpperCase())} />
                <input className={inputClass} type="number" min="0" step="0.01" disabled={saving} placeholder="Tax amount" value={form.taxAmount} onChange={(event) => updateForm('taxAmount', event.target.value)} />
              </div>
              <textarea className={`${inputClass} min-h-[76px]`} disabled={saving} placeholder="Internal invoice notes" value={form.notes} onChange={(event) => updateForm('notes', event.target.value)} />

              {!editingId ? (
                <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold">Invoice lines</p>
                    <button type="button" onClick={addBlankLine} className="rounded-md border border-neutral-200 bg-white px-3 py-1 text-xs font-semibold text-neutral-700">
                      Add line
                    </button>
                  </div>
                  <div className="mt-3 grid gap-3">
                    {form.lines.map((line, index) => (
                      <div key={`${index}-${line.inventoryItemId || 'manual'}`} className="grid gap-2 rounded-md border border-neutral-200 bg-white p-3">
                        <select className={inputClass} disabled={saving} value={line.inventoryItemId} onChange={(event) => updateLineInventoryItem(index, event.target.value)}>
                          <option value="">No inventory item linked</option>
                          {activeItems.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.unit})</option>)}
                        </select>
                        <input className={inputClass} required disabled={saving} placeholder="Description" value={line.description} onChange={(event) => updateLine(index, 'description', event.target.value)} />
                        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_1fr_auto]">
                          <input className={inputClass} required type="number" min="0.01" step="0.01" disabled={saving} placeholder="Quantity" value={line.quantity} onChange={(event) => updateLine(index, 'quantity', event.target.value)} />
                          <input className={inputClass} required disabled={saving} placeholder="Unit" value={line.unit} onChange={(event) => updateLine(index, 'unit', event.target.value)} />
                          <input className={inputClass} required type="number" min="0" step="0.01" disabled={saving} placeholder="Unit cost" value={line.unitCost} onChange={(event) => updateLine(index, 'unitCost', event.target.value)} />
                          <div className="rounded-md bg-neutral-50 px-3 py-2 text-sm font-semibold text-neutral-700">
                            {formatMoney(getLineTotal(line), form.currency)}
                          </div>
                          <button type="button" onClick={() => removeLine(index)} disabled={form.lines.length <= 1} className="rounded-md border border-neutral-200 px-3 py-2 text-sm font-semibold text-neutral-700 disabled:cursor-not-allowed disabled:opacity-50">
                            Remove
                          </button>
                        </div>
                        <input className={inputClass} disabled={saving} placeholder="Line notes" value={line.notes} onChange={(event) => updateLine(index, 'notes', event.target.value)} />
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-600">
                  Invoice line editing is not enabled in this foundation. Record a corrected invoice for line changes.
                </div>
              )}

              <div className="grid gap-2 rounded-md bg-neutral-50 px-3 py-2 text-sm sm:grid-cols-3">
                <div>
                  <span className="block text-xs font-semibold uppercase tracking-normal text-neutral-500">Subtotal</span>
                  <span className="font-semibold">{formatMoney(editingId ? purchaseInvoices.find((invoice) => invoice.id === editingId)?.subtotal : invoiceTotals.subtotal, form.currency)}</span>
                </div>
                <div>
                  <span className="block text-xs font-semibold uppercase tracking-normal text-neutral-500">Tax</span>
                  <span className="font-semibold">{formatMoney(invoiceTotals.taxAmount, form.currency)}</span>
                </div>
                <div>
                  <span className="block text-xs font-semibold uppercase tracking-normal text-neutral-500">Total</span>
                  <span className="font-semibold">{formatMoney(editingId ? toNumber(purchaseInvoices.find((invoice) => invoice.id === editingId)?.subtotal) + invoiceTotals.taxAmount : invoiceTotals.totalAmount, form.currency)}</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button type="submit" disabled={saving} className="rounded-md bg-[#10241f] px-4 py-2 text-sm font-semibold text-white">
                  {saving ? 'Saving...' : editingId ? 'Update invoice' : 'Record invoice'}
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
              <h2 className="text-lg font-semibold">Purchase invoice list</h2>
              <p className="mt-1 text-sm text-neutral-600">Invoice status tracking only; no vendor or payment workflow runs.</p>
            </div>
            <button type="button" onClick={() => load(false)} disabled={loading} className="rounded-md border border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-700">
              Refresh
            </button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <input className={inputClass} placeholder="Search invoices" value={search} onChange={(event) => setSearch(event.target.value)} />
            <select className={inputClass} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="ALL">All statuses</option>
              {statusOptions.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
            </select>
          </div>
          <div className="mt-4 grid gap-3">
            {filteredInvoices.length ? filteredInvoices.map((invoice) => (
              <article key={invoice.id} className="rounded-md border border-neutral-100 p-3">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{invoice.invoiceNumber}</h3>
                      <span className={getStatusBadgeClass(invoice.status)}>{invoice.statusLabel}</span>
                    </div>
                    <p className="mt-1 text-sm text-neutral-600">{invoice.supplier?.name || 'No supplier selected'}</p>
                    <p className="text-xs text-neutral-500">
                      Invoice: {formatDate(invoice.invoiceDate)} - Due: {invoice.dueDate ? formatDate(invoice.dueDate) : 'Not set'}
                    </p>
                    {invoice.purchaseRequest ? <p className="mt-1 text-xs text-neutral-500">Request: {invoice.purchaseRequest.reference}</p> : null}
                    {invoice.notes ? <p className="mt-2 rounded-md bg-neutral-50 px-3 py-2 text-sm text-neutral-700">{invoice.notes}</p> : null}
                  </div>
                  {writable ? (
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => startEdit(invoice)} className="rounded-md border border-neutral-200 px-3 py-2 text-sm font-semibold text-neutral-700">
                        Edit
                      </button>
                      <select className={inputClass} value={invoice.status} onChange={(event) => updateStatus(invoice, event.target.value)}>
                        {statusOptions.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
                      </select>
                    </div>
                  ) : null}
                </div>
                <div className="mt-3 grid gap-2 rounded-md bg-neutral-50 px-3 py-2 text-sm">
                  {invoice.lines?.length ? invoice.lines.map((line) => (
                    <div key={line.id} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <span>{line.description}</span>
                      <span className="font-semibold">{line.quantity} {line.unit} x {formatMoney(line.unitCost, invoice.currency)} = {formatMoney(line.lineTotal, invoice.currency)}</span>
                    </div>
                  )) : <span className="text-neutral-500">No invoice lines recorded.</span>}
                </div>
                <div className="mt-3 flex flex-wrap gap-3 text-sm">
                  <span>Subtotal: <strong>{formatMoney(invoice.subtotal, invoice.currency)}</strong></span>
                  <span>Tax: <strong>{formatMoney(invoice.taxAmount, invoice.currency)}</strong></span>
                  <span>Total: <strong>{formatMoney(invoice.totalAmount, invoice.currency)}</strong></span>
                </div>
                <div className="mt-3 grid gap-3 rounded-md border border-neutral-100 bg-white px-3 py-3 text-sm">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">Payment summary</p>
                        <span className={getPaymentStatusBadgeClass(invoice.paymentSummary?.paymentStatus)}>
                          {invoice.paymentSummary?.paymentStatusLabel || 'Unpaid'}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-neutral-500">
                        Manual records only. No real payment processing, No refunds, no supplier sending, no email/WhatsApp, and no accounting/bank integration is connected.
                      </p>
                    </div>
                    {canRecordPayment(invoice) ? (
                      <button type="button" onClick={() => startPayment(invoice)} className="rounded-md border border-neutral-200 px-3 py-2 text-sm font-semibold text-neutral-700">
                        Record manual payment
                      </button>
                    ) : null}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <div className="rounded-md bg-neutral-50 px-3 py-2">
                      <span className="block text-xs font-semibold uppercase tracking-normal text-neutral-500">Paid</span>
                      <span className="font-semibold">{formatMoney(invoice.paymentSummary?.paidAmount, invoice.currency)}</span>
                    </div>
                    <div className="rounded-md bg-neutral-50 px-3 py-2">
                      <span className="block text-xs font-semibold uppercase tracking-normal text-neutral-500">Balance due</span>
                      <span className="font-semibold">{formatMoney(invoice.paymentSummary?.balanceDue, invoice.currency)}</span>
                    </div>
                    <div className="rounded-md bg-neutral-50 px-3 py-2">
                      <span className="block text-xs font-semibold uppercase tracking-normal text-neutral-500">Payments</span>
                      <span className="font-semibold">{invoice.payments?.length || 0}</span>
                    </div>
                  </div>
                  {paymentForm.invoiceId === invoice.id ? (
                    <form onSubmit={(event) => submitPayment(event, invoice)} className="grid gap-3 rounded-md border border-neutral-200 bg-neutral-50 p-3">
                      <div className="grid gap-3 sm:grid-cols-3">
                        <input className={inputClass} required type="number" min="0.01" step="0.01" disabled={paymentSaving} placeholder="Amount" value={paymentForm.amount} onChange={(event) => updatePaymentForm('amount', event.target.value)} />
                        <input className={inputClass} disabled={paymentSaving} placeholder="Currency" value={paymentForm.currency} onChange={(event) => updatePaymentForm('currency', event.target.value.toUpperCase())} />
                        <input className={inputClass} required disabled={paymentSaving} placeholder="Method" value={paymentForm.method} onChange={(event) => updatePaymentForm('method', event.target.value)} />
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <input className={inputClass} type="date" required disabled={paymentSaving} value={paymentForm.paidAt} onChange={(event) => updatePaymentForm('paidAt', event.target.value)} />
                        <input className={inputClass} disabled={paymentSaving} placeholder="Reference" value={paymentForm.reference} onChange={(event) => updatePaymentForm('reference', event.target.value)} />
                      </div>
                      <textarea className={`${inputClass} min-h-[68px]`} disabled={paymentSaving} placeholder="Payment notes" value={paymentForm.notes} onChange={(event) => updatePaymentForm('notes', event.target.value)} />
                      <div className="flex flex-wrap gap-2">
                        <button type="submit" disabled={paymentSaving} className="rounded-md bg-[#10241f] px-4 py-2 text-sm font-semibold text-white">
                          {paymentSaving ? 'Recording...' : 'Save manual payment'}
                        </button>
                        <button type="button" onClick={resetPaymentForm} disabled={paymentSaving} className="rounded-md border border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-700">
                          Cancel payment
                        </button>
                      </div>
                    </form>
                  ) : null}
                  <div className="grid gap-2">
                    {invoice.payments?.length ? invoice.payments.map((payment) => (
                      <div key={payment.id} className="flex flex-col gap-2 rounded-md bg-neutral-50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-semibold">{formatMoney(payment.amount, payment.currency)} - {payment.method}</p>
                          <p className="text-xs text-neutral-500">
                            Paid: {formatDate(payment.paidAt)}{payment.reference ? ` - Ref: ${payment.reference}` : ''} - {payment.statusLabel}
                          </p>
                          {payment.notes ? <p className="mt-1 text-xs text-neutral-600">{payment.notes}</p> : null}
                        </div>
                        {canVoidPayment(invoice, payment) ? (
                          <button type="button" onClick={() => voidPayment(invoice, payment)} disabled={voidingPaymentId === payment.id} className="rounded-md border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 disabled:cursor-not-allowed disabled:opacity-50">
                            {voidingPaymentId === payment.id ? 'Voiding...' : 'Void payment'}
                          </button>
                        ) : null}
                      </div>
                    )) : (
                      <p className="rounded-md border border-dashed border-neutral-200 px-3 py-3 text-center text-sm text-neutral-500">
                        No manual payment records yet.
                      </p>
                    )}
                  </div>
                </div>
              </article>
            )) : (
              <p className="rounded-md border border-dashed border-neutral-200 px-4 py-6 text-center text-sm text-neutral-500">
                {loading ? 'Loading purchase invoices...' : 'No purchase invoices match the current filters.'}
              </p>
            )}
          </div>
        </section>
      </section>
    </div>
  );
}
