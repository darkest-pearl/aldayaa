import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import AdminShell from '../components/AdminShell';
import { getAdminFromRequest } from '../../../lib/auth';

export default async function ProtectedAdminLayout({ children }) {
  const admin = await getAdminFromRequest(cookies());

  if (!admin) {
    redirect('/admin/login');
  }

  return <AdminShell admin={admin}>{children}</AdminShell>;
}