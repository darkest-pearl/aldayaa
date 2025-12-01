import Header from "../../components/Header";
import Footer from "../../components/Footer";

export default function PublicLayout({ children }) {
  return (
    <div className="min-h-screen flex flex-col bg-beige text-textdark">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
