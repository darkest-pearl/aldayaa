import { prisma } from './prisma';

export const TENANT_AUDIT_ACTIONS = Object.freeze({
  STAFF_CREATED: 'STAFF_CREATED',
  STAFF_UPDATED: 'STAFF_UPDATED',
  SETTINGS_UPDATED: 'SETTINGS_UPDATED',
  SUPPLIER_CREATED: 'SUPPLIER_CREATED',
  SUPPLIER_UPDATED: 'SUPPLIER_UPDATED',
  INVENTORY_ITEM_CREATED: 'INVENTORY_ITEM_CREATED',
  INVENTORY_ITEM_UPDATED: 'INVENTORY_ITEM_UPDATED',
  INVENTORY_MOVEMENT_CREATED: 'INVENTORY_MOVEMENT_CREATED',
  RECIPE_CONSUMPTION_APPLIED: 'RECIPE_CONSUMPTION_APPLIED',
  PURCHASE_REQUEST_CREATED: 'PURCHASE_REQUEST_CREATED',
  PURCHASE_REQUEST_UPDATED: 'PURCHASE_REQUEST_UPDATED',
  PURCHASE_REQUEST_RECEIVED: 'PURCHASE_REQUEST_RECEIVED',
  PURCHASE_INVOICE_CREATED: 'PURCHASE_INVOICE_CREATED',
  PURCHASE_INVOICE_UPDATED: 'PURCHASE_INVOICE_UPDATED',
  PURCHASE_INVOICE_PAYMENT_RECORDED: 'PURCHASE_INVOICE_PAYMENT_RECORDED',
  PURCHASE_INVOICE_PAYMENT_VOIDED: 'PURCHASE_INVOICE_PAYMENT_VOIDED',
  ORDER_STATUS_UPDATED: 'ORDER_STATUS_UPDATED',
  RESERVATION_STATUS_UPDATED: 'RESERVATION_STATUS_UPDATED',
});

const SENSITIVE_METADATA_KEYS = Object.freeze([
  'password',
  'passwordHash',
  'cookie',
  'cookies',
  'session',
  'sessionToken',
  'token',
  'DATABASE_URL',
  'secret',
  'secrets',
]);

const sensitiveKeyPattern = new RegExp(SENSITIVE_METADATA_KEYS.join('|'), 'i');

function cleanString(value, maxLength = 500) {
  if (typeof value !== 'string') return null;
  const cleaned = value.trim();
  return cleaned ? cleaned.slice(0, maxLength) : null;
}

function sanitizeAuditMetadata(value, depth = 0) {
  if (value === null || value === undefined) return null;
  if (depth > 4) return '[Truncated]';
  if (typeof value === 'string') return value.slice(0, 500);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => sanitizeAuditMetadata(item, depth + 1));
  }
  if (typeof value === 'object') {
    return Object.entries(value).reduce((metadata, [key, entryValue]) => {
      if (sensitiveKeyPattern.test(key)) {
        metadata[key] = '[Redacted]';
      } else {
        metadata[key] = sanitizeAuditMetadata(entryValue, depth + 1);
      }
      return metadata;
    }, {});
  }

  return String(value).slice(0, 500);
}

function getHeader(request, key) {
  if (!request?.headers?.get) return null;
  return cleanString(request.headers.get(key), 500);
}

function getClientIp(request) {
  const forwardedFor = getHeader(request, 'x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0].trim().slice(0, 120);
  return getHeader(request, 'x-real-ip') || getHeader(request, 'cf-connecting-ip');
}

function summarizeMetadata(metadata) {
  if (!metadata) return '';
  try {
    return JSON.stringify(metadata);
  } catch (error) {
    return '';
  }
}

export async function createTenantAuditLog({
  staff,
  request,
  action,
  entityType,
  entityId,
  summary,
  metadata,
}) {
  if (!staff?.restaurantId || !action || !entityType || !summary) return null;

  const safeMetadata = sanitizeAuditMetadata(metadata);

  try {
    return await prisma.restaurantAuditLog.create({
      data: {
        restaurantId: staff.restaurantId,
        actorRestaurantUserId: staff.id || null,
        actorEmail: staff.email || null,
        actorRole: staff.role || null,
        action: cleanString(action, 120),
        entityType: cleanString(entityType, 120),
        entityId: cleanString(entityId, 160),
        summary: cleanString(summary, 500),
        metadata: safeMetadata,
        ipAddress: getClientIp(request),
        userAgent: getHeader(request, 'user-agent'),
      },
    });
  } catch (error) {
    console.error('Tenant audit log write failed', { action, entityType, entityId: cleanString(entityId, 160) });
    return null;
  }
}

export function normalizeTenantAuditLog(log = {}) {
  const metadata = sanitizeAuditMetadata(log.metadata);

  return {
    id: log.id,
    actorRestaurantUserId: log.actorRestaurantUserId || '',
    actorEmail: log.actorEmail || '',
    actorRole: log.actorRole || '',
    action: log.action || '',
    entityType: log.entityType || '',
    entityId: log.entityId || '',
    summary: log.summary || '',
    metadataSummary: summarizeMetadata(metadata),
    ipAddress: log.ipAddress || '',
    userAgent: log.userAgent || '',
    createdAt: log.createdAt,
  };
}

export function normalizeTenantAuditLogs(logs = []) {
  return logs.map(normalizeTenantAuditLog);
}
