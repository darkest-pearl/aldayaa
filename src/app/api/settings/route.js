export const dynamic = "force-dynamic";
import { handleApiError, success } from '../../../lib/api-response';
import { getDisplayHours, getRestaurantSettings } from '../../../lib/restaurant-settings';

export async function GET() {
  try {
    const settings = await getRestaurantSettings();
    const displayHours = getDisplayHours(settings);

    return success({
      settings: {
        displayHours,
        workingHoursByDay: settings.workingHoursByDay,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}