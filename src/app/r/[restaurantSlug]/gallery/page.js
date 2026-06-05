export const dynamic = 'force-dynamic';

import PublicGalleryPage from '../../../public/gallery/page';
import { requireDemoTenantRestaurant } from '../tenant-route';

export const metadata = {
  title: 'Gallery | Demo Restaurant',
};

export default async function TenantGalleryPage({ params }) {
  await requireDemoTenantRestaurant(params);
  return <PublicGalleryPage />;
}
