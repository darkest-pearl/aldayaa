export const metadata = {
  title: 'Reservations | Demo Restaurant',
};

import Section from "../../../components/Section";
import ReservationForm from "../../../components/ReservationForm";

export default function ReservationsPage() {
  return (
    <Section>
      <ReservationForm />
    </Section>
  );
}
