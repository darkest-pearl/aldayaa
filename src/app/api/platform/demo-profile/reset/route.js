export const dynamic = "force-dynamic";

import { handleApiError, success } from '../../../../../lib/api-response';
import { requireAdmin } from '../../../../../lib/auth';
import { prisma } from '../../../../../lib/prisma';
import {
  defaultRestaurantProfile,
  getNeutralDemoRestaurantProfile,
  getRestaurantProfile,
  setRestaurantProfileCache,
  toPrismaRestaurantProfileData,
} from '../../../../../lib/restaurant-profile';

export async function POST(request) {
  try {
    await requireAdmin(request, ['ADMIN']);

    const existingProfile = await getRestaurantProfile({ fallbackOnError: false });
    const neutralProfile = getNeutralDemoRestaurantProfile({
      enabledFeatures: existingProfile.enabledFeatures,
    });

    const profile = await prisma.restaurantProfile.upsert({
      where: { id: defaultRestaurantProfile.id },
      create: toPrismaRestaurantProfileData({
        ...neutralProfile,
        enabledFeatures: existingProfile.enabledFeatures,
      }),
      update: toPrismaRestaurantProfileData({
        ...neutralProfile,
        enabledFeatures: existingProfile.enabledFeatures,
      }),
    });

    return success({ profile: setRestaurantProfileCache(profile) });
  } catch (error) {
    return handleApiError(error);
  }
}
