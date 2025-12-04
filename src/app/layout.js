import "./globals.css";

export const metadata = {
  title: "Al Dayaa Al Shamiah Restaurant",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-beige text-textdark font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
