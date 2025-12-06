"use client";
import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { AnimatePresence, motion } from 'framer-motion';
import { strings } from '../lib/strings';
import { gentleEase } from '../lib/easings';

const navLinks = [
  { href: '/public', label: 'Home' },
  { href: '/public/menu', label: 'Menu' },
  { href: '/public/reservations', label: 'Reservations' },
  { href: '/public/order', label: 'Order Online' },
  { href: '/public/gallery', label: 'Gallery' },
  { href: '/public/about', label: 'About' },
  { href: '/public/contact', label: 'Contact' },
];

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleMenu = () => setIsMenuOpen((prev) => !prev);
  const closeMenu = () => setIsMenuOpen(false);

  return (
    <header className="sticky top-0 z-50 border-b border-neutral-200/70 bg-beige/85 backdrop-blur-xl shadow-soft">
      <div className="site-container py-3">
        <div className="flex items-center justify-between gap-4">
          <Link href="/public" className="flex items-center gap-3 rounded-2xl px-2 py-1 transition hover:bg-white/60">
            <Image
              src="/images/logo-al-dayaa.png"
              alt={strings.restaurantName}
              width={48}
              height={48}
              className="rounded-full border border-white/60 shadow-sm"
            />
            <div className="leading-tight">
              <p className="text-base md:text-lg font-semibold text-secondary">{strings.restaurantName}</p>
              <p className="text-xs md:text-sm text-neutral-700">{strings.tagline}</p>
            </div>
          </Link>
          
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-neutral-700">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="transition hover:text-secondary"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/public/reservations"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-secondary shadow-soft transition duration-200 ease-gentle hover:-translate-y-0.5 hover:shadow-lifted"
            >
              Reserve
            </Link>
          </nav>

          <button
            type="button"
            onClick={toggleMenu}
            className="md:hidden inline-flex h-11 w-11 items-center justify-center rounded-full border border-neutral-200 bg-white/80 text-secondary shadow-soft transition duration-200 ease-gentle hover:-translate-y-0.5 hover:shadow-lifted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            aria-label="Toggle navigation menu"
            aria-expanded={isMenuOpen}
          >
            <span className="sr-only">Menu</span>
            <span className="relative block h-5 w-6">
              <motion.span
                animate={isMenuOpen ? { rotate: 45, y: 6 } : { rotate: 0, y: 0 }}
                transition={{ duration: 0.2, ease: 'easeInOut' }}
                className="absolute left-0 top-0 h-0.5 w-full rounded-full bg-secondary"
              />
              <motion.span
                animate={isMenuOpen ? { opacity: 0 } : { opacity: 1 }}
                transition={{ duration: 0.15 }}
                className="absolute left-0 top-2 h-0.5 w-full rounded-full bg-secondary"
              />
              <motion.span
                animate={isMenuOpen ? { rotate: -45, y: -6 } : { rotate: 0, y: 0 }}
                transition={{ duration: 0.2, ease: 'easeInOut' }}
                className="absolute left-0 bottom-0 h-0.5 w-full rounded-full bg-secondary"
              />
            </span>
          </button>
        </div>
      </div>

        <AnimatePresence>
        {isMenuOpen && (
          <>
            <motion.button
              type="button"
              aria-label="Close menu"
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
              onClick={closeMenu}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: 'linear' }}
            />

            <motion.nav
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25, ease: gentleEase }}
              className="fixed inset-x-3 top-2 z-50 overflow-hidden rounded-b-3xl border border-neutral-200/80 bg-beige/95 shadow-lifted backdrop-blur-xl"
            >
              <div className="site-container py-4">
                <div className="flex items-center justify-between pb-2">
                  <div className="leading-tight">
                    <p className="text-sm font-semibold text-secondary">{strings.restaurantName}</p>
                    <p className="text-xs text-neutral-600">{strings.tagline}</p>
                  </div>
                  <button
                    type="button"
                    onClick={closeMenu}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 bg-white/80 text-secondary shadow-soft transition hover:-translate-y-0.5 hover:shadow-md"
                    aria-label="Close menu"
                  >
                    ×
                  </button>
                </div>
                <div className="flex flex-col divide-y divide-neutral-200/70 text-sm font-medium text-secondary/80">
                  {navLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={closeMenu}
                      className="flex items-center justify-between py-3 transition hover:text-secondary"
                    >
                      <span>{link.label}</span>
                      <span className="text-xs text-neutral-500">→</span>
                    </Link>
                  ))}
                </div>
                <div className="pt-4">
                  <Link
                    href="/public/reservations"
                    onClick={closeMenu}
                    className="flex items-center justify-center rounded-full bg-primary px-5 py-3 text-sm font-semibold text-secondary shadow-soft transition duration-200 ease-gentle hover:-translate-y-0.5 hover:shadow-lifted"
                  >
                    Reserve a table
                  </Link>
                </div>
              </div>
            </motion.nav>
          </>
        )}
      </AnimatePresence>
    </header>
  );
}