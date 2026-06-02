export const metadata = { title: 'Platform Settings | Platform Admin' };

export default function PlatformSettingsPlaceholderPage() {
  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Coming later</p>
      <h1 className="mt-2 text-2xl font-semibold text-neutral-950">Platform Settings</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-600">
        Platform-level configuration will live here later. Restaurant operations settings remain under the demo
        restaurant admin at /admin/settings.
      </p>
    </section>
  );
}
