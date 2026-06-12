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

export const PURCHASE_INVOICE_PAYMENT_STATUSES = Object.freeze({
  RECORDED: 'RECORDED',
  VOID: 'VOID',
});

export const PURCHASE_INVOICE_PAYMENT_STATUS_LABELS = Object.freeze({
  [PURCHASE_INVOICE_PAYMENT_STATUSES.RECORDED]: 'Recorded',
  [PURCHASE_INVOICE_PAYMENT_STATUSES.VOID]: 'Void',
});

export const PURCHASE_INVOICE_PAYMENT_SUMMARY_STATUSES = Object.freeze({
  UNPAID: 'UNPAID',
  PARTIALLY_PAID: 'PARTIALLY_PAID',
  PAID: 'PAID',
  VOID: 'VOID',
});

export const PURCHASE_INVOICE_PAYMENT_SUMMARY_STATUS_LABELS = Object.freeze({
  [PURCHASE_INVOICE_PAYMENT_SUMMARY_STATUSES.UNPAID]: 'Unpaid',
  [PURCHASE_INVOICE_PAYMENT_SUMMARY_STATUSES.PARTIALLY_PAID]: 'Partially paid',
  [PURCHASE_INVOICE_PAYMENT_SUMMARY_STATUSES.PAID]: 'Paid',
  [PURCHASE_INVOICE_PAYMENT_SUMMARY_STATUSES.VOID]: 'Void',
});

const purchaseInvoiceStatusValues = Object.freeze(Object.values(PURCHASE_INVOICE_STATUSES));
const purchaseInvoicePaymentStatusValues = Object.freeze(Object.values(PURCHASE_INVOICE_PAYMENT_STATUSES));

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

export function isValidPurchaseInvoicePaymentStatus(status) {
  return purchaseInvoicePaymentStatusValues.includes(status);
}

export function getPurchaseInvoicePaymentStatusLabel(status) {
  return PURCHASE_INVOICE_PAYMENT_STATUS_LABELS[status] || status || 'Status';
}

export function getPurchaseInvoicePaymentSummaryStatusLabel(status) {
  return PURCHASE_INVOICE_PAYMENT_SUMMARY_STATUS_LABELS[status] || status || 'Payment status';
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

export function calculatePurchaseInvoicePaymentSummary(invoiceOrPayments = {}, totalAmountOverride) {
  const payments = Array.isArray(invoiceOrPayments)
    ? invoiceOrPayments
    : Array.isArray(invoiceOrPayments.payments)
      ? invoiceOrPayments.payments
      : [];
  const totalAmount = roundMoney(
    totalAmountOverride === undefined ? invoiceOrPayments.totalAmount : totalAmountOverride
  );
  const paidAmount = roundMoney(
    payments
      .filter((payment) => payment.status !== PURCHASE_INVOICE_PAYMENT_STATUSES.VOID)
      .reduce((sum, payment) => sum + toNumber(payment.amount), 0)
  );
  const balanceDue = roundMoney(Math.max(totalAmount - paidAmount, 0));
  let paymentStatus = PURCHASE_INVOICE_PAYMENT_SUMMARY_STATUSES.UNPAID;

  if (!Array.isArray(invoiceOrPayments) && invoiceOrPayments.status === PURCHASE_INVOICE_STATUSES.VOID) {
    paymentStatus = PURCHASE_INVOICE_PAYMENT_SUMMARY_STATUSES.VOID;
  } else if (totalAmount > 0 && paidAmount >= totalAmount) {
    paymentStatus = PURCHASE_INVOICE_PAYMENT_SUMMARY_STATUSES.PAID;
  } else if (paidAmount > 0) {
    paymentStatus = PURCHASE_INVOICE_PAYMENT_SUMMARY_STATUSES.PARTIALLY_PAID;
  }

  return {
    paidAmount,
    balanceDue,
    paymentStatus,
    paymentStatusLabel: getPurchaseInvoicePaymentSummaryStatusLabel(paymentStatus),
  };
}

export function normalizePurchaseInvoicePayment(payment = {}) {
  return {
    id: payment.id,
    purchaseInvoiceId: payment.purchaseInvoiceId,
    amount: toNumber(payment.amount),
    currency: payment.currency || 'AED',
    method: payment.method || '',
    reference: payment.reference || '',
    paidAt: payment.paidAt,
    notes: payment.notes || '',
    status: payment.status || PURCHASE_INVOICE_PAYMENT_STATUSES.RECORDED,
    statusLabel: getPurchaseInvoicePaymentStatusLabel(payment.status || PURCHASE_INVOICE_PAYMENT_STATUSES.RECORDED),
    createdByAdminEmail: payment.createdByAdminEmail || '',
    createdAt: payment.createdAt,
    updatedAt: payment.updatedAt,
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
  const payments = Array.isArray(invoice.payments) ? invoice.payments.map(normalizePurchaseInvoicePayment) : [];

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
    payments,
    paymentSummary: calculatePurchaseInvoicePaymentSummary(invoice),
    createdAt: invoice.createdAt,
    updatedAt: invoice.updatedAt,
  };
}

export function normalizePurchaseInvoices(invoices = []) {
  return invoices.map(normalizePurchaseInvoice);
}
