import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import SettingsClient from './SettingsClient';
import { getAdminFromRequest } from '../../../../lib/auth';
import { getRestaurantSettings } from '../../../../lib/restaurant-settings';
import { getLatestAnnouncement } from '../../../../lib/announcement';

export const metadata = { title: 'Restaurant Settings' };

export default async function AdminSettingsPage() {
  const admin = await getAdminFromRequest(cookies());
  if (!admin || admin.role !== 'ADMIN') {
    redirect('/admin/dashboard');
  }

  const settings = await getRestaurantSettings();
  const announcement = await getLatestAnnouncement();
  const announcementData = announcement
    ? {
        id: announcement.id,
        message: announcement.message,
        isActive: announcement.isActive,
        updatedAt: announcement.updatedAt.toISOString(),
      }
    : null;

  return <SettingsClient initialSettings={settings} initialAnnouncement={announcementData} />;
}