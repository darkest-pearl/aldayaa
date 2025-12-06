import "./globals.css";

/**
 * Application-wide metadata for the Next.js app.
 * @type {{ title: string }}
 */
export const metadata = {
  title: "Al Dayaa Al Shamiah Restaurant",
};

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
