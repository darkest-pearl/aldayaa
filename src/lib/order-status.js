export const ORDER_STATUSES = Object.freeze({
  NEW: 'NEW',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
});

export const ORDER_CONTEXTS = Object.freeze({
  STANDARD: 'STANDARD',
  TABLE: 'TABLE',
});

export const ORDER_SOURCES = Object.freeze({
  CUSTOMER: 'CUSTOMER',
  STAFF_ASSISTED: 'STAFF_ASSISTED',
});

const ORDER_STATUS_LABELS = Object.freeze({
  [ORDER_STATUSES.NEW]: 'New',
  [ORDER_STATUSES.IN_PROGRESS]: 'In progress',
  [ORDER_STATUSES.COMPLETED]: 'Completed',
  [ORDER_STATUSES.CANCELLED]: 'Cancelled',
});

const ORDER_CONTEXT_LABELS = Object.freeze({
  [ORDER_CONTEXTS.STANDARD]: 'Standard',
  [ORDER_CONTEXTS.TABLE]: 'Table order',
});

const ORDER_SOURCE_LABELS = Object.freeze({
  [ORDER_SOURCES.CUSTOMER]: 'Customer',
  [ORDER_SOURCES.STAFF_ASSISTED]: 'Staff-assisted',
});

const ORDER_STATUS_VALUES = Object.freeze(Object.values(ORDER_STATUSES));
const ORDER_TRANSITIONS = Object.freeze({
  [ORDER_STATUSES.NEW]: Object.freeze([
    ORDER_STATUSES.IN_PROGRESS,
    ORDER_STATUSES.COMPLETED,
    ORDER_STATUSES.CANCELLED,
  ]),
  [ORDER_STATUSES.IN_PROGRESS]: Object.freeze([ORDER_STATUSES.COMPLETED, ORDER_STATUSES.CANCELLED]),
  [ORDER_STATUSES.COMPLETED]: Object.freeze([]),
  [ORDER_STATUSES.CANCELLED]: Object.freeze([]),
});

export function isValidOrderStatus(status) {
  return ORDER_STATUS_VALUES.includes(status);
}

export function getOrderStatusLabel(status) {
  return ORDER_STATUS_LABELS[status] || 'Unknown';
}

export function getOrderContextLabel(context) {
  return ORDER_CONTEXT_LABELS[context] || 'Standard';
}

export function getOrderSourceLabel(source) {
  return ORDER_SOURCE_LABELS[source] || 'Customer';
}

export function canTransitionOrderStatus(from, to) {
  if (from === to) return isValidOrderStatus(from);
  return Boolean(ORDER_TRANSITIONS[from]?.includes(to));
}
