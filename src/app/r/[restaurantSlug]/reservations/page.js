export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import Section from '../../../../components/Section';
import ReservationForm from '../../../../components/ReservationForm';
import { getTenantRestaurantContext } from '../tenant-route';

export const metadata = {
  title: 'Reservations | Restaurant',
};

export default async function TenantReservationsPage({ params }) {
  const context = await getTenantRestaurantContext(params);

  if (context.restaurant.status === 'ARCHIVED') {
    notFound();
  }

  return (
    <Section>
      <ReservationForm
        restaurantSlug={context.restaurant.slug}
        restaurantName={context.profile.restaurantName}
        whatsappNumber={context.profile.whatsappNumber}
        whatsappLink={context.profile.whatsappLink}
        showCancellation={true}
      />
    </Section>
  );
}
