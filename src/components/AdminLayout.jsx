import Link from 'next/link';

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
        <nav className="flex gap-4 text-sm">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="hover:underline">
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="max-w-6xl mx-auto px-4 py-8">
        {children}
      </div>
    </div>
  );
}