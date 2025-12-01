"use client";
import Link from 'next/link';
import AdminLogoutButton from './AdminLogoutButton';

const links = [
  { href: '/admin/dashboard', label: 'Dashboard' },
  { href: '/admin/menu', label: 'Menu' },
  { href: '/admin/gallery', label: 'Gallery' },
  { href: '/admin/reservations', label: 'Reservations' },
  { href: '/admin/orders', label: 'Orders' }
];

export default function AdminLayout({ children }) {
  return (
    <div className="min-h-screen bg-beige">
      <div className="bg-primary text-white px-6 py-4 flex justify-between items-center">
        <div className="font-semibold">Al Dayaa Admin</div>
        <div className="flex items-center gap-6 text-sm">
          <nav className="flex gap-4 text-sm">
            {links.map((link) => (
              <Link key={link.href} href={link.href} className="hover:underline">
                {link.label}
              </Link>
            ))}
          </nav>
          <AdminLogoutButton />
        </div>
      </div>
      <div className="max-w-6xl mx-auto px-4 py-8">
        {children}
      </div>
    </div>
  );
}