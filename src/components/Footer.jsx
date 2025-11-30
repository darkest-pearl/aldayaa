import Link from 'next/link';
import { strings } from '../lib/strings';

export default function Footer() {
  return (
    <footer className="bg-white mt-12 border-t border-primary/10">
      <div className="max-w-6xl mx-auto px-4 py-8 grid md:grid-cols-3 gap-6 text-sm">
        <div>
          <h3 className="font-semibold mb-2">Visit Us</h3>
          <p>{strings.address}</p>
          <Link href={strings.googleMaps} className="text-primary font-semibold" target="_blank">View on Google Maps</Link>
        </div>
        <div>
          <h3 className="font-semibold mb-2">Contact</h3>
          <a className="block" href={strings.whatsappLink} target="_blank">WhatsApp: {strings.whatsapp}</a>
          <Link href={strings.linktree} className="text-primary font-semibold" target="_blank">Linktree & Menu</Link>
        </div>
        <div>
          <h3 className="font-semibold mb-2">Hours</h3>
          <p>{strings.hours.weekday}</p>
          <p>{strings.hours.friday}</p>
          <div className="mt-3 flex gap-2 items-center">
            <span>Instagram:</span>
            <Link href={strings.linktree} target="_blank" className="text-primary">@aldaya</Link>
          </div>
        </div>
      </div>
      <div className="text-center text-xs pb-4 text-textdark/70">© {new Date().getFullYear()} {strings.restaurantName}</div>
    </footer>
  );
}