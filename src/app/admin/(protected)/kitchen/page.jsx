import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import KitchenQueueClient from './KitchenQueueClient.jsx';
import ModuleUnavailable from '../../components/ModuleUnavailable.jsx';
import { getAdminFromRequest } from '../../../../lib/auth';
import { FEATURE_KEYS } from '../../../../lib/features';
import { getFeatureRouteAccess } from '../../../../lib/module-access';
import { getRestaurantProfile } from '../../../../lib/restaurant-profile';

export const metadata = { title: 'Kitchen queue' };

export default async function AdminKitchenPage() {
  const admin = await getAdminFromRequest(cookies());
  if (!admin || !['ADMIN', 'MANAGER'].includes(admin.role)) {
    redirect('/admin/dashboard');
  }

  const profile = await getRestaurantProfile();
  const access = getFeatureRouteAccess(profile, FEATURE_KEYS.KITCHEN_QUEUE);

  if (!access.enabled) {
    return (
      <ModuleUnavailable
        moduleName={access.moduleName}
        message={access.message}
        description={access.description}
        showSettingsLink={admin.role === 'ADMIN'}
      />
    );
  }

  return <KitchenQueueClient />;
}
