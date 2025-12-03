'use client';

import { useEffect, useState } from 'react';
import AdminCard from '../../components/AdminCard.jsx';
import AdminForm from '../../components/AdminForm.jsx';
import AdminPageHeader from '../../components/AdminPageHeader.jsx';

async function apiRequest(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const data = await res.json();
  if (!data?.success) {
    throw new Error(data?.error || 'Request failed');
  }
  return data.data;
}

const defaultState = {
  openingTime: '08:00',
  closingTime: '23:00',
  allowCancelPaid: false,
  allowCancelInProgress: false,
  cancellationFee: 0,
};

export default function SettingsClient({ initialSettings }) {
  const [form, setForm] = useState(initialSettings || defaultState);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  const load = async () => {
    setFetching(true);
    setError(null);
    setMessage(null);
    try {
      const data = await apiRequest('/api/admin/settings');
      setForm(data.settings || defaultState);
    } catch (err) {
      setError(err.message);
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    if (initialSettings) return;
    load();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      await apiRequest('/api/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({
          ...form,
          cancellationFee: Number(form.cancellationFee || 0),
        }),
      });
      setMessage('Settings updated successfully');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Restaurant settings"
        description="Manage opening hours and order cancellation policies."
      />

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}
      {message && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div>
      )}

      <AdminCard title="Operating hours & cancellations" description="Control when customers can book and how cancellations are handled." actions={fetching && <span className="text-xs text-neutral-500">Refreshing…</span>}>
        <AdminForm
          onSubmit={handleSubmit}
          submitLabel="Save settings"
          submitting={loading}
          secondaryAction={
            <button
              type="button"
              className="text-sm font-semibold text-neutral-700 underline"
              onClick={load}
              disabled={fetching}
            >
              Reload
            </button>
          }
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-neutral-800">Opening time</label>
              <input
                type="time"
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                value={form.openingTime}
                onChange={(e) => handleChange('openingTime', e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-neutral-800">Closing time</label>
              <input
                type="time"
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                value={form.closingTime}
                onChange={(e) => handleChange('closingTime', e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <label className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm font-semibold text-neutral-800">
              <input
                type="checkbox"
                checked={!!form.allowCancelPaid}
                onChange={(e) => handleChange('allowCancelPaid', e.target.checked)}
              />
              Allow cancellation for paid orders
            </label>
            <label className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm font-semibold text-neutral-800">
              <input
                type="checkbox"
                checked={!!form.allowCancelInProgress}
                onChange={(e) => handleChange('allowCancelInProgress', e.target.checked)}
              />
              Allow cancellation in progress
            </label>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-neutral-800">Cancellation fee (AED)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                value={form.cancellationFee}
                onChange={(e) => handleChange('cancellationFee', e.target.value)}
              />
            </div>
          </div>
        </AdminForm>
      </AdminCard>
    </div>
  );
}