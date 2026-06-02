'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import ConfirmDialog from '../../admin/components/ConfirmDialog.jsx';

const platformNavLinks = [
  { href: '/platform-admin', label: 'Platform Dashboard' },
  { href: '/platform-admin/leads', label: 'Gateway Leads' },
  { href: '/platform-admin/gateway-website', label: 'Gateway Website' },
  { href: '/platform-admin/packages', label: 'Packages' },
  { href: '/platform-admin/client-restaurants', label: 'Client Restaurants' },
  { href: '/platform-admin/settings', label: 'Platform Settings' },
];

export default function PlatformAdminShell({ admin, children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    const res = await fetch('/api/admin/logout', { method: 'POST' });
    if (res.ok) {
      router.replace('/admin/login');
    }
  };

  const isActive = (href) => {
    if (href === '/platform-admin') return pathname === href;
    return pathname.startsWith(href);
  };

  return (
    <div className="min-h-screen bg-[#eef2f0] text-neutral-950">
      <header className="sticky top-0 z-30 border-b border-emerald-950/10 bg-[#10241f]/95 text-white backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              className="rounded-md border border-white/20 p-2 md:hidden"
              onClick={() => setMobileOpen((value) => !value)}
              aria-label="Toggle platform navigation"
              type="button"
            >
              <span className="block h-0.5 w-5 bg-white" />
              <span className="mt-1 block h-0.5 w-5 bg-white" />
              <span className="mt-1 block h-0.5 w-4 bg-white" />
            </button>
            <Link href="/platform-admin" className="leading-tight">
              <span className="block text-lg font-semibold">Platform Admin</span>
              <span className="block text-xs text-white/60">RestaurantOps Gateway</span>
            </Link>
          </div>

          <nav className="hidden items-center gap-4 text-sm font-medium md:flex">
            {platformNavLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-md px-2.5 py-1.5 transition ${
                  isActive(link.href) ? 'bg-white text-[#10241f]' : 'text-white/75 hover:bg-white/10 hover:text-white'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            <div className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs">
              <span className="font-semibold uppercase">{admin?.role}</span>
              <span className="ml-2 text-white/70">{admin?.email}</span>
            </div>
            <ConfirmDialog
              confirmLabel="Logout"
              title="Sign out of the platform admin?"
              onConfirm={handleLogout}
              trigger={<button className="text-sm font-semibold text-red-200 hover:text-red-100">Logout</button>}
            />
          </div>
        </div>

        {mobileOpen && (
          <div className="border-t border-white/10 bg-[#10241f] px-4 py-3 md:hidden">
            <div className="flex flex-col gap-2 text-sm">
              {platformNavLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-md px-3 py-2 font-medium ${
                    isActive(link.href) ? 'bg-white text-[#10241f]' : 'text-white/75 hover:bg-white/10 hover:text-white'
                  }`}
                  onClick={() => setMobileOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              <div className="mt-2 rounded-md bg-white/10 px-3 py-2 text-xs text-white/75">
                <div>{admin?.email}</div>
                <div className="mt-1 font-semibold uppercase text-white">{admin?.role}</div>
              </div>
              <ConfirmDialog
                confirmLabel="Logout"
                title="Sign out of the platform admin?"
                onConfirm={handleLogout}
                trigger={<button className="text-left text-sm font-semibold text-red-200">Logout</button>}
              />
            </div>
          </div>
        )}
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:py-10">{children}</main>
    </div>
  );
}
