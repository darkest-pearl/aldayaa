import Link from 'next/link';
import Image from 'next/image';
import { strings } from '../lib/strings';

const navLinks = [
  { href: '/public', label: 'Home' },
  { href: '/public/menu', label: 'Menu' },
  { href: '/public/reservations', label: 'Reservations' },
  { href: '/public/order', label: 'Order Online' },
  { href: '/public/gallery', label: 'Gallery' },
  { href: '/public/about', label: 'About' },
  { href: '/public/contact', label: 'Contact' }
];

export default function Header() {
  return (
    <header className="sticky top-0 z-50 bg-beige/90 backdrop-blur shadow-sm">
      <div className="max-w-6xl mx-auto flex items-center justify-between px-4 py-3">
        <Link href="/public" className="flex items-center gap-3">
          <Image src="/images/logo-al-dayaa.png" alt={strings.restaurantName} width={48} height={48} className="rounded-full" />
          <div>
            <p className="font-semibold text-lg leading-tight">{strings.restaurantName}</p>
            <p className="text-sm text-textdark/70">{strings.tagline}</p>
          </div>
        </Link>
        <nav className="hidden md:flex items-center gap-6 text-sm">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-primary transition-colors">
              {link.label}
            </Link>
          ))}
          <Link href="/public/reservations" className="bg-primary text-white px-4 py-2 rounded-full shadow hover:scale-105 transition-transform">
            Reserve
          </Link>
        </nav>
      </div>
    </header>
  );
}