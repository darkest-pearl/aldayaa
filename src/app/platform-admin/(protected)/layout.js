import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import PlatformAdminShell from '../components/PlatformAdminShell.jsx';
import { getAdminFromRequest } from '../../../lib/auth';

export default async function ProtectedPlatformAdminLayout({ children }) {
  const admin = await getAdminFromRequest(cookies());

  if (!admin) {
    redirect('/admin/login');
  }

  if (admin.role !== 'ADMIN') {
    redirect('/admin/dashboard');
  }

  return <PlatformAdminShell admin={admin}>{children}</PlatformAdminShell>;
}
