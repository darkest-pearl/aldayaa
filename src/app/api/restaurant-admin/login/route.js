export const dynamic = 'force-dynamic';

import { z } from 'zod';
import { success, failure } from '../../../../lib/api-response';
import {
  authenticateRestaurantStaff,
  setRestaurantStaffSessionCookie,
} from '../../../../lib/restaurant-staff-auth';

const loginSchema = z.object({
  restaurantSlug: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(10),
});

export async function POST(request) {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return failure('Restaurant, email, and password are required', 400);
    }

    const staff = await authenticateRestaurantStaff(
      parsed.data.restaurantSlug,
      parsed.data.email,
      parsed.data.password,
    );

    if (!staff) {
      return failure('Invalid restaurant staff credentials', 401);
    }

    const response = success({
      staff: {
        id: staff.id,
        restaurantId: staff.restaurantId,
        restaurantSlug: staff.restaurantSlug,
        email: staff.email,
        role: staff.role,
      },
    });
    setRestaurantStaffSessionCookie(response, staff);

    return response;
  } catch (error) {
    return failure('Server error', 500);
  }
}
