import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import KitchenQueueClient from './KitchenQueueClient.jsx';
import { getAdminFromRequest } from '../../../../lib/auth';

export const metadata = { title: 'Kitchen queue' };

export default async function AdminKitchenPage() {
  const admin = await getAdminFromRequest(cookies());
  if (!admin || !['ADMIN', 'MANAGER'].includes(admin.role)) {
    redirect('/admin/dashboard');
  }

  return <KitchenQueueClient />;
}
