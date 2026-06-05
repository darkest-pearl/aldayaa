export const dynamic = 'force-dynamic';

import PublicOrderPage from '../../../public/order/page';
import { requireDemoTenantRestaurant } from '../tenant-route';

export const metadata = {
  title: 'Order Online | Demo Restaurant',
};

export default async function TenantOrderPage({ params, searchParams = {} }) {
  await requireDemoTenantRestaurant(params);
  return <PublicOrderPage searchParams={searchParams} />;
}
