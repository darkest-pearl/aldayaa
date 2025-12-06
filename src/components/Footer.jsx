import Link from 'next/link';
import { strings } from '../lib/strings';

export default function Footer() {
  return (
    <footer className="mt-14 border-t border-neutral-200/70 bg-[#f3eadb] text-secondary">
      <div className="site-container py-10 space-y-8">
        <div className="grid gap-5 md:grid-cols-3">
          <div className="rounded-2xl border border-neutral-200/70 bg-white/80 p-5 shadow-soft">
            <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">Visit</p>
            <h3 className="mt-2 text-lg font-semibold">Find us</h3>
            <p className="mt-2 text-sm text-neutral-700 leading-relaxed">{strings.address}</p>
            <Link
              href={strings.googleMaps}
              className="mt-3 inline-flex w-fit items-center gap-2 text-sm font-semibold text-primary transition hover:text-secondary"
              target="_blank"
            >
              View on Google Maps →
            </Link>
          </div>

          <div className="rounded-2xl border border-neutral-200/70 bg-white/80 p-5 shadow-soft">
            <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">Connect</p>
            <h3 className="mt-2 text-lg font-semibold">Stay in touch</h3>
            <a
              className="mt-3 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-secondary shadow-soft transition duration-200 ease-gentle hover:-translate-y-0.5 hover:shadow-lifted"
              href={strings.whatsappLink}
              target="_blank"
            >
              WhatsApp {strings.whatsapp}
            </a>
            <Link
              href={strings.linktree}
              className="mt-3 block text-sm font-semibold text-primary transition hover:text-secondary"
              target="_blank"
            >
              Linktree & Menu
            </Link>
          </div>
          <div className="rounded-2xl border border-neutral-200/70 bg-white/80 p-5 shadow-soft">
            <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">Hours</p>
            <h3 className="mt-2 text-lg font-semibold">When we’re open</h3>
            <p className="mt-2 text-sm text-neutral-700">{strings.hours.weekday}</p>
            <p className="text-sm text-neutral-700">{strings.hours.friday}</p>
            <div className="mt-4 flex items-center gap-2 text-sm text-neutral-700">
              <span className="font-semibold text-secondary">Instagram:</span>
              <Link
                href={strings.linktree}
                target="_blank"
                className="text-primary transition hover:text-secondary"
              >
                @aldaya
              </Link>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center justify-between gap-3 border-t border-neutral-200/70 pt-4 text-xs text-neutral-600 md:flex-row">
          <p>© {new Date().getFullYear()} {strings.restaurantName}</p>
          <p className="text-neutral-500">Modern Levantine comfort in Sharjah</p>
        </div>
      </div>
    </footer>
  );
}