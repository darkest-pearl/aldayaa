import Link from 'next/link';
import AdminCard from './AdminCard.jsx';

export default function ModuleUnavailable({
  moduleName = 'Module',
  message,
  description,
  showSettingsLink = false,
}) {
  const title = message || `${moduleName} is not enabled`;

  return (
    <AdminCard
      title={title}
      description={description || 'This admin module is disabled in restaurant settings.'}
      actions={
        showSettingsLink ? (
          <Link
            href="/admin/settings"
            className="rounded-lg bg-secondary px-3 py-2 text-sm font-semibold text-white transition hover:bg-secondary/90"
          >
            Open Settings
          </Link>
        ) : null
      }
    >
      <p className="text-sm text-neutral-600">
        {showSettingsLink
          ? 'Enable this module in Settings when the restaurant is ready to use it.'
          : 'Ask an ADMIN to enable this module in Settings when it is ready to use.'}
      </p>
    </AdminCard>
  );
}
