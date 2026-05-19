export const dynamic = "force-dynamic";

import Link from 'next/link';
import Section from '../../../../components/Section';
import { FEATURE_KEYS, isFeatureEnabled } from '../../../../lib/features';
import { prisma } from '../../../../lib/prisma';
import { getRestaurantProfile, toPublicRestaurantProfile } from '../../../../lib/restaurant-profile';
import { normalizeTable } from '../../../../lib/tables';

export const metadata = {
  title: 'Table Ordering | Al Dayaa Al Shamiah',
};

async function findTable(slug) {
  if (!process.env.DATABASE_URL || !slug) return null;

  try {
    return prisma.restaurantTable.findUnique({ where: { slug } });
  } catch (error) {
    console.error('Failed to load restaurant table', error);
    return null;
  }
}

function UnavailableMessage({ title, message }) {
  return (
    <Section className="max-w-2xl space-y-5 text-center">
      <div className="rounded-2xl border border-neutral-200 bg-white/90 p-6 shadow-soft">
        <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">Table ordering</p>
        <h1 className="mt-2 text-2xl font-semibold text-secondary">{title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-neutral-600">{message}</p>
        <Link
          href="/public"
          className="mt-5 inline-flex rounded-full bg-primary px-5 py-3 text-sm font-semibold text-secondary shadow-soft transition hover:-translate-y-0.5 hover:shadow-lifted"
        >
          Back to website
        </Link>
      </div>
    </Section>
  );
}

export default async function PublicTablePage({ params, searchParams = {} }) {
  const slug = typeof params?.slug === 'string' ? params.slug : '';
  const token = typeof searchParams.token === 'string' ? searchParams.token : '';
  const [profileRecord, tableRecord] = await Promise.all([
    getRestaurantProfile(),
    findTable(slug),
  ]);
  const profile = toPublicRestaurantProfile(profileRecord);
  const tableOrderingEnabled = isFeatureEnabled(
    profile.enabledFeatures,
    FEATURE_KEYS.TABLE_QR_ORDERING,
  );

  if (!tableOrderingEnabled) {
    return (
      <UnavailableMessage
        title="Table ordering is not available"
        message="This restaurant has not enabled QR table ordering yet. Please use the main ordering and contact options."
      />
    );
  }

  if (!tableRecord || !tableRecord.isActive || (tableRecord.qrToken && tableRecord.qrToken !== token)) {
    return (
      <UnavailableMessage
        title="This table ordering link is unavailable"
        message="Please ask the team for a current table ordering link."
      />
    );
  }

  const table = normalizeTable(tableRecord);
  const orderHref = `/public/order?table=${encodeURIComponent(table.slug)}`;

  return (
    <Section className="max-w-2xl space-y-6 text-center">
      <div className="rounded-2xl border border-neutral-200 bg-white/95 p-6 shadow-soft">
        <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">QR table ordering</p>
        <h1 className="mt-2 text-3xl font-semibold text-secondary">{table.label}</h1>
        {table.zone && <p className="mt-1 text-sm font-medium text-neutral-600">{table.zone}</p>}
        <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-neutral-600">
          Browse the menu, add your favorites, and include any table notes before checkout.
        </p>
        <Link
          href={orderHref}
          className="mt-6 inline-flex rounded-full bg-primary px-6 py-3 text-sm font-semibold text-secondary shadow-soft transition hover:-translate-y-0.5 hover:shadow-lifted"
        >
          Start table order
        </Link>
      </div>
    </Section>
  );
}
