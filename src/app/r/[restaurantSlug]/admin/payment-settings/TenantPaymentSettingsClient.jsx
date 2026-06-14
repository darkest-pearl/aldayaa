'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  PAYMENT_SETTING_MODES,
  PAYMENT_SETTING_PROVIDERS,
} from '../../../../../lib/payment-settings';

const inputClass = 'rounded-md border border-neutral-200 px-3 py-2 text-sm outline-none transition focus:border-emerald-700 disabled:bg-neutral-50 disabled:text-neutral-500';

const defaultSettings = {
  paymentMode: PAYMENT_SETTING_MODES.DISABLED,
  provider: PAYMENT_SETTING_PROVIDERS.NONE,
  onlineOrderPaymentsEnabled: false,
  subscriptionBillingEnabled: false,
  refundsEnabled: false,
  notes: '',
  publicKeyConfigured: false,
  webhookConfigured: false,
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

function getProviderLabel(value) {
  if (value === PAYMENT_SETTING_PROVIDERS.PROVIDER_PLACEHOLDER) return 'Provider placeholder';
  return 'None';
}

function getModeLabel(value) {
  if (value === PAYMENT_SETTING_MODES.TEST_PLANNED) return 'Test planned';
  if (value === PAYMENT_SETTING_MODES.LIVE_PLANNED) return 'Live planned';
  return 'Disabled';
}

export default function TenantPaymentSettingsClient({ restaurantSlug, staffRole }) {
  const writable = canWrite(staffRole);
  const [settings, setSettings] = useState(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    setSuccessMessage('');
    try {
      const data = await apiRequest(`/api/restaurant-admin/payment-settings?restaurantSlug=${encodeURIComponent(restaurantSlug)}`);
      setSettings({ ...defaultSettings, ...(data.paymentSettings || {}) });
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

  const readinessItems = useMemo(() => [
    {
      label: 'provider selected',
      complete: settings.provider !== PAYMENT_SETTING_PROVIDERS.NONE,
    },
    {
      label: 'public key configured externally',
      complete: Boolean(settings.publicKeyConfigured),
    },
    {
      label: 'webhook endpoint planned externally',
      complete: Boolean(settings.webhookConfigured),
    },
    {
      label: 'secrets stored in hosting provider, not database',
      complete: true,
    },
  ], [settings.provider, settings.publicKeyConfigured, settings.webhookConfigured]);

  function updateField(field, value) {
    setSettings((current) => ({ ...current, [field]: value }));
  }

  async function saveSettings(event) {
    event.preventDefault();
    if (!writable) return;
    setSaving(true);
    setError('');
    setSuccessMessage('');
    try {
      const data = await apiRequest('/api/restaurant-admin/payment-settings', {
        method: 'PUT',
        body: JSON.stringify({
          restaurantSlug,
          paymentMode: settings.paymentMode,
          provider: settings.provider,
          onlineOrderPaymentsEnabled: Boolean(settings.onlineOrderPaymentsEnabled),
          subscriptionBillingEnabled: Boolean(settings.subscriptionBillingEnabled),
          refundsEnabled: Boolean(settings.refundsEnabled),
          notes: settings.notes,
          publicKeyConfigured: Boolean(settings.publicKeyConfigured),
          webhookConfigured: Boolean(settings.webhookConfigured),
        }),
      });
      setSettings({ ...defaultSettings, ...(data.paymentSettings || {}) });
      setSuccessMessage('Payment settings saved.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      {error ? <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div> : null}
      {successMessage ? <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{successMessage}</div> : null}
      {loading ? <div className="rounded-md border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-600">Loading payment settings...</div> : null}
      {!writable ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          SUPPORT access is read-only. OWNER or MANAGER access is required to update payment settings.
        </div>
      ) : null}

      <section className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-950">
        <p className="font-semibold">No real payment processing is enabled.</p>
        <p>No provider secrets are stored here.</p>
        <p>No checkout sessions or webhooks are active.</p>
        <p>Manual invoice payment recording remains separate.</p>
      </section>

      <section className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <form onSubmit={saveSettings} className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold">Planned provider settings</h2>
          <p className="mt-1 text-sm text-neutral-600">Provider selection is disabled/planned configuration only.</p>
          <div className="mt-4 grid gap-3">
            <label className="grid gap-1 text-sm font-semibold text-neutral-800">
              Payment mode
              <select className={inputClass} disabled={!writable || saving} value={settings.paymentMode} onChange={(event) => updateField('paymentMode', event.target.value)}>
                <option value={PAYMENT_SETTING_MODES.DISABLED}>Disabled</option>
                <option value={PAYMENT_SETTING_MODES.TEST_PLANNED}>Test planned</option>
                <option value={PAYMENT_SETTING_MODES.LIVE_PLANNED}>Live planned</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm font-semibold text-neutral-800">
              Provider
              <select className={inputClass} disabled={!writable || saving} value={settings.provider} onChange={(event) => updateField('provider', event.target.value)}>
                <option value={PAYMENT_SETTING_PROVIDERS.NONE}>None</option>
                <option value={PAYMENT_SETTING_PROVIDERS.PROVIDER_PLACEHOLDER}>Provider placeholder</option>
              </select>
            </label>
            <div className="grid gap-2 rounded-md border border-neutral-100 bg-neutral-50 p-3 text-sm">
              <label className="flex items-center gap-2 text-neutral-700">
                <input type="checkbox" disabled={!writable || saving} checked={Boolean(settings.onlineOrderPaymentsEnabled)} onChange={(event) => updateField('onlineOrderPaymentsEnabled', event.target.checked)} />
                Online order payments planned
              </label>
              <label className="flex items-center gap-2 text-neutral-700">
                <input type="checkbox" disabled={!writable || saving} checked={Boolean(settings.subscriptionBillingEnabled)} onChange={(event) => updateField('subscriptionBillingEnabled', event.target.checked)} />
                Subscription billing planned
              </label>
              <label className="flex items-center gap-2 text-neutral-700">
                <input type="checkbox" disabled={!writable || saving} checked={Boolean(settings.refundsEnabled)} onChange={(event) => updateField('refundsEnabled', event.target.checked)} />
                Refund workflow planned
              </label>
              <label className="flex items-center gap-2 text-neutral-700">
                <input type="checkbox" disabled={!writable || saving} checked={Boolean(settings.publicKeyConfigured)} onChange={(event) => updateField('publicKeyConfigured', event.target.checked)} />
                Public key configured externally
              </label>
              <label className="flex items-center gap-2 text-neutral-700">
                <input type="checkbox" disabled={!writable || saving} checked={Boolean(settings.webhookConfigured)} onChange={(event) => updateField('webhookConfigured', event.target.checked)} />
                Webhook planned externally
              </label>
            </div>
            <textarea className={`${inputClass} min-h-[96px]`} disabled={!writable || saving} placeholder="Operator notes; do not enter secrets, tokens, card data, or bank details." value={settings.notes || ''} onChange={(event) => updateField('notes', event.target.value)} />
            <div>
              <button disabled={!writable || saving} className="rounded-md bg-[#10241f] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
                {saving ? 'Saving payment settings...' : 'Save payment settings'}
              </button>
            </div>
          </div>
        </form>

        <section className="space-y-4">
          <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold">Current state</h2>
            <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
              <div className="rounded-md bg-neutral-50 px-3 py-2">
                <span className="block text-xs font-semibold uppercase tracking-normal text-neutral-500">Mode</span>
                <span className="font-semibold">{getModeLabel(settings.paymentMode)}</span>
              </div>
              <div className="rounded-md bg-neutral-50 px-3 py-2">
                <span className="block text-xs font-semibold uppercase tracking-normal text-neutral-500">Provider</span>
                <span className="font-semibold">{getProviderLabel(settings.provider)}</span>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold">Readiness checklist</h2>
            <div className="mt-4 grid gap-2 text-sm">
              {readinessItems.map((item) => (
                <div key={item.label} className="flex items-center justify-between rounded-md bg-neutral-50 px-3 py-2">
                  <span>{item.label}</span>
                  <span className={item.complete ? 'font-semibold text-emerald-700' : 'font-semibold text-neutral-500'}>
                    {item.complete ? 'Ready' : 'Pending'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </section>
    </div>
  );
}
