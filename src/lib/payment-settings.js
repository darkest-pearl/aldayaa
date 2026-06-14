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

export const PAYMENT_SETTINGS_FORBIDDEN_KEY_PATTERN = /secret|token|password|webhookSecret|signingSecret|apiKey|card|cvc|bank/i;

const modeValues = Object.freeze(Object.values(PAYMENT_SETTING_MODES));
const providerValues = Object.freeze(Object.values(PAYMENT_SETTING_PROVIDERS));

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

export function assertSafePaymentSettingsPayload(value) {
  const forbiddenKey = findForbiddenPaymentSettingKey(value);
  if (forbiddenKey) {
    const error = new Error(`Payment settings cannot include secret or private payment data: ${forbiddenKey}`);
    error.code = 'PAYMENT_SETTINGS_SECRET_FIELD';
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
