import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import TablesClient from './TablesClient.jsx';
import { getAdminFromRequest } from '../../../../lib/auth';

export const metadata = { title: 'Tables / QR Ordering' };

export default async function AdminTablesPage() {
  const admin = await getAdminFromRequest(cookies());
  if (!admin || !['ADMIN', 'MANAGER', 'SUPPORT'].includes(admin.role)) {
    redirect('/admin/dashboard');
  }

  return <TablesClient />;
}
