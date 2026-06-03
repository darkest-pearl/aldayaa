import PlatformRoadmapPlaceholder from '../../components/PlatformRoadmapPlaceholder.jsx';

export const metadata = { title: 'Client Restaurants | Platform Admin' };

export default function ClientRestaurantsPlaceholderPage() {
  return (
    <PlatformRoadmapPlaceholder
      title="Client Restaurants"
      description="This will eventually manage client restaurant accounts for the platform owner."
      currentState="The current app still has one demo restaurant, not multi-tenant clients. Demo restaurant operations remain under the restaurant admin area."
      actions={[
        { label: 'View demo restaurant', href: '/public' },
        { label: 'Open restaurant admin', href: '/admin' },
        { label: 'Reset demo profile', href: '/platform-admin/demo-restaurant' },
      ]}
      futureScope={[
        'create client restaurant records',
        'assign domains/subdomains',
        'assign package/modules',
        'create first restaurant admin',
        'provision demo/live restaurant instance',
      ]}
      notImplemented="No multi-tenancy/provisioning exists yet. This page does not create clients, domains, admins, or restaurant instances."
    />
  );
}
