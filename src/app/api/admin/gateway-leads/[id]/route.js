export const dynamic = "force-dynamic";

import { z } from 'zod';
import { failure, handleApiError, success } from '../../../../../lib/api-response';
import { requireAdmin } from '../../../../../lib/auth';
import { GATEWAY_LEAD_STATUSES, normalizeGatewayLead } from '../../../../../lib/gateway-leads';
import { prisma } from '../../../../../lib/prisma';

const updateSchema = z.object({
  status: z.enum(GATEWAY_LEAD_STATUSES),
});

export async function PUT(request, { params }) {
  try {
    await requireAdmin(request, ['ADMIN', 'MANAGER']);

    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return failure('Invalid gateway lead update', 400, { details: parsed.error.flatten() });
    }

    const existing = await prisma.gatewayLead.findUnique({ where: { id: params.id } });
    if (!existing) return failure('Gateway lead not found', 404);

    const lead = await prisma.gatewayLead.update({
      where: { id: params.id },
      data: { status: parsed.data.status },
    });

    return success({ lead: normalizeGatewayLead(lead) });
  } catch (error) {
    return handleApiError(error);
  }
}
