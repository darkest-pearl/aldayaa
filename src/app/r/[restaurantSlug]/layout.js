import Header from '../../../components/Header';
import Footer from '../../../components/Footer';
import AnnouncementBanner from '../../../components/AnnouncementBanner';
import { getActiveAnnouncement } from '../../../lib/announcement';
import { getTenantRestaurantContext } from './tenant-route';

export const dynamic = 'force-dynamic';

export default async function TenantPublicLayout({ children, params }) {
  const context = await getTenantRestaurantContext(params);
  const announcement = context.isDemoRestaurant ? await getActiveAnnouncement() : null;
  const announcementData = announcement
    ? {
        id: announcement.id,
        message: announcement.message,
        updatedAt: announcement.updatedAt.toISOString(),
      }
    : null;
  const basePath = `/r/${context.restaurant.slug}`;

  return (
    <div className="min-h-screen flex flex-col bg-beige text-textdark">
      {announcementData ? <AnnouncementBanner announcement={announcementData} /> : null}
      <Header profile={context.profile} basePath={basePath} />
      <main className="flex-1">{children}</main>
      <Footer profile={context.profile} displayHours={context.displayHours} />
    </div>
  );
}
