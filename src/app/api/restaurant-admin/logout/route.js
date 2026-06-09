export const dynamic = 'force-dynamic';

import { success } from '../../../../lib/api-response';
import { clearRestaurantStaffSessionCookie } from '../../../../lib/restaurant-staff-auth';

export async function POST() {
  const response = success({});
  clearRestaurantStaffSessionCookie(response);
  return response;
}
