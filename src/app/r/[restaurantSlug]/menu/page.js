export const dynamic = 'force-dynamic';

import PublicMenuPage from '../../../public/menu/page';
import { requireDemoTenantRestaurant } from '../tenant-route';

export const metadata = {
  title: 'Menu | Demo Restaurant',
};

export default async function TenantMenuPage({ params }) {
  await requireDemoTenantRestaurant(params);
  return <PublicMenuPage />;
}
