'use client';
import { useState } from 'react';
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
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleMenu = () => setIsMenuOpen((prev) => !prev);
  const closeMenu = () => setIsMenuOpen(false);

  return (
    <header className="sticky top-0 z-50 bg-beige/90 backdrop-blur shadow-sm">
      <div className="max-w-6xl mx-auto px-4 py-3 relative">
        <div className="flex items-center justify-between">
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
          <button
            type="button"
            onClick={toggleMenu}
            className="md:hidden inline-flex items-center justify-center p-2 rounded-md text-textdark hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-beige"
            aria-label="Toggle navigation menu"
            aria-expanded={isMenuOpen}
          >
            <span className="sr-only">Menu</span>
            <span
              className={`block h-0.5 w-6 rounded-sm bg-current transition-transform duration-300 ${
                isMenuOpen ? 'translate-y-1.5 rotate-45' : ''
              }`}
            />
            <span
              className={`mt-1 block h-0.5 w-6 rounded-sm bg-current transition-opacity duration-300 ${
                isMenuOpen ? 'opacity-0' : 'opacity-100'
              }`}
            />
            <span
              className={`mt-1 block h-0.5 w-6 rounded-sm bg-current transition-transform duration-300 ${
                isMenuOpen ? '-translate-y-1.5 -rotate-45' : ''
              }`}
            />
          </button>
        </div>

        <div
          className={`md:hidden absolute inset-x-0 top-full origin-top transform transition-all duration-300 ease-out ${
            isMenuOpen ? 'pointer-events-auto translate-y-0 opacity-100' : 'pointer-events-none -translate-y-2 opacity-0'
          }`}
        >
          <div className="rounded-xl bg-white shadow-lg ring-1 ring-black/5 divide-y divide-beige/60 overflow-hidden">
            <div className="flex flex-col space-y-1 px-4 py-3 text-sm">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={closeMenu}
                  className="block rounded-md px-2 py-2 hover:bg-beige/70 hover:text-primary transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </div>
            <div className="px-4 py-3 bg-beige/60">
              <Link
                href="/public/reservations"
                onClick={closeMenu}
                className="block text-center bg-primary text-white px-4 py-2 rounded-full shadow hover:scale-105 transition-transform"
              >
                Reserve
              </Link>
            </div>
          </div>
        </div>
      </div>
      {isMenuOpen && (
        <button
          type="button"
          aria-label="Close menu"
          onClick={closeMenu}
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur"
        />
      )}
    </header>
  );
}