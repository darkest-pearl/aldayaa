import { normalizeInventoryItem } from './inventory';
import { normalizeSupplier } from './suppliers';

export const PURCHASE_REQUEST_STATUSES = Object.freeze({
  DRAFT: 'DRAFT',
  REQUESTED: 'REQUESTED',
  APPROVED: 'APPROVED',
  RECEIVED: 'RECEIVED',
  CANCELLED: 'CANCELLED',
});

export const PURCHASE_REQUEST_STATUS_LABELS = Object.freeze({
  [PURCHASE_REQUEST_STATUSES.DRAFT]: 'Draft',
  [PURCHASE_REQUEST_STATUSES.REQUESTED]: 'Requested',
  [PURCHASE_REQUEST_STATUSES.APPROVED]: 'Approved',
  [PURCHASE_REQUEST_STATUSES.RECEIVED]: 'Received',
  [PURCHASE_REQUEST_STATUSES.CANCELLED]: 'Cancelled',
});

const purchaseRequestStatusValues = Object.freeze(Object.values(PURCHASE_REQUEST_STATUSES));

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function isValidPurchaseRequestStatus(status) {
  return purchaseRequestStatusValues.includes(status);
}

export function getPurchaseRequestStatusLabel(status) {
  return PURCHASE_REQUEST_STATUS_LABELS[status] || status || 'Status';
}

export function getPurchaseRequestStatusOptions() {
  return purchaseRequestStatusValues.map((value) => ({
    value,
    label: getPurchaseRequestStatusLabel(value),
  }));
}

export function normalizePurchaseRequestLine(line = {}) {
  return {
    id: line.id,
    purchaseRequestId: line.purchaseRequestId,
    inventoryItemId: line.inventoryItemId,
    itemName: line.itemName || line.inventoryItem?.name || '',
    unit: line.unit || line.inventoryItem?.unit || '',
    quantity: toNumber(line.quantity),
    notes: line.notes || '',
    inventoryItem: line.inventoryItem ? normalizeInventoryItem(line.inventoryItem) : null,
    createdAt: line.createdAt,
    updatedAt: line.updatedAt,
  };
}

export function normalizePurchaseRequest(request = {}) {
  const lines = Array.isArray(request.lines) ? request.lines.map(normalizePurchaseRequestLine) : [];

  return {
    id: request.id,
    reference: request.reference || '',
    status: request.status || PURCHASE_REQUEST_STATUSES.DRAFT,
    statusLabel: getPurchaseRequestStatusLabel(request.status || PURCHASE_REQUEST_STATUSES.DRAFT),
    notes: request.notes || '',
    expectedDate: request.expectedDate,
    createdByAdminEmail: request.createdByAdminEmail || '',
    supplierId: request.supplierId || '',
    supplier: request.supplier ? normalizeSupplier(request.supplier) : null,
    lineCount: lines.length,
    lines,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
  };
}

export function normalizePurchaseRequests(requests = []) {
  return requests.map(normalizePurchaseRequest);
}
