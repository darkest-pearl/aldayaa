export const dynamic = "force-dynamic";

import { failure, handleApiError, success } from '../../../../lib/api-response';
import { requireAdmin } from '../../../../lib/auth';
import {
  GATEWAY_LEAD_FOLLOW_UP_STATES,
  getGatewayLeadFollowUpState,
  isValidGatewayLeadStatus,
  normalizeGatewayLead,
} from '../../../../lib/gateway-leads';
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
    await requireAdmin(request, ['ADMIN']);

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status')?.trim();
    const search = searchParams.get('search')?.trim();
    const followUpState = searchParams.get('followUpState')?.trim();

    if (status && !isValidGatewayLeadStatus(status)) {
      return failure('Invalid gateway lead status', 400);
    }

    if (followUpState && !GATEWAY_LEAD_FOLLOW_UP_STATES.includes(followUpState)) {
      return failure('Invalid gateway lead follow-up state', 400);
    }

    const leads = await prisma.gatewayLead.findMany({
      where: {
        ...(status ? { status } : {}),
        ...buildSearchFilter(search),
      },
      orderBy: { createdAt: 'desc' },
    });

    const normalizedLeads = leads.map(normalizeGatewayLead);
    const filteredLeads = followUpState
      ? normalizedLeads.filter((lead) => getGatewayLeadFollowUpState(lead).key === followUpState)
      : normalizedLeads;

    return success({ leads: filteredLeads });
  } catch (error) {
    return handleApiError(error);
  }
}
