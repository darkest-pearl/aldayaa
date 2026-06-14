export const PAYMENT_PROVIDER_EVENT_STATUSES = Object.freeze({
  RECEIVED: 'RECEIVED',
  IGNORED: 'IGNORED',
  PROCESSED: 'PROCESSED',
  FAILED: 'FAILED',
});

export const PAYMENT_PROVIDER_MODES = Object.freeze({
  TEST: 'TEST',
  LIVE: 'LIVE',
});

export const UNSAFE_PAYMENT_PROVIDER_EVENT_METADATA_KEY_PATTERN =
  /authorization|header|cookie|session|signature|webhookSignature|secret|token|password|apiKey|card|cvc|cvv|pan|payload|raw|body/i;

export const UNSAFE_PAYMENT_PROVIDER_EVENT_METADATA_VALUE_PATTERN = new RegExp(
  [
    'sk_live_',
    'sk_test_',
    'whsec_',
    'postgres://',
    'postgresql://',
    '-----BEGIN',
    'PAYMENT_SECRET_KEY=',
    'PAYMENT_WEBHOOK_SIGNING_SECRET=',
  ].map(escapeRegExp).join('|'),
  'i',
);

const statusValues = Object.freeze(Object.values(PAYMENT_PROVIDER_EVENT_STATUSES));
const modeValues = Object.freeze(Object.values(PAYMENT_PROVIDER_MODES));

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function cleanString(value, maxLength = 160) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

function cleanOptionalString(value, maxLength = 300) {
  const cleaned = cleanString(value, maxLength);
  return cleaned || '';
}

function toDateValue(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function passesLuhnCheck(value) {
  let sum = 0;
  let shouldDouble = false;

  for (let index = value.length - 1; index >= 0; index -= 1) {
    let digit = Number(value[index]);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }

  return sum > 0 && sum % 10 === 0;
}

function looksLikeRawCardNumber(value) {
  const cleaned = typeof value === 'string' ? value.trim() : '';
  const digits = cleaned.replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) return false;
  if (!/^[\d\s-]+$/.test(cleaned)) return false;
  return passesLuhnCheck(digits);
}

function sanitizeMetadataValue(value, depth = 0) {
  if (value === null || value === undefined) return null;
  if (depth > 4) return '[Truncated]';
  if (typeof value === 'string') {
    if (UNSAFE_PAYMENT_PROVIDER_EVENT_METADATA_VALUE_PATTERN.test(value) || looksLikeRawCardNumber(value)) {
      return '[Redacted]';
    }
    return value.trim().slice(0, 500);
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => sanitizeMetadataValue(item, depth + 1));
  }
  if (typeof value === 'object') {
    return sanitizePaymentProviderEventMetadata(value, depth + 1);
  }
  return String(value).slice(0, 500);
}

export function isValidPaymentProviderEventStatus(status) {
  return statusValues.includes(status);
}

export function isValidPaymentProviderMode(providerMode) {
  return modeValues.includes(providerMode);
}

export function normalizePaymentProviderEventStatus(status) {
  const cleanStatus = cleanString(status).toUpperCase();
  return isValidPaymentProviderEventStatus(cleanStatus) ? cleanStatus : PAYMENT_PROVIDER_EVENT_STATUSES.RECEIVED;
}

export function normalizePaymentProviderMode(providerMode) {
  const cleanMode = cleanString(providerMode).toUpperCase();
  return isValidPaymentProviderMode(cleanMode) ? cleanMode : PAYMENT_PROVIDER_MODES.TEST;
}

export function sanitizePaymentProviderEventMetadata(metadata = {}, depth = 0) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return {};
  if (depth > 4) return { truncated: true };

  return Object.entries(metadata).reduce((safeMetadata, [key, value]) => {
    const safeKey = cleanString(key, 80);
    if (!safeKey) return safeMetadata;
    if (UNSAFE_PAYMENT_PROVIDER_EVENT_METADATA_KEY_PATTERN.test(safeKey)) {
      safeMetadata[safeKey] = '[Redacted]';
      return safeMetadata;
    }
    safeMetadata[safeKey] = sanitizeMetadataValue(value, depth + 1);
    return safeMetadata;
  }, {});
}

function summarizeMetadata(metadata) {
  const safeMetadata = sanitizePaymentProviderEventMetadata(metadata);
  if (!Object.keys(safeMetadata).length) return '';
  try {
    return JSON.stringify(safeMetadata).slice(0, 1000);
  } catch (error) {
    return '';
  }
}

export function normalizePaymentProviderEvent(event = {}) {
  return {
    id: event.id,
    provider: cleanString(event.provider),
    providerMode: normalizePaymentProviderMode(event.providerMode),
    providerEventId: cleanString(event.providerEventId),
    eventType: cleanString(event.eventType),
    status: normalizePaymentProviderEventStatus(event.status),
    receivedAt: toDateValue(event.receivedAt),
    processedAt: toDateValue(event.processedAt),
    failureReason: cleanOptionalString(event.failureReason, 300),
    idempotencyKey: cleanOptionalString(event.idempotencyKey, 160),
    relatedEntityType: cleanOptionalString(event.relatedEntityType, 120),
    relatedEntityId: cleanOptionalString(event.relatedEntityId, 160),
    metadataSummary: summarizeMetadata(event.metadata),
    createdAt: toDateValue(event.createdAt),
    updatedAt: toDateValue(event.updatedAt),
  };
}

export function normalizePaymentProviderEvents(events = []) {
  return events.map(normalizePaymentProviderEvent);
}
