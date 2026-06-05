export const dynamic = 'force-dynamic';

import PublicHomePage from '../../public/page';
import { requireDemoTenantRestaurant } from './tenant-route';

export default async function TenantHomePage({ params }) {
  await requireDemoTenantRestaurant(params);
  return <PublicHomePage />;
}
