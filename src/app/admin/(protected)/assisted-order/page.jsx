import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import AssistedOrderClient from './AssistedOrderClient.jsx';
import { getAdminFromRequest } from '../../../../lib/auth';

export const metadata = { title: 'Assisted order' };

export default async function AdminAssistedOrderPage() {
  const admin = await getAdminFromRequest(cookies());
  if (!admin || !['ADMIN', 'MANAGER'].includes(admin.role)) {
    redirect('/admin/dashboard');
  }

  return <AssistedOrderClient />;
}
