import { getRestaurantProfile } from '../../../../lib/restaurant-profile';
import { getCurrentDemoRestaurant } from '../../../../lib/restaurants';
import DemoRestaurantProfileClient from './DemoRestaurantProfileClient.jsx';

export const metadata = { title: 'Demo Restaurant | Platform Admin' };

export default async function PlatformDemoRestaurantPage() {
  const [profile, demoRestaurant] = await Promise.all([
    getRestaurantProfile({ fallbackOnError: false }),
    getCurrentDemoRestaurant(),
  ]);
  const initialProfile = JSON.parse(JSON.stringify(profile));
  const initialRestaurant = JSON.parse(JSON.stringify(demoRestaurant));

  return <DemoRestaurantProfileClient initialProfile={initialProfile} initialRestaurant={initialRestaurant} />;
}
