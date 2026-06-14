export const PAYMENT_SETTING_MODES = Object.freeze({
  DISABLED: 'DISABLED',
  TEST_PLANNED: 'TEST_PLANNED',
  LIVE_PLANNED: 'LIVE_PLANNED',
});

export const PAYMENT_SETTING_PROVIDERS = Object.freeze({
  NONE: 'NONE',
  PROVIDER_PLACEHOLDER: 'PROVIDER_PLACEHOLDER',
});

export const DEFAULT_PAYMENT_SETTINGS = Object.freeze({
  paymentMode: PAYMENT_SETTING_MODES.DISABLED,
  provider: PAYMENT_SETTING_PROVIDERS.NONE,
  onlineOrderPaymentsEnabled: false,
  subscriptionBillingEnabled: false,
  refundsEnabled: false,
  notes: '',
  publicKeyConfigured: false,
  webhookConfigured: false,
});

export const PAYMENT_SETTINGS_SECRET_REJECTION_MESSAGE = 'Payment settings cannot include secret or private payment data';
export const PAYMENT_SETTINGS_FORBIDDEN_KEY_PATTERN = /secret|token|password|webhookSecret|signingSecret|apiKey|card|cvc|bank/i;
export const PAYMENT_SETTINGS_FORBIDDEN_VALUE_PATTERN = new RegExp(
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

const modeValues = Object.freeze(Object.values(PAYMENT_SETTING_MODES));
const providerValues = Object.freeze(Object.values(PAYMENT_SETTING_PROVIDERS));

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toBoolean(value) {
  return value === true;
}

function normalizeNotes(value) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, 500);
}

function parseStoredPaymentSettings(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  if (typeof value !== 'string') return {};

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (error) {
    return {};
  }
}

function getSafeMode(value) {
  return modeValues.includes(value) ? value : DEFAULT_PAYMENT_SETTINGS.paymentMode;
}

function getSafeProvider(value) {
  return providerValues.includes(value) ? value : DEFAULT_PAYMENT_SETTINGS.provider;
}

function findForbiddenPaymentSettingKey(value, path = []) {
  if (!value || typeof value !== 'object') return null;

  for (const [key, entryValue] of Object.entries(value)) {
    const nextPath = [...path, key];
    if (PAYMENT_SETTINGS_FORBIDDEN_KEY_PATTERN.test(key)) {
      return nextPath.join('.');
    }
    if (entryValue && typeof entryValue === 'object') {
      const nested = findForbiddenPaymentSettingKey(entryValue, nextPath);
      if (nested) return nested;
    }
  }

  return null;
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

function looksLikeRawPaymentCardNumber(value) {
  const digits = value.replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) return false;
  if (!/^[\d\s-]+$/.test(value.trim())) return false;
  return passesLuhnCheck(digits);
}

function findForbiddenPaymentSettingValue(value, path = []) {
  if (typeof value === 'string') {
    if (PAYMENT_SETTINGS_FORBIDDEN_VALUE_PATTERN.test(value) || looksLikeRawPaymentCardNumber(value)) {
      return path.join('.') || 'value';
    }
    return null;
  }

  if (!value || typeof value !== 'object') return null;

  for (const [key, entryValue] of Object.entries(value)) {
    const nested = findForbiddenPaymentSettingValue(entryValue, [...path, key]);
    if (nested) return nested;
  }

  return null;
}

export function assertSafePaymentSettingsPayload(value) {
  const forbiddenKey = findForbiddenPaymentSettingKey(value);
  if (forbiddenKey) {
    const error = new Error(`${PAYMENT_SETTINGS_SECRET_REJECTION_MESSAGE}: ${forbiddenKey}`);
    error.code = 'PAYMENT_SETTINGS_SECRET_FIELD';
    throw error;
  }

  const forbiddenPath = findForbiddenPaymentSettingValue(value);
  if (forbiddenPath) {
    const error = new Error(`${PAYMENT_SETTINGS_SECRET_REJECTION_MESSAGE}: ${forbiddenPath}`);
    error.code = 'PAYMENT_SETTINGS_SECRET_VALUE';
    throw error;
  }
}

export function normalizePaymentSettings(value = {}) {
  const parsed = parseStoredPaymentSettings(value);

  return {
    paymentMode: getSafeMode(parsed.paymentMode),
    provider: getSafeProvider(parsed.provider),
    onlineOrderPaymentsEnabled: toBoolean(parsed.onlineOrderPaymentsEnabled),
    subscriptionBillingEnabled: toBoolean(parsed.subscriptionBillingEnabled),
    refundsEnabled: toBoolean(parsed.refundsEnabled),
    notes: normalizeNotes(parsed.notes),
    publicKeyConfigured: toBoolean(parsed.publicKeyConfigured),
    webhookConfigured: toBoolean(parsed.webhookConfigured),
  };
}

export function serializePaymentSettings(value = {}) {
  return JSON.stringify(normalizePaymentSettings(value));
}
