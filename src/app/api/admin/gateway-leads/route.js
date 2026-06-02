export const dynamic = "force-dynamic";

import { failure, handleApiError, success } from '../../../../lib/api-response';
import { requireAdmin } from '../../../../lib/auth';
import { normalizeGatewayLead, isValidGatewayLeadStatus } from '../../../../lib/gateway-leads';
import { prisma } from '../../../../lib/prisma';

function buildSearchFilter(search) {
  const query = search?.trim();
  if (!query) return {};

  return {
    OR: [
      { restaurantName: { contains: query, mode: 'insensitive' } },
      { contactName: { contains: query, mode: 'insensitive' } },
      { phone: { contains: query, mode: 'insensitive' } },
      { email: { contains: query, mode: 'insensitive' } },
    ],
  };
}

export async function GET(request) {
  try {
    await requireAdmin(request, ['ADMIN', 'MANAGER']);

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status')?.trim();
    const search = searchParams.get('search')?.trim();

    if (status && !isValidGatewayLeadStatus(status)) {
      return failure('Invalid gateway lead status', 400);
    }

    const leads = await prisma.gatewayLead.findMany({
      where: {
        ...(status ? { status } : {}),
        ...buildSearchFilter(search),
      },
      orderBy: { createdAt: 'desc' },
    });

    return success({ leads: leads.map(normalizeGatewayLead) });
  } catch (error) {
    return handleApiError(error);
  }
}
