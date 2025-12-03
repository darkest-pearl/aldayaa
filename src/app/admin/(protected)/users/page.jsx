
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import AdminUsersClient from './users-client';
import { getAdminFromRequest } from '../../../../lib/auth';

export const metadata = { title: 'Admin Users' };

export default async function AdminUsersPage() {
  const admin = await getAdminFromRequest(cookies());
  if (!admin || admin.role !== 'ADMIN') {
    redirect('/admin/dashboard');
  }

  return <AdminUsersClient />;
}