import "./globals.css";
import { getRestaurantProfile } from '../lib/restaurant-profile';

/**
 * Application-wide metadata for the Next.js app.
 * @returns {Promise<{ title: string; description: string }>} Metadata with profile fallbacks.
 */
export async function generateMetadata() {
  const profile = await getRestaurantProfile();
  return {
    title: profile.restaurantName,
    description: profile.tagline,
  };
}

/**
 * Root layout wrapper that applies shared document structure and styling.
 * @param {{ children: React.ReactNode }} props - Layout children to render.
 * @returns {JSX.Element} HTML document scaffold for all pages.
 */
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-beige text-textdark font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
