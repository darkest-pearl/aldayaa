export const dynamic = 'force-dynamic';

import PublicTablePage from '../../../../public/table/[slug]/page';
import { requireDemoTenantRestaurant } from '../../tenant-route';

export const metadata = {
  title: 'Table Ordering | Demo Restaurant',
};

export default async function TenantTablePage({ params, searchParams = {} }) {
  await requireDemoTenantRestaurant(params);
  return <PublicTablePage params={{ slug: params?.slug }} searchParams={searchParams} />;
}
