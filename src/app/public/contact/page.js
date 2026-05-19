import Section from "../../../components/Section";
import ContactForm from "../../../components/ContactForm";
import { getRestaurantProfile, toPublicRestaurantProfile } from "../../../lib/restaurant-profile";

export async function generateMetadata() {
  const profile = await getRestaurantProfile();
  return {
    title: `Contact | ${profile.restaurantName}`,
  };
}

export default async function ContactPage() {
  const profile = toPublicRestaurantProfile(await getRestaurantProfile());

  return (
    <Section>
      <ContactForm profile={profile} />
    </Section>
  );
}
