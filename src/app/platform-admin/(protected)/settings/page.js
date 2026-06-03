import PlatformRoadmapPlaceholder from '../../components/PlatformRoadmapPlaceholder.jsx';

export const metadata = { title: 'Platform Settings | Platform Admin' };

export default function PlatformSettingsPlaceholderPage() {
  return (
    <PlatformRoadmapPlaceholder
      title="Platform Settings"
      description="This will eventually control platform-wide settings for the RestaurantOps Gateway business."
      currentState="Current settings remain code-managed or restaurant-specific. Demo restaurant profile settings are still managed from the demo controls and restaurant admin settings."
      actions={[
        { label: 'Open demo profile reset', href: '/platform-admin/demo-restaurant' },
        { label: 'Open restaurant admin settings', href: '/admin/settings' },
      ]}
      futureScope={[
        'platform brand name',
        'gateway contact email/phone',
        'package display defaults',
        'notification preferences later',
      ]}
      notImplemented="No email/WhatsApp sending or notification automation exists yet. This page is a placeholder for future platform preferences."
    />
  );
}
