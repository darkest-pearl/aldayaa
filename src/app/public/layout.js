import Header from "../../components/Header";
import Footer from "../../components/Footer";
import AnnouncementBanner from "../../components/AnnouncementBanner";
import { getActiveAnnouncement } from "../../lib/announcement";

export const dynamic = "force-dynamic";

export default async function PublicLayout({ children }) {
  const announcement = await getActiveAnnouncement();
  const announcementData = announcement
    ? {
        id: announcement.id,
        message: announcement.message,
        updatedAt: announcement.updatedAt.toISOString(),
      }
    : null;

  return (
    <div className="min-h-screen flex flex-col bg-beige text-textdark">
      {announcementData ? <AnnouncementBanner announcement={announcementData} /> : null}
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
