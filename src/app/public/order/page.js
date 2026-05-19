export const dynamic = "force-dynamic";
import Section from '../../../components/Section';
import OrderClient from '../../../components/OrderClient';
import { FEATURE_KEYS, isFeatureEnabled } from '../../../lib/features';
import { prisma } from '../../../lib/prisma';
import { getRestaurantProfile, toPublicRestaurantProfile } from '../../../lib/restaurant-profile';
import { normalizeTable } from '../../../lib/tables';

export const metadata = {
  title: 'Order Online | Al Dayaa Al Shamiah'
};

async function getMenu() {
  return prisma.menuCategory.findMany({
    orderBy: { sortOrder: 'asc' },
    include: { items: true },
  });
}

async function getActiveTable(slug) {
  if (!process.env.DATABASE_URL || !slug) return null;

  try {
    return prisma.restaurantTable.findFirst({
      where: { slug, isActive: true },
    });
  } catch (error) {
    console.error('Failed to load restaurant table for order page', error);
    return null;
  }
}

export default async function OrderPage({ searchParams = {} }) {
  const tableSlug = typeof searchParams.table === 'string' ? searchParams.table : '';
  const [menu, profileRecord] = await Promise.all([
    getMenu(),
    getRestaurantProfile(),
  ]);
  const profile = toPublicRestaurantProfile(profileRecord);
  const tableOrderingEnabled = isFeatureEnabled(profile.enabledFeatures, FEATURE_KEYS.TABLE_QR_ORDERING);
  const tableRecord = tableOrderingEnabled && tableSlug ? await getActiveTable(tableSlug) : null;
  const table = tableRecord ? normalizeTable(tableRecord) : null;
  const categories = JSON.parse(JSON.stringify(menu));

  return (
    <Section className="space-y-6">
      <div className="text-center space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">Seamless ordering</p>
        <h1 className="text-2xl md:text-3xl font-semibold mb-1 text-secondary">Order for Delivery or Pickup</h1>
        <p className="text-sm md:text-base text-neutral-600">
          Add your favorites to the cart and we will confirm via WhatsApp.
        </p>
      </div>

      {table && (
        <div className="mx-auto max-w-2xl rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3 text-center text-sm font-semibold text-secondary shadow-soft">
          Ordering for {table.label}
          {table.zone ? <span className="font-medium text-neutral-700"> - {table.zone}</span> : null}
        </div>
      )}

      <OrderClient categories={categories} />
    </Section>
  );
}
