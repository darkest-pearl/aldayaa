import Link from 'next/link';
import { headers } from 'next/headers';
import { strings } from '../lib/strings';

async function fetchSettingsHours() {
  const fallbackHours = {
    weekday: strings.hours.weekday,
    friday: strings.hours.friday,
    saturday: strings.hours.saturday || strings.hours.weekday,
  };

  try {
    const host = headers().get('host') || 'localhost:3000';
    const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${protocol}://${host}`;
    const response = await fetch(`${baseUrl}/api/settings`, {
      next: { revalidate: 300 },
    });

    if (!response.ok) return fallbackHours;
    const payload = await response.json();
    const displayHours = payload?.data?.settings?.displayHours;
    if (!displayHours) return fallbackHours;

    return {
      weekday: displayHours.weekday || fallbackHours.weekday,
      friday: displayHours.friday || fallbackHours.friday,
      saturday: displayHours.saturday || fallbackHours.saturday,
    };
  } catch (error) {
    return fallbackHours;
  }
}

export default async function Footer() {
  const hours = await fetchSettingsHours();

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
              rel="noopener noreferrer"
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
              rel="noopener noreferrer"
            >
              WhatsApp {strings.whatsapp}
            </a>
            <div className="mt-4 flex items-center gap-3 text-sm font-semibold text-neutral-800">
              <Link
                href="https://www.instagram.com/aldayaa.rest/?hl=en"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full bg-white/70 px-3 py-2 text-primary shadow-soft transition hover:text-secondary hover:shadow-lifted"
              >
                Instagram
              </Link>
              <Link
                href="https://www.facebook.com/aldayaaalshamiah/"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full bg-white/70 px-3 py-2 text-primary shadow-soft transition hover:text-secondary hover:shadow-lifted"
              >
                Facebook
              </Link>
              <Link
                href="https://www.tiktok.com/@aldayaa_alshamiah"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full bg-white/70 px-3 py-2 text-primary shadow-soft transition hover:text-secondary hover:shadow-lifted"
              >
                TikTok
              </Link>
            </div>
          </div>
          <div className="rounded-2xl border border-neutral-200/70 bg-white/80 p-5 shadow-soft">
            <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">Hours</p>
            <h3 className="mt-2 text-lg font-semibold">When we’re open</h3>
            <p className="mt-2 text-sm text-neutral-700">{hours.weekday}</p>
            <p className="text-sm text-neutral-700">{hours.friday}</p>
            {hours.saturday && hours.saturday !== hours.weekday && (
              <p className="text-sm text-neutral-700">{hours.saturday}</p>
            )}
            <div className="mt-4 flex items-center gap-2 text-sm text-neutral-700">
              <span className="font-semibold text-secondary">Instagram:</span>
              <Link
                href="https://www.instagram.com/aldayaa.rest/?hl=en"
                target="_blank"
                rel="noopener noreferrer"
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