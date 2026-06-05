import Link from 'next/link';
import { prisma } from '../../../../lib/prisma';
import {
  DEMO_RESTAURANT_SLUG,
  normalizeRestaurant,
} from '../../../../lib/restaurants';

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

export default async function ClientRestaurantsRegistryPage() {
  const restaurants = await getClientRestaurants();

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
          No create/edit/delete/provisioning yet. Client onboarding, custom domains, billing, and subscription
          management remain future platform work.
        </p>
      </section>

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
