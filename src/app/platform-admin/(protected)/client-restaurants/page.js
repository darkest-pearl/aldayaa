import Link from 'next/link';
import { prisma } from '../../../../lib/prisma';
import {
  DEMO_RESTAURANT_SLUG,
  normalizeRestaurant,
} from '../../../../lib/restaurants';
import { createClientRestaurant } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Client Restaurants | Platform Admin' };

async function getClientRestaurants() {
  if (!process.env.DATABASE_URL) {
    return [];
  }

  try {
    const restaurants = await prisma.restaurant.findMany({
      orderBy: [
        { createdAt: 'asc' },
        { name: 'asc' },
      ],
    });

    return restaurants.map(normalizeRestaurant);
  } catch (error) {
    console.error('Failed to load client restaurant registry', error);
    return [];
  }
}

function formatDate(value) {
  if (!value) return 'Unknown';

  return new Intl.DateTimeFormat('en-AE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function StatusPill({ children }) {
  return (
    <span className="inline-flex w-fit rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
      {children}
    </span>
  );
}

function TenantActionLinks({ restaurant }) {
  if (restaurant.slug !== DEMO_RESTAURANT_SLUG) {
    return (
      <div className="max-w-xs rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
        Tenant public route is not active for non-demo restaurants yet.
      </div>
    );
  }

  const tenantHref = `/r/${restaurant.slug}`;

  return (
    <div className="flex flex-wrap gap-2">
      <Link
        href={`/r/${restaurant.slug}`}
        className="rounded-md border border-neutral-200 px-3 py-2 text-xs font-semibold text-neutral-800 transition hover:border-emerald-800 hover:text-emerald-800"
      >
        Public site
      </Link>
      <Link
        href={`/r/${restaurant.slug}/menu`}
        className="rounded-md border border-neutral-200 px-3 py-2 text-xs font-semibold text-neutral-800 transition hover:border-emerald-800 hover:text-emerald-800"
      >
        Menu
      </Link>
      <Link
        href={`/r/${restaurant.slug}/order`}
        className="rounded-md border border-neutral-200 px-3 py-2 text-xs font-semibold text-neutral-800 transition hover:border-emerald-800 hover:text-emerald-800"
      >
        Order
      </Link>
      {restaurant.slug === DEMO_RESTAURANT_SLUG ? (
        <Link
          href="/platform-admin/demo-restaurant"
          className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900 transition hover:border-amber-300"
        >
          Demo reset controls
        </Link>
      ) : null}
      <span className="sr-only">{tenantHref}</span>
    </div>
  );
}

function CreateRestaurantForm({ error, created }) {
  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-normal text-emerald-700">Create tenant anchor</p>
        <h2 className="text-xl font-semibold text-neutral-950">Add a client restaurant record</h2>
        <p className="max-w-3xl text-sm leading-6 text-neutral-600">
          This creates only a Restaurant tenant anchor. It does not provision profile settings, menus, admins, billing,
          domains, or customer-facing tenant routes.
        </p>
      </div>

      {error ? (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
          {error}
        </p>
      ) : null}

      {created ? (
        <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          Restaurant tenant anchor created: {created}
        </p>
      ) : null}

      <form action={createClientRestaurant} className="mt-5 grid gap-4 lg:grid-cols-2">
        <label className="grid gap-2 text-sm font-semibold text-neutral-800">
          Name
          <input
            name="name"
            required
            minLength={2}
            placeholder="Example Bistro"
            className="rounded-md border border-neutral-200 px-3 py-2 text-sm font-normal text-neutral-900 outline-none transition focus:border-emerald-700"
          />
        </label>

        <label className="grid gap-2 text-sm font-semibold text-neutral-800">
          Slug
          <input
            name="slug"
            required
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            placeholder="example-bistro"
            className="rounded-md border border-neutral-200 px-3 py-2 font-mono text-sm font-normal text-neutral-900 outline-none transition focus:border-emerald-700"
          />
        </label>

        <label className="grid gap-2 text-sm font-semibold text-neutral-800">
          Status
          <select
            name="status"
            defaultValue="ACTIVE"
            className="rounded-md border border-neutral-200 px-3 py-2 text-sm font-normal text-neutral-900 outline-none transition focus:border-emerald-700"
          >
            <option value="ACTIVE">ACTIVE</option>
            <option value="PAUSED">PAUSED</option>
            <option value="ARCHIVED">ARCHIVED</option>
          </select>
        </label>

        <label className="grid gap-2 text-sm font-semibold text-neutral-800">
          Type
          <input
            name="type"
            defaultValue="CLIENT"
            placeholder="CLIENT"
            className="rounded-md border border-neutral-200 px-3 py-2 text-sm font-normal text-neutral-900 outline-none transition focus:border-emerald-700"
          />
        </label>

        <label className="grid gap-2 text-sm font-semibold text-neutral-800 lg:col-span-2">
          Notes
          <textarea
            name="notes"
            rows={3}
            placeholder="Internal platform note"
            className="rounded-md border border-neutral-200 px-3 py-2 text-sm font-normal text-neutral-900 outline-none transition focus:border-emerald-700"
          />
        </label>

        <div className="lg:col-span-2">
          <button
            type="submit"
            className="rounded-md bg-[#10241f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#18362f]"
          >
            Create restaurant tenant anchor
          </button>
        </div>
      </form>
    </section>
  );
}

function RestaurantCard({ restaurant }) {
  return (
    <article className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold text-neutral-950">{restaurant.name}</h2>
            <StatusPill>{restaurant.status}</StatusPill>
            <StatusPill>{restaurant.type}</StatusPill>
          </div>
          <p className="mt-2 font-mono text-sm text-neutral-600">{restaurant.slug}</p>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-neutral-600">
            {restaurant.notes || 'No platform note has been added for this restaurant yet.'}
          </p>
        </div>
        <TenantActionLinks restaurant={restaurant} />
      </div>

      <dl className="mt-5 grid gap-3 border-t border-neutral-100 pt-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-normal text-neutral-500">Restaurant name</dt>
          <dd className="mt-1 text-neutral-900">{restaurant.name}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-normal text-neutral-500">Slug</dt>
          <dd className="mt-1 font-mono text-neutral-900">{restaurant.slug}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-normal text-neutral-500">Created</dt>
          <dd className="mt-1 text-neutral-900">{formatDate(restaurant.createdAt)}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-normal text-neutral-500">Updated</dt>
          <dd className="mt-1 text-neutral-900">{formatDate(restaurant.updatedAt)}</dd>
        </div>
      </dl>
    </article>
  );
}

function EmptyState() {
  return (
    <section className="rounded-lg border border-dashed border-amber-300 bg-amber-50 p-8 text-center shadow-sm">
      <p className="text-lg font-semibold text-amber-950">Demo Restaurant tenant anchor is missing.</p>
      <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-amber-900">
        The registry is backed by the Restaurant table, but no restaurants were returned.{' '}
        {'Use future provisioning controls later.'} This page is read-only for now and will not create tenants
        automatically.
      </p>
    </section>
  );
}

export default async function ClientRestaurantsRegistryPage({ searchParams = {} }) {
  const restaurants = await getClientRestaurants();
  const error = typeof searchParams.error === 'string' ? searchParams.error : null;
  const created = typeof searchParams.created === 'string' ? searchParams.created : null;

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-emerald-950/10 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-normal text-emerald-700">Platform restaurant registry</p>
        <h1 className="mt-2 text-3xl font-semibold text-neutral-950">Client Restaurants</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-neutral-600">
          This registry shows restaurant tenant anchors from the Restaurant table. The Demo Restaurant tenant anchor is
          expected here first, with links to its tenant-style public routes.
        </p>
        <p className="mt-4 max-w-3xl rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm leading-6 text-neutral-700">
          Create is limited to Restaurant tenant anchor records. Edit/delete/provisioning, custom domains, billing, and
          subscription management remain future platform work.
        </p>
      </section>

      <CreateRestaurantForm error={error} created={created} />

      <section className="space-y-4">
        {restaurants.length ? (
          restaurants.map((restaurant) => <RestaurantCard key={restaurant.id} restaurant={restaurant} />)
        ) : (
          <EmptyState />
        )}
      </section>
    </div>
  );
}
