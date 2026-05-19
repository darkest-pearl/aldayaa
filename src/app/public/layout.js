import Header from "../../components/Header";
import Footer from "../../components/Footer";
import AnnouncementBanner from "../../components/AnnouncementBanner";
import { getActiveAnnouncement } from "../../lib/announcement";
import { getRestaurantProfile, toPublicRestaurantProfile } from "../../lib/restaurant-profile";

export const dynamic = "force-dynamic";

export default async function PublicLayout({ children }) {
  const [announcement, profileRecord] = await Promise.all([
    getActiveAnnouncement(),
    getRestaurantProfile(),
  ]);
  const profile = toPublicRestaurantProfile(profileRecord);
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
      <Header profile={profile} />
      <main className="flex-1">{children}</main>
      <Footer profile={profile} />
    </div>
  );
}
