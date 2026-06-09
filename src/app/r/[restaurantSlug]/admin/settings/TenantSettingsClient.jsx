'use client';

import { useEffect, useState } from 'react';

const inputClass = 'rounded-md border border-neutral-200 px-3 py-2 text-sm outline-none transition focus:border-emerald-700 disabled:bg-neutral-50 disabled:text-neutral-500';
const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

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

function profileDefaults() {
  return {
    restaurantName: '',
    tagline: '',
    cuisineType: '',
    whatsappNumber: '',
    whatsappLink: '',
    address: '',
    googleMapsUrl: '',
    googleMapsEmbedUrl: '',
    instagramUrl: '',
    facebookUrl: '',
    tiktokUrl: '',
    linktreeUrl: '',
    logoUrl: '',
    primaryColor: '#d6b15f',
    secondaryColor: '#183b32',
    currency: 'AED',
    enabledFeatures: [],
  };
}

function settingsDefaults() {
  return {
    openingTime: '08:00',
    closingTime: '23:00',
    allowCancelPaid: false,
    allowCancelInProgress: false,
    cancellationFee: 0,
    workingHoursByDay: days.map((day) => ({ day, openingTime: '08:00', closingTime: '23:00', closed: false })),
    displayHours: {
      weekday: 'Sunday-Thursday: 08:00 - 23:00',
      friday: 'Friday: 08:00 - 23:00',
      saturday: 'Saturday: 08:00 - 23:00',
    },
  };
}

export default function TenantSettingsClient({ restaurantSlug, staffRole }) {
  const writable = canWrite(staffRole);
  const [profile, setProfile] = useState(profileDefaults);
  const [settings, setSettings] = useState(settingsDefaults);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    setSuccessMessage('');
    try {
      const [profileData, settingsData] = await Promise.all([
        apiRequest(`/api/restaurant-admin/profile?restaurantSlug=${encodeURIComponent(restaurantSlug)}`),
        apiRequest(`/api/restaurant-admin/settings?restaurantSlug=${encodeURIComponent(restaurantSlug)}`),
      ]);
      setProfile({ ...profileDefaults(), ...(profileData.profile || {}) });
      setSettings({ ...settingsDefaults(), ...(settingsData.settings || {}) });
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

  function updateProfileField(field, value) {
    setProfile((current) => ({ ...current, [field]: value }));
  }

  function updateSettingsField(field, value) {
    setSettings((current) => ({ ...current, [field]: value }));
  }

  function updateWorkingHour(index, field, value) {
    setSettings((current) => ({
      ...current,
      workingHoursByDay: current.workingHoursByDay.map((entry, entryIndex) =>
        entryIndex === index ? { ...entry, [field]: value } : entry,
      ),
    }));
  }

  async function saveProfile(event) {
    event.preventDefault();
    if (!writable) return;
    setSavingProfile(true);
    setError('');
    setSuccessMessage('');
    try {
      const data = await apiRequest('/api/restaurant-admin/profile', {
        method: 'PUT',
        body: JSON.stringify({
          restaurantSlug,
          restaurantName: profile.restaurantName,
          tagline: profile.tagline,
          cuisineType: profile.cuisineType,
          whatsappNumber: profile.whatsappNumber,
          whatsappLink: profile.whatsappLink,
          address: profile.address,
          googleMapsUrl: profile.googleMapsUrl,
          googleMapsEmbedUrl: profile.googleMapsEmbedUrl,
          instagramUrl: profile.instagramUrl,
          facebookUrl: profile.facebookUrl,
          tiktokUrl: profile.tiktokUrl,
          linktreeUrl: profile.linktreeUrl,
          logoUrl: profile.logoUrl,
          primaryColor: profile.primaryColor,
          secondaryColor: profile.secondaryColor,
          currency: profile.currency,
        }),
      });
      setProfile({ ...profileDefaults(), ...(data.profile || {}) });
      setSuccessMessage('Profile saved.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSavingProfile(false);
    }
  }

  async function saveSettings(event) {
    event.preventDefault();
    if (!writable) return;
    setSavingSettings(true);
    setError('');
    setSuccessMessage('');
    try {
      const data = await apiRequest('/api/restaurant-admin/settings', {
        method: 'PUT',
        body: JSON.stringify({
          restaurantSlug,
          openingTime: settings.openingTime,
          closingTime: settings.closingTime,
          allowCancelPaid: settings.allowCancelPaid,
          allowCancelInProgress: settings.allowCancelInProgress,
          cancellationFee: Number(settings.cancellationFee) || 0,
          workingHoursByDay: settings.workingHoursByDay,
          displayHours: settings.displayHours,
        }),
      });
      setSettings({ ...settingsDefaults(), ...(data.settings || {}) });
      setSuccessMessage('Settings saved.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSavingSettings(false);
    }
  }

  return (
    <div className="space-y-5">
      {error ? <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div> : null}
      {successMessage ? <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{successMessage}</div> : null}
      {loading ? <div className="rounded-md border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-600">Loading tenant profile and settings...</div> : null}
      {!writable ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          SUPPORT access is read-only. OWNER or MANAGER access is required to change profile and settings.
        </div>
      ) : null}

      <section className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <h3 className="text-lg font-semibold">Public profile</h3>
            <p className="mt-1 text-sm text-neutral-600">Branding, contact, map, social, and currency fields for this tenant.</p>
          </div>
          <div className="rounded-md bg-neutral-100 px-3 py-2 text-xs font-semibold text-neutral-700">
            Feature modules read-only: {(profile.enabledFeatures || []).length} enabled
          </div>
        </div>
        <form onSubmit={saveProfile} className="mt-4 grid gap-3 md:grid-cols-2">
          <input className={inputClass} required disabled={!writable} placeholder="Restaurant name" value={profile.restaurantName} onChange={(event) => updateProfileField('restaurantName', event.target.value)} />
          <input className={inputClass} required disabled={!writable} placeholder="Cuisine type" value={profile.cuisineType} onChange={(event) => updateProfileField('cuisineType', event.target.value)} />
          <input className={`${inputClass} md:col-span-2`} required disabled={!writable} placeholder="Tagline" value={profile.tagline} onChange={(event) => updateProfileField('tagline', event.target.value)} />
          <input className={inputClass} required disabled={!writable} placeholder="WhatsApp number" value={profile.whatsappNumber} onChange={(event) => updateProfileField('whatsappNumber', event.target.value)} />
          <input className={inputClass} disabled={!writable} placeholder="WhatsApp link" value={profile.whatsappLink} onChange={(event) => updateProfileField('whatsappLink', event.target.value)} />
          <textarea className={`${inputClass} md:col-span-2`} required disabled={!writable} placeholder="Address" value={profile.address} onChange={(event) => updateProfileField('address', event.target.value)} />
          <input className={inputClass} disabled={!writable} placeholder="Google Maps URL" value={profile.googleMapsUrl} onChange={(event) => updateProfileField('googleMapsUrl', event.target.value)} />
          <input className={inputClass} disabled={!writable} placeholder="Google Maps embed URL" value={profile.googleMapsEmbedUrl} onChange={(event) => updateProfileField('googleMapsEmbedUrl', event.target.value)} />
          <input className={inputClass} disabled={!writable} placeholder="Instagram URL" value={profile.instagramUrl} onChange={(event) => updateProfileField('instagramUrl', event.target.value)} />
          <input className={inputClass} disabled={!writable} placeholder="Facebook URL" value={profile.facebookUrl} onChange={(event) => updateProfileField('facebookUrl', event.target.value)} />
          <input className={inputClass} disabled={!writable} placeholder="TikTok URL" value={profile.tiktokUrl} onChange={(event) => updateProfileField('tiktokUrl', event.target.value)} />
          <input className={inputClass} disabled={!writable} placeholder="Linktree URL" value={profile.linktreeUrl} onChange={(event) => updateProfileField('linktreeUrl', event.target.value)} />
          <input className={inputClass} disabled={!writable} placeholder="Logo/image URL" value={profile.logoUrl} onChange={(event) => updateProfileField('logoUrl', event.target.value)} />
          <input className={inputClass} required disabled={!writable} placeholder="Currency" value={profile.currency} onChange={(event) => updateProfileField('currency', event.target.value)} />
          <input className={inputClass} required disabled={!writable} type="color" value={profile.primaryColor} onChange={(event) => updateProfileField('primaryColor', event.target.value)} />
          <input className={inputClass} required disabled={!writable} type="color" value={profile.secondaryColor} onChange={(event) => updateProfileField('secondaryColor', event.target.value)} />
          <div className="md:col-span-2">
            <button disabled={!writable || savingProfile} className="rounded-md bg-[#10241f] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
              {savingProfile ? 'Saving profile...' : 'Save profile'}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
        <h3 className="text-lg font-semibold">Display settings</h3>
        <p className="mt-1 text-sm text-neutral-600">
          Hours and cancellation display controls. Ordering activation and feature modules are not editable in this tenant staff area.
        </p>
        <form onSubmit={saveSettings} className="mt-4 grid gap-4">
          <div className="grid gap-3 md:grid-cols-3">
            <input className={inputClass} required disabled={!writable} placeholder="Opening time" value={settings.openingTime} onChange={(event) => updateSettingsField('openingTime', event.target.value)} />
            <input className={inputClass} required disabled={!writable} placeholder="Closing time" value={settings.closingTime} onChange={(event) => updateSettingsField('closingTime', event.target.value)} />
            <input className={inputClass} disabled={!writable} type="number" min="0" step="0.01" placeholder="Cancellation fee" value={settings.cancellationFee} onChange={(event) => updateSettingsField('cancellationFee', event.target.value)} />
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            <label className="flex items-center gap-2 text-sm text-neutral-700">
              <input type="checkbox" disabled={!writable} checked={Boolean(settings.allowCancelPaid)} onChange={(event) => updateSettingsField('allowCancelPaid', event.target.checked)} />
              Allow cancellation for paid orders
            </label>
            <label className="flex items-center gap-2 text-sm text-neutral-700">
              <input type="checkbox" disabled={!writable} checked={Boolean(settings.allowCancelInProgress)} onChange={(event) => updateSettingsField('allowCancelInProgress', event.target.checked)} />
              Allow cancellation for in-progress orders
            </label>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <input className={inputClass} disabled={!writable} placeholder="Weekday display hours" value={settings.displayHours?.weekday || ''} onChange={(event) => updateSettingsField('displayHours', { ...settings.displayHours, weekday: event.target.value })} />
            <input className={inputClass} disabled={!writable} placeholder="Friday display hours" value={settings.displayHours?.friday || ''} onChange={(event) => updateSettingsField('displayHours', { ...settings.displayHours, friday: event.target.value })} />
            <input className={inputClass} disabled={!writable} placeholder="Saturday display hours" value={settings.displayHours?.saturday || ''} onChange={(event) => updateSettingsField('displayHours', { ...settings.displayHours, saturday: event.target.value })} />
          </div>
          <div className="grid gap-2">
            <p className="text-sm font-semibold text-neutral-800">Working hours by day</p>
            {(settings.workingHoursByDay || []).map((entry, index) => (
              <div key={entry.day} className="grid gap-2 rounded-md border border-neutral-100 p-3 md:grid-cols-[1fr_1fr_1fr_auto] md:items-center">
                <p className="text-sm font-semibold capitalize text-neutral-700">{entry.day}</p>
                <input className={inputClass} disabled={!writable || entry.closed} value={entry.openingTime} onChange={(event) => updateWorkingHour(index, 'openingTime', event.target.value)} />
                <input className={inputClass} disabled={!writable || entry.closed} value={entry.closingTime} onChange={(event) => updateWorkingHour(index, 'closingTime', event.target.value)} />
                <label className="flex items-center gap-2 text-sm text-neutral-700">
                  <input type="checkbox" disabled={!writable} checked={Boolean(entry.closed)} onChange={(event) => updateWorkingHour(index, 'closed', event.target.checked)} />
                  Closed
                </label>
              </div>
            ))}
          </div>
          <div>
            <button disabled={!writable || savingSettings} className="rounded-md bg-[#10241f] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
              {savingSettings ? 'Saving settings...' : 'Save settings'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
