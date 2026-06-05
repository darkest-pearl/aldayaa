import { notFound } from 'next/navigation';
import { DEMO_RESTAURANT_SLUG, getRestaurantBySlug } from '../../../lib/restaurants';

export async function requireDemoTenantRestaurant(params = {}) {
  const restaurantSlug = typeof params?.restaurantSlug === 'string' ? params.restaurantSlug : '';
  const restaurant = await getRestaurantBySlug(restaurantSlug);

  if (!restaurant || restaurant.slug !== DEMO_RESTAURANT_SLUG) {
    notFound();
  }

  return restaurant;
}
