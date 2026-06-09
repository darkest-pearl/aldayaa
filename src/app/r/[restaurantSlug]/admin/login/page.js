'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function TenantRestaurantAdminLoginPage({ params }) {
  const router = useRouter();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/restaurant-admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantSlug: params.restaurantSlug,
          email: form.email,
          password: form.password,
        }),
      });
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        setError(payload.error || 'Invalid restaurant staff credentials');
        return;
      }

      router.replace(`/r/${params.restaurantSlug}/admin`);
      router.refresh();
    } catch (requestError) {
      setError('Unable to sign in right now');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-[60vh] px-4 py-10">
      <section className="mx-auto max-w-md rounded-lg border border-white/10 bg-white p-6 text-neutral-950 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-normal text-emerald-700">Restaurant staff login</p>
        <h1 className="mt-2 text-2xl font-semibold">Sign in to {params.restaurantSlug}</h1>
        <p className="mt-2 text-sm leading-6 text-neutral-600">
          This is separate from platform admin access.
        </p>

        {error ? (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800">
            {error}
          </p>
        ) : null}

        <form onSubmit={handleSubmit} className="mt-5 grid gap-4">
          <input type="hidden" name="restaurantSlug" value={params.restaurantSlug} />
          <label className="grid gap-2 text-sm font-semibold text-neutral-800">
            Email
            <input
              type="email"
              name="email"
              required
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              className="rounded-md border border-neutral-200 px-3 py-2 text-sm font-normal outline-none transition focus:border-emerald-700"
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-neutral-800">
            Password
            <input
              type="password"
              name="password"
              required
              minLength={10}
              value={form.password}
              onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
              className="rounded-md border border-neutral-200 px-3 py-2 text-sm font-normal outline-none transition focus:border-emerald-700"
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-[#10241f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#18362f] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </section>
    </main>
  );
}
