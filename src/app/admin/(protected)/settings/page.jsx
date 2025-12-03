import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import SettingsClient from './SettingsClient';
import { getAdminFromRequest } from '../../../../lib/auth';
import { getRestaurantSettings } from '../../../../lib/restaurant-settings';

export const metadata = { title: 'Restaurant Settings' };

export default async function AdminSettingsPage() {
  const admin = await getAdminFromRequest(cookies());
  if (!admin || admin.role !== 'ADMIN') {
    redirect('/admin/dashboard');
  }

  const settings = await getRestaurantSettings();

  return <SettingsClient initialSettings={settings} />;
}