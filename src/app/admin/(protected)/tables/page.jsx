import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import TablesClient from './TablesClient.jsx';
import { getAdminFromRequest } from '../../../../lib/auth';
import { FEATURE_KEYS } from '../../../../lib/features';
import { getFeatureRouteAccess } from '../../../../lib/module-access';
import { getRestaurantProfile } from '../../../../lib/restaurant-profile';

export const metadata = { title: 'Tables / QR Ordering' };

export default async function AdminTablesPage() {
  const admin = await getAdminFromRequest(cookies());
  if (!admin || !['ADMIN', 'MANAGER', 'SUPPORT'].includes(admin.role)) {
    redirect('/admin/dashboard');
  }

  const profile = await getRestaurantProfile();
  const access = getFeatureRouteAccess(profile, FEATURE_KEYS.TABLE_QR_ORDERING);

  return (
    <TablesClient
      tableQrOrderingEnabled={access.enabled}
      tableQrOrderingMessage={access.message}
      canEnableModules={admin.role === 'ADMIN'}
    />
  );
}
