import Link from 'next/link';

const futureModules = ['Orders', 'Reservations', 'Inventory', 'Recipes', 'Advanced staff workflows', 'Billing', 'Domains'];

export default function TenantAdminNav({ restaurantSlug, active = 'overview', staff }) {
  const links = [
    { key: 'overview', label: 'Overview', href: `/r/${restaurantSlug}/admin` },
    { key: 'menu', label: 'Menu', href: `/r/${restaurantSlug}/admin/menu` },
    { key: 'gallery', label: 'Gallery', href: `/r/${restaurantSlug}/admin/gallery` },
    { key: 'settings', label: 'Settings', href: `/r/${restaurantSlug}/admin/settings` },
    { key: 'staff', label: 'Staff', href: `/r/${restaurantSlug}/admin/staff` },
  ];

  return (
    <header className="border-b border-white/10 bg-neutral-950 px-4 py-4 text-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-normal text-emerald-300">Restaurant staff admin</p>
          <h1 className="mt-1 text-2xl font-semibold">{restaurantSlug}</h1>
          {staff ? (
            <p className="mt-1 text-sm text-white/65">
              {staff.email} · {staff.role}
            </p>
          ) : null}
        </div>
        <nav className="flex flex-wrap gap-2">
          {links.map((link) => (
            <Link
              key={link.key}
              href={link.href}
              className={
                active === link.key
                  ? 'rounded-md bg-white px-3 py-2 text-sm font-semibold text-neutral-950'
                  : 'rounded-md border border-white/15 px-3 py-2 text-sm font-semibold text-white/80 transition hover:border-white/30 hover:text-white'
              }
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="mx-auto mt-3 max-w-6xl text-xs text-white/55">
        Future tenant admin modules: {futureModules.join(', ')}.
      </div>
    </header>
  );
}
