import PlatformRoadmapPlaceholder from '../../components/PlatformRoadmapPlaceholder.jsx';

export const metadata = { title: 'Gateway Website | Platform Admin' };

export default function GatewayWebsitePlaceholderPage() {
  return (
    <PlatformRoadmapPlaceholder
      title="Gateway Website"
      description="This will eventually manage public gateway content for the RestaurantOps Gateway site."
      currentState="Current public gateway is code-managed, so changes to hero copy, package copy, FAQ, and CTA text still happen through planned code batches."
      actions={[
        { label: 'View public gateway', href: '/' },
        { label: 'View demo restaurant', href: '/public' },
        { label: 'View gateway leads', href: '/platform-admin/leads' },
      ]}
      futureScope={[
        'edit hero copy',
        'edit package copy',
        'manage FAQ',
        'manage public CTA text',
      ]}
      notImplemented="No CMS/editor has been added yet. This page is a roadmap placeholder only."
    />
  );
}
