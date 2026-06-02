import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getAdminFromRequest } from '../../../../lib/auth';
import GatewayLeadsClient from './GatewayLeadsClient';

export const metadata = { title: 'Gateway Leads' };

export default async function GatewayLeadsPage() {
  const admin = await getAdminFromRequest(cookies());
  if (!admin || (admin.role !== 'ADMIN' && admin.role !== 'MANAGER')) {
    redirect('/admin/dashboard');
  }

  return <GatewayLeadsClient />;
}
