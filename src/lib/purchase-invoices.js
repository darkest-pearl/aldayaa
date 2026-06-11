import { normalizeInventoryItem } from './inventory';
import { normalizeSupplier } from './suppliers';

export const PURCHASE_INVOICE_STATUSES = Object.freeze({
  DRAFT: 'DRAFT',
  RECORDED: 'RECORDED',
  VOID: 'VOID',
});

export const PURCHASE_INVOICE_STATUS_LABELS = Object.freeze({
  [PURCHASE_INVOICE_STATUSES.DRAFT]: 'Draft',
  [PURCHASE_INVOICE_STATUSES.RECORDED]: 'Recorded',
  [PURCHASE_INVOICE_STATUSES.VOID]: 'Void',
});

const purchaseInvoiceStatusValues = Object.freeze(Object.values(PURCHASE_INVOICE_STATUSES));

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function roundMoney(value) {
  return Math.round(toNumber(value) * 100) / 100;
}

export function isValidPurchaseInvoiceStatus(status) {
  return purchaseInvoiceStatusValues.includes(status);
}

export function getPurchaseInvoiceStatusLabel(status) {
  return PURCHASE_INVOICE_STATUS_LABELS[status] || status || 'Status';
}

export function getPurchaseInvoiceStatusOptions() {
  return purchaseInvoiceStatusValues.map((value) => ({
    value,
    label: getPurchaseInvoiceStatusLabel(value),
  }));
}

export function calculatePurchaseInvoiceTotals(lines = [], taxAmount = 0) {
  const normalizedLines = lines.map((line) => {
    const quantity = toNumber(line.quantity);
    const unitCost = toNumber(line.unitCost);
    const lineTotal = roundMoney(quantity * unitCost);
    return {
      ...line,
      quantity,
      unitCost,
      lineTotal,
    };
  });
  const subtotal = roundMoney(normalizedLines.reduce((sum, line) => sum + toNumber(line.lineTotal), 0));
  const cleanTaxAmount = roundMoney(taxAmount);

  return {
    lines: normalizedLines,
    subtotal,
    taxAmount: cleanTaxAmount,
    totalAmount: roundMoney(subtotal + cleanTaxAmount),
  };
}

function normalizePurchaseRequestSummary(purchaseRequest = null) {
  if (!purchaseRequest) return null;
  return {
    id: purchaseRequest.id,
    reference: purchaseRequest.reference || '',
    status: purchaseRequest.status || '',
  };
}

export function normalizePurchaseInvoiceLine(line = {}) {
  return {
    id: line.id,
    purchaseInvoiceId: line.purchaseInvoiceId,
    description: line.description || '',
    quantity: toNumber(line.quantity),
    unit: line.unit || '',
    unitCost: toNumber(line.unitCost),
    lineTotal: toNumber(line.lineTotal),
    notes: line.notes || '',
    inventoryItemId: line.inventoryItemId || '',
    inventoryItem: line.inventoryItem ? normalizeInventoryItem(line.inventoryItem) : null,
    createdAt: line.createdAt,
    updatedAt: line.updatedAt,
  };
}

export function normalizePurchaseInvoice(invoice = {}) {
  const lines = Array.isArray(invoice.lines) ? invoice.lines.map(normalizePurchaseInvoiceLine) : [];

  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber || '',
    status: invoice.status || PURCHASE_INVOICE_STATUSES.DRAFT,
    statusLabel: getPurchaseInvoiceStatusLabel(invoice.status || PURCHASE_INVOICE_STATUSES.DRAFT),
    invoiceDate: invoice.invoiceDate,
    dueDate: invoice.dueDate,
    currency: invoice.currency || 'AED',
    subtotal: toNumber(invoice.subtotal),
    taxAmount: toNumber(invoice.taxAmount),
    totalAmount: toNumber(invoice.totalAmount),
    notes: invoice.notes || '',
    createdByAdminEmail: invoice.createdByAdminEmail || '',
    supplierId: invoice.supplierId || '',
    supplier: invoice.supplier ? normalizeSupplier(invoice.supplier) : null,
    purchaseRequestId: invoice.purchaseRequestId || '',
    purchaseRequest: normalizePurchaseRequestSummary(invoice.purchaseRequest),
    lineCount: lines.length,
    lines,
    createdAt: invoice.createdAt,
    updatedAt: invoice.updatedAt,
  };
}

export function normalizePurchaseInvoices(invoices = []) {
  return invoices.map(normalizePurchaseInvoice);
}
