export const dynamic = 'force-dynamic';

import { handleApiError, success } from '../../../../../lib/api-response';
import { getTenantOperationsReport, resolveTenantReportPeriod } from '../../../../../lib/tenant-reports';
import {
  getRestaurantSlugFromRequest,
  requireRestaurantStaffAccess,
} from '../../../../../lib/restaurant-staff-access';

export async function GET(request) {
  try {
    const restaurantSlug = getRestaurantSlugFromRequest(request);
    const staff = await requireRestaurantStaffAccess(request, restaurantSlug);
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || undefined;
    const from = searchParams.get('from') || undefined;
    const to = searchParams.get('to') || undefined;

    resolveTenantReportPeriod({ period, from, to });

    const report = await getTenantOperationsReport({
      restaurantId: staff.restaurantId,
      period,
      from,
      to,
    });

    return success({
      report,
      staffRole: staff.role,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
