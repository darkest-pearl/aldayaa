import { getRestaurantProfile } from '../../../../lib/restaurant-profile';
import DemoRestaurantProfileClient from './DemoRestaurantProfileClient.jsx';

export const metadata = { title: 'Demo Restaurant | Platform Admin' };

export default async function PlatformDemoRestaurantPage() {
  const profile = await getRestaurantProfile({ fallbackOnError: false });
  const initialProfile = JSON.parse(JSON.stringify(profile));

  return <DemoRestaurantProfileClient initialProfile={initialProfile} />;
}
