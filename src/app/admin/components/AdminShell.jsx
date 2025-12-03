'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createContext, useContext, useState } from 'react';
import ConfirmDialog from './ConfirmDialog.jsx';

export const AdminContext = createContext(null);
export const useAdmin = () => useContext(AdminContext);

const navLinks = [
  { href: '/admin/dashboard', label: 'Dashboard' },
  { href: '/admin/menu', label: 'Menu' },
  { href: '/admin/gallery', label: 'Gallery' },
  { href: '/admin/reservations', label: 'Reservations' },
  { href: '/admin/orders', label: 'Orders' },
  { href: '/admin/users', label: 'Admins' },
];

export default function AdminShell({ admin, children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    const res = await fetch('/api/admin/logout', { method: 'POST' });
    if (res.ok) {
      router.replace('/admin/login');
    }
  };

  const canNavigate = (link) => {
    if (!admin) return false;
    if (admin.role === 'SUPPORT' && link.href !== '/admin/dashboard') return false;
    if (admin.role === 'MANAGER' && link.href === '/admin/users') return false;
    return true;
  };

  const navigation = navLinks.filter(canNavigate);

  return (
    <AdminContext.Provider value={admin}>
      <div className="min-h-screen bg-neutral-50 text-neutral-900">
        <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white/90 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <button
                className="rounded-lg border border-neutral-200 p-2 sm:hidden"
                onClick={() => setMobileOpen((v) => !v)}
                aria-label="Toggle navigation"
              >
                <span className="block h-0.5 w-5 bg-neutral-900" />
                <span className="mt-1 block h-0.5 w-5 bg-neutral-900" />
                <span className="mt-1 block h-0.5 w-4 bg-neutral-900" />
              </button>
              <Link href="/admin/dashboard" className="text-lg font-semibold">
                Al Dayaa Admin
              </Link>
            </div>
            <div className="hidden items-center gap-6 text-sm sm:flex">
              {navigation.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-md px-2 py-1 font-medium transition hover:text-primary ${pathname.startsWith(link.href) ? 'text-primary' : 'text-neutral-700'}`}
                >
                  {link.label}
                </Link>
              ))}
              <div className="flex items-center gap-3 rounded-full bg-neutral-100 px-3 py-1">
                <div className="text-xs uppercase tracking-wide text-neutral-500">{admin?.role}</div>
                <div className="text-sm font-semibold text-neutral-800">{admin?.email}</div>
              </div>
              <ConfirmDialog
                confirmLabel="Logout"
                title="Sign out of the admin panel?"
                onConfirm={handleLogout}
                trigger={
                  <button className="text-sm font-medium text-red-600 hover:underline">Logout</button>
                }
              />
            </div>
          </div>
          {mobileOpen && (
            <div className="border-t border-neutral-200 bg-white px-4 py-3 sm:hidden">
              <div className="flex flex-col gap-2 text-sm">
                {navigation.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`rounded-md px-2 py-2 font-medium transition hover:bg-neutral-50 ${pathname.startsWith(link.href) ? 'text-primary' : 'text-neutral-700'}`}
                    onClick={() => setMobileOpen(false)}
                  >
                    {link.label}
                  </Link>
                ))}
                <div className="mt-2 flex items-center justify-between rounded-lg bg-neutral-50 px-3 py-2 text-xs text-neutral-700">
                  <span>{admin?.email}</span>
                  <span className="rounded bg-neutral-200 px-2 py-0.5 font-semibold uppercase tracking-wide text-neutral-600">{admin?.role}</span>
                </div>
                <ConfirmDialog
                  confirmLabel="Logout"
                  title="Sign out of the admin panel?"
                  onConfirm={handleLogout}
                  trigger={
                    <button className="text-sm font-semibold text-red-600">Logout</button>
                  }
                />
              </div>
            </div>
          )}
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6 sm:py-10">{children}</main>
      </div>
    </AdminContext.Provider>
  );
}