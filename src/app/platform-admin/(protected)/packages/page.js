import PlatformRoadmapPlaceholder from '../../components/PlatformRoadmapPlaceholder.jsx';

export const metadata = { title: 'Packages | Platform Admin' };

export default function PackagesPlaceholderPage() {
  return (
    <PlatformRoadmapPlaceholder
      title="Packages"
      description="This will eventually manage package definitions and module bundles for the public gateway."
      currentState="Current package content is code-managed on the public gateway, including the Starter, Operations, and Advanced / Custom presentation."
      actions={[
        { label: 'View public gateway packages', href: '/#packages' },
        { label: 'View leads', href: '/platform-admin/leads' },
      ]}
      futureScope={[
        'create/edit packages',
        'define module bundles',
        'set pricing display copy',
        'connect to subscription/billing later',
      ]}
      notImplemented="No payments/subscriptions/billing logic exists yet. Package presentation is still lead-capture and planning only."
    />
  );
}
