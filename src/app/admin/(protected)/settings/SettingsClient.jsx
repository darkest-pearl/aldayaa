'use client';

import { useEffect, useState } from 'react';
import AdminCard from '../../components/AdminCard.jsx';
import AdminForm from '../../components/AdminForm.jsx';
import AdminPageHeader from '../../components/AdminPageHeader.jsx';

const DAY_ORDER = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' },
];

const DEFAULT_OPENING_TIME = '08:00';
const DEFAULT_CLOSING_TIME = '23:00';

const createWorkingHours = (openingTime = DEFAULT_OPENING_TIME, closingTime = DEFAULT_CLOSING_TIME) =>
  DAY_ORDER.map(({ key }) => ({ day: key, openingTime, closingTime, closed: false }));

const createDisplayHours = (openingTime = DEFAULT_OPENING_TIME, closingTime = DEFAULT_CLOSING_TIME) => {
  const range = `${openingTime} – ${closingTime}`;
  return {
    weekday: `Sunday–Thursday: ${range}`,
    friday: `Friday: ${range}`,
    saturday: `Saturday: ${range}`,
  };
};

const withWorkingHours = (settings = {}) => {
  const fallbackOpeningTime = settings.openingTime || DEFAULT_OPENING_TIME;
  const fallbackClosingTime = settings.closingTime || DEFAULT_CLOSING_TIME;
  const provided = Array.isArray(settings.workingHoursByDay) ? settings.workingHoursByDay : [];
  const providedMap = new Map(provided.map((entry) => [entry.day, entry]));
  const workingHoursByDay = createWorkingHours(fallbackOpeningTime, fallbackClosingTime).map((entry) => {
    const found = providedMap.get(entry.day);
    if (!found) return entry;
    return {
      ...entry,
      openingTime: found.openingTime || entry.openingTime,
      closingTime: found.closingTime || entry.closingTime,
      closed: Boolean(found.closed),
    };
  });

  const fallbackDisplayHours = createDisplayHours(fallbackOpeningTime, fallbackClosingTime);
  const providedDisplayHours =
    settings.displayHours && typeof settings.displayHours === 'object'
      ? settings.displayHours
      : null;
      
  return {
    openingTime: fallbackOpeningTime,
    closingTime: fallbackClosingTime,
    allowCancelPaid: false,
    allowCancelInProgress: false,
    cancellationFee: 0,
    ...settings,
    workingHoursByDay,
    displayHours: {
      weekday: providedDisplayHours?.weekday || fallbackDisplayHours.weekday,
      friday: providedDisplayHours?.friday || fallbackDisplayHours.friday,
      saturday: providedDisplayHours?.saturday || fallbackDisplayHours.saturday,
    },
  };
};

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

const defaultState = withWorkingHours({
  openingTime: DEFAULT_OPENING_TIME,
  closingTime: DEFAULT_CLOSING_TIME,
  allowCancelPaid: false,
  allowCancelInProgress: false,
  cancellationFee: 0,
});

export default function SettingsClient({ initialSettings }) {
  const [form, setForm] = useState(() => withWorkingHours(initialSettings || defaultState));
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
      setForm(withWorkingHours(data.settings || defaultState));
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
      const workingHours = form.workingHoursByDay?.length
        ? form.workingHoursByDay
        : createWorkingHours(form.openingTime, form.closingTime);
      const primaryDay = workingHours.find((entry) => entry.day === 'monday') || workingHours[0];

      await apiRequest('/api/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({
          ...form,
          openingTime: primaryDay?.openingTime || form.openingTime,
          closingTime: primaryDay?.closingTime || form.closingTime,
          workingHoursByDay: workingHours,
          cancellationFee: Number(form.cancellationFee || 0),
          displayHours: form.displayHours,
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

  const handleDisplayHoursChange = (key, value) => {
    setForm((prev) => ({
      ...prev,
      displayHours: {
        ...createDisplayHours(prev.openingTime, prev.closingTime),
        ...(prev.displayHours || {}),
        [key]: value,
      },
    }));
  };
  
  const handleWorkingHoursChange = (dayKey, key, value) => {
    setForm((prev) => {
      const baseHours = prev.workingHoursByDay?.length
        ? prev.workingHoursByDay
        : createWorkingHours(prev.openingTime, prev.closingTime);

      const workingHoursByDay = baseHours.map((entry) =>
        entry.day === dayKey ? { ...entry, [key]: value } : entry,
      );

      const nextForm = { ...prev, workingHoursByDay };
      if (dayKey === 'monday' && (key === 'openingTime' || key === 'closingTime')) {
        nextForm[key] = value;
      }

      return nextForm;
    });
  };

  const workingHours = form.workingHoursByDay?.length
    ? form.workingHoursByDay
    : createWorkingHours(form.openingTime, form.closingTime);
    
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
          <div className="space-y-3">
            <div>
              <p className="text-sm font-semibold text-neutral-800">Working hours</p>
              <p className="text-sm text-neutral-600">Configure opening and closing times for each day.</p>
            </div>
            <div className="overflow-hidden rounded-lg border border-neutral-200">
              <table className="min-w-full divide-y divide-neutral-200 text-sm">
                <thead className="bg-neutral-50 text-left text-xs font-semibold uppercase text-neutral-600">
                  <tr>
                    <th className="px-4 py-3">Day</th>
                    <th className="px-4 py-3">Opens</th>
                    <th className="px-4 py-3">Closes</th>
                    <th className="px-4 py-3">Closed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {DAY_ORDER.map(({ key, label }) => {
                    const daySettings =
                      workingHours.find((entry) => entry.day === key) ||
                      {
                        day: key,
                        openingTime: form.openingTime,
                        closingTime: form.closingTime,
                        closed: false,
                      };

                    return (
                      <tr key={key} className="align-middle">
                        <td className="px-4 py-3 text-sm font-semibold text-neutral-800">{label}</td>
                        <td className="px-4 py-3">
                          <input
                            type="time"
                            className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                            value={daySettings.openingTime}
                            onChange={(e) => handleWorkingHoursChange(key, 'openingTime', e.target.value)}
                            disabled={daySettings.closed}
                            required
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="time"
                            className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                            value={daySettings.closingTime}
                            onChange={(e) => handleWorkingHoursChange(key, 'closingTime', e.target.value)}
                            disabled={daySettings.closed}
                            required
                          />
                        </td>
                        <td className="px-4 py-3">
                          <label className="flex items-center gap-2 text-sm font-semibold text-neutral-800">
                            <input
                              type="checkbox"
                              checked={!!daySettings.closed}
                              onChange={(e) => handleWorkingHoursChange(key, 'closed', e.target.checked)}
                            />
                            Closed
                          </label>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

           <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-neutral-800">Weekday hours (Sun–Thu)</label>
              <input
                type="text"
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                value={form.displayHours?.weekday || ''}
                onChange={(e) => handleDisplayHoursChange('weekday', e.target.value)}
                placeholder="Sunday–Thursday: 12:00 PM – 2:00 AM"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-neutral-800">Friday hours</label>
              <input
                type="text"
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                value={form.displayHours?.friday || ''}
                onChange={(e) => handleDisplayHoursChange('friday', e.target.value)}
                placeholder="Friday: 1:00 PM – 2:00 AM"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-neutral-800">Saturday hours (optional)</label>
              <input
                type="text"
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                value={form.displayHours?.saturday || ''}
                onChange={(e) => handleDisplayHoursChange('saturday', e.target.value)}
                placeholder="Saturday: 12:00 PM – 2:00 AM"
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