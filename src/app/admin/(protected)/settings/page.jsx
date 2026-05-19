import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import SettingsClient from './SettingsClient';
import { getAdminFromRequest } from '../../../../lib/auth';
import { getRestaurantSettings } from '../../../../lib/restaurant-settings';
import { getLatestAnnouncement } from '../../../../lib/announcement';
import { getRestaurantProfile, toPublicRestaurantProfile } from '../../../../lib/restaurant-profile';

export const metadata = { title: 'Restaurant Settings' };

export default async function AdminSettingsPage() {
  const admin = await getAdminFromRequest(cookies());
  if (!admin || admin.role !== 'ADMIN') {
    redirect('/admin/dashboard');
  }

  const [settings, announcement, profileRecord] = await Promise.all([
    getRestaurantSettings(),
    getLatestAnnouncement(),
    getRestaurantProfile(),
  ]);
  const profile = toPublicRestaurantProfile(profileRecord);
  const announcementData = announcement
    ? {
        id: announcement.id,
        message: announcement.message,
        isActive: announcement.isActive,
        updatedAt: announcement.updatedAt.toISOString(),
      }
    : null;

  return (
    <SettingsClient
      adminRole={admin.role}
      initialSettings={settings}
      initialAnnouncement={announcementData}
      initialProfile={profile}
    />
  );
}
