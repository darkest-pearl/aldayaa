export const dynamic = 'force-dynamic';

import Link from 'next/link';
import PublicTablePage from '../../../../public/table/[slug]/page';
import Section from '../../../../../components/Section';
import { FEATURE_KEYS, isFeatureEnabled } from '../../../../../lib/features';
import { prisma } from '../../../../../lib/prisma';
import { normalizeTable } from '../../../../../lib/tables';
import { getTenantRestaurantContext } from '../../tenant-route';

export const metadata = {
  title: 'Table Ordering | Restaurant',
};

async function findActiveTenantTable(context, slug, token) {
  if (!process.env.DATABASE_URL || !slug || !token) return null;

  try {
    return prisma.restaurantTable.findFirst({
      where: { restaurantId: context.restaurant.id, slug, qrToken: token, isActive: true },
    });
  } catch (error) {
    console.error('Failed to load tenant restaurant table', error);
    return null;
  }
}

function UnavailableMessage({ context, title, message }) {
  const href = context ? `/r/${context.restaurant.slug}` : '/';

  return (
    <Section className="max-w-2xl space-y-5 text-center">
      <div className="rounded-2xl border border-neutral-200 bg-white/90 p-6 shadow-soft">
        <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">Table ordering</p>
        <h1 className="mt-2 text-2xl font-semibold text-secondary">{title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-neutral-600">{message}</p>
        <Link
          href={href}
          className="mt-5 inline-flex rounded-full bg-primary px-5 py-3 text-sm font-semibold text-secondary shadow-soft transition hover:-translate-y-0.5 hover:shadow-lifted"
        >
          Back to website
        </Link>
      </div>
    </Section>
  );
}

export default async function TenantTablePage({ params, searchParams = {} }) {
  const context = await getTenantRestaurantContext(params);
  const slug = typeof params?.slug === 'string' ? params.slug : '';
  const token = typeof searchParams.token === 'string' ? searchParams.token : '';

  if (context.isDemoRestaurant) {
    return <PublicTablePage params={{ slug }} searchParams={searchParams} />;
  }

  if (context.restaurant.status === 'ARCHIVED') {
    return (
      <UnavailableMessage
        context={context}
        title="Table ordering is not available"
        message="This restaurant is not currently accepting table orders."
      />
    );
  }

  const onlineOrderingEnabled = isFeatureEnabled(context.profile.enabledFeatures, FEATURE_KEYS.ONLINE_ORDERING);
  const tableOrderingEnabled = isFeatureEnabled(context.profile.enabledFeatures, FEATURE_KEYS.TABLE_QR_ORDERING);

  if (!onlineOrderingEnabled || !tableOrderingEnabled) {
    return (
      <UnavailableMessage
        context={context}
        title="Table ordering is not available"
        message="This restaurant has not enabled QR table ordering yet. Please use the main ordering and contact options."
      />
    );
  }

  const tableRecord = await findActiveTenantTable(context, slug, token);

  if (!tableRecord) {
    return (
      <UnavailableMessage
        context={context}
        title="This table ordering link is unavailable"
        message="Please ask the team for a current table ordering link."
      />
    );
  }

  const table = normalizeTable(tableRecord);
  const orderHref = `/r/${context.restaurant.slug}/order?table=${encodeURIComponent(table.slug)}&tableToken=${encodeURIComponent(token)}`;

  return (
    <Section className="max-w-2xl space-y-6 text-center">
      <div className="rounded-2xl border border-neutral-200 bg-white/95 p-6 shadow-soft">
        <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">QR table ordering</p>
        <h1 className="mt-2 text-3xl font-semibold text-secondary">{table.label}</h1>
        {table.zone && <p className="mt-1 text-sm font-medium text-neutral-600">{table.zone}</p>}
        <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-neutral-600">
          You are ordering for this table. Staff will see your table number when the order is sent.
          This is not a payment or POS checkout yet.
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
