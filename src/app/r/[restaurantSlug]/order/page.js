export const dynamic = 'force-dynamic';

import PublicOrderPage from '../../../public/order/page';
import Section from '../../../../components/Section';
import OrderClient from '../../../../components/OrderClient';
import { FEATURE_KEYS, isFeatureEnabled } from '../../../../lib/features';
import { prisma } from '../../../../lib/prisma';
import { normalizeTable } from '../../../../lib/tables';
import {
  getTenantContentWhere,
  getTenantRelationWhere,
  getTenantRestaurantContext,
} from '../tenant-route';

export const metadata = {
  title: 'Order Online | Restaurant',
};

async function getTenantMenu(context) {
  return prisma.menuCategory.findMany({
    where: getTenantContentWhere(context),
    orderBy: { sortOrder: 'asc' },
    include: {
      items: {
        where: getTenantRelationWhere(context, { isAvailable: true }),
      },
    },
  });
}

function getTenantMenuItemCount(categories) {
  return categories.reduce((total, category) => total + category.items.length, 0);
}

async function getActiveTenantTable(context, slug, token) {
  if (!slug || !token) return null;

  return prisma.restaurantTable.findFirst({
    where: { restaurantId: context.restaurant.id, slug, qrToken: token, isActive: true },
  });
}

export default async function TenantOrderPage({ params, searchParams = {} }) {
  const context = await getTenantRestaurantContext(params);

  if (context.isDemoRestaurant) {
    return <PublicOrderPage searchParams={searchParams} />;
  }

  const tableSlug = typeof searchParams.table === 'string' ? searchParams.table : '';
  const tableToken = typeof searchParams.tableToken === 'string' ? searchParams.tableToken : '';
  const hasTableContextRequest = Boolean(tableSlug || tableToken);
  const categories = JSON.parse(JSON.stringify(await getTenantMenu(context)));
  const menuItemCount = getTenantMenuItemCount(categories);
  const onlineOrderingEnabled = isFeatureEnabled(context.profile.enabledFeatures, FEATURE_KEYS.ONLINE_ORDERING);
  const tableOrderingEnabled = isFeatureEnabled(context.profile.enabledFeatures, FEATURE_KEYS.TABLE_QR_ORDERING);
  const tableRecord = hasTableContextRequest && onlineOrderingEnabled && tableOrderingEnabled
    ? await getActiveTenantTable(context, tableSlug, tableToken)
    : null;
  const normalizedTable = tableRecord ? normalizeTable(tableRecord) : null;
  const table = normalizedTable
    ? {
        label: normalizedTable.label,
        slug: normalizedTable.slug,
        zone: normalizedTable.zone,
        tableToken,
      }
    : null;
  const tableLinkUnavailable = hasTableContextRequest && !table;
  const orderingUnavailable =
    context.restaurant.status === 'ARCHIVED' ||
    !onlineOrderingEnabled ||
    tableLinkUnavailable ||
    menuItemCount === 0;

  return (
    <Section className="space-y-6">
      <div className="text-center space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">
          {context.profile.restaurantName}
        </p>
        <h1 className="text-2xl md:text-3xl font-semibold mb-1 text-secondary">Order Online</h1>
        <p className="text-sm md:text-base text-neutral-600">
          {orderingUnavailable
            ? 'Online ordering is not available yet for this restaurant.'
            : 'Add your favorites to the cart and send your order directly to this restaurant.'}
        </p>
      </div>

      {orderingUnavailable ? (
        <div className="mx-auto max-w-2xl rounded-2xl border border-dashed border-amber-300 bg-amber-50 p-8 text-center">
          <p className="text-lg font-semibold text-amber-950">ordering is not available yet</p>
          <p className="mt-2 text-sm leading-6 text-amber-900">
            {tableLinkUnavailable
              ? 'Table ordering link is unavailable for this restaurant.'
              : menuItemCount > 0
                ? 'Online ordering must be enabled for this tenant before checkout can accept orders.'
                : 'Menu content has not been added yet, so checkout is disabled for this tenant.'}
          </p>
        </div>
      ) : (
        <OrderClient
          categories={categories}
          table={table}
          restaurantSlug={context.restaurant.slug}
          enableReadyNotification={false}
          showOrderSupportActions={true}
        />
      )}
    </Section>
  );
}
