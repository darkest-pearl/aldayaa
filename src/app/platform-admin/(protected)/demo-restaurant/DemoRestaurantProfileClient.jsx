'use client';

import Link from 'next/link';
import { useState } from 'react';
import AdminCard from '../../../admin/components/AdminCard.jsx';
import AdminPageHeader from '../../../admin/components/AdminPageHeader.jsx';

function ProfileField({ label, value }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="mt-1 break-words text-sm font-semibold text-neutral-900">{value || 'Not set'}</div>
    </div>
  );
}

export default function DemoRestaurantProfileClient({ initialProfile, initialRestaurant }) {
  const [profile, setProfile] = useState(initialProfile);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const enabledFeatures = profile?.enabledFeatures || [];

  const resetProfile = async () => {
    const confirmed = window.confirm(
      'This reset will replace current demo profile settings with neutral demo defaults. Restaurant feature flags are preserved.',
    );
    if (!confirmed) return;

    setSubmitting(true);
    setStatus(null);
    setError(null);

    try {
      const res = await fetch('/api/platform/demo-profile/reset', { method: 'POST' });
      const payload = await res.json();
      if (!payload?.success) {
        throw new Error(payload?.error || 'Unable to reset demo profile.');
      }
      setProfile(payload.data.profile);
      setStatus('Demo profile reset to neutral defaults.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Demo Restaurant"
        description="Inspect the current demo restaurant profile and reset branding/contact values when the public demo needs a neutral baseline."
        actions={
          <>
            <Link
              href="/public"
              className="rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 hover:border-emerald-700 hover:text-emerald-800"
            >
              View demo restaurant
            </Link>
            <Link
              href="/admin/settings"
              className="rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 hover:border-emerald-700 hover:text-emerald-800"
            >
              Open restaurant admin settings
            </Link>
          </>
        }
      />

      {status && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{status}</div>}
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <AdminCard
          title="Current demo profile"
          description="These values come from the singleton RestaurantProfile record used by the demo restaurant website."
        >
          <div className="grid gap-3 md:grid-cols-2">
            <ProfileField label="Tenant anchor" value={initialRestaurant?.name} />
            <ProfileField label="Tenant slug" value={initialRestaurant?.slug} />
            <ProfileField label="Restaurant name" value={profile?.restaurantName} />
            <ProfileField label="Tagline" value={profile?.tagline} />
            <ProfileField label="Cuisine" value={profile?.cuisineType} />
            <ProfileField label="Phone / WhatsApp" value={profile?.whatsappNumber} />
            <ProfileField label="WhatsApp link" value={profile?.whatsappLink} />
            <ProfileField label="Address" value={profile?.address} />
            <ProfileField label="Instagram" value={profile?.instagramUrl} />
            <ProfileField label="Website links" value={profile?.linktreeUrl} />
            <ProfileField label="Enabled modules" value={`${enabledFeatures.length} enabled`} />
          </div>
        </AdminCard>

        <AdminCard
          title="Reset controls"
          description="Use this only when the demo profile should return to neutral platform-owned defaults."
        >
          <div className="space-y-4">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
              This reset will replace current demo profile settings with neutral demo defaults for branding, contact,
              address, social links, colors, and currency. Restaurant feature flags are preserved.
            </div>
            <button
              type="button"
              className="w-full rounded-lg bg-[#10241f] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#1b3b33] disabled:opacity-60"
              disabled={submitting}
              onClick={resetProfile}
            >
              {submitting ? 'Resetting demo profile...' : 'Reset demo profile to neutral defaults'}
            </button>
          </div>
        </AdminCard>
      </div>
    </div>
  );
}
