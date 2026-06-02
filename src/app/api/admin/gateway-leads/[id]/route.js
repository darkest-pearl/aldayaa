export const dynamic = "force-dynamic";

import { z } from 'zod';
import { failure, handleApiError, success } from '../../../../../lib/api-response';
import { requireAdmin } from '../../../../../lib/auth';
import {
  GATEWAY_LEAD_STATUSES,
  normalizeGatewayLead,
  normalizeGatewayLeadInternalNotes,
} from '../../../../../lib/gateway-leads';
import { prisma } from '../../../../../lib/prisma';

const updateSchema = z.object({
  status: z.enum(GATEWAY_LEAD_STATUSES).optional(),
  internalNotes: z.string().max(2000).nullable().optional(),
  lastContactedAt: z.union([z.string().datetime(), z.literal(''), z.null()]).optional(),
  markContactedNow: z.boolean().optional(),
});

export async function PUT(request, { params }) {
  try {
    await requireAdmin(request, ['ADMIN']);

    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return failure('Invalid gateway lead update', 400, { details: parsed.error.flatten() });
    }

    const existing = await prisma.gatewayLead.findUnique({ where: { id: params.id } });
    if (!existing) return failure('Gateway lead not found', 404);

    const data = {};
    if (parsed.data.status) {
      data.status = parsed.data.status;
    }
    if ('internalNotes' in parsed.data) {
      data.internalNotes = normalizeGatewayLeadInternalNotes(parsed.data.internalNotes);
    }
    if (parsed.data.markContactedNow) {
      data.lastContactedAt = new Date();
    } else if ('lastContactedAt' in parsed.data) {
      data.lastContactedAt = parsed.data.lastContactedAt ? new Date(parsed.data.lastContactedAt) : null;
    }

    if (!Object.keys(data).length) {
      return failure('No gateway lead updates provided', 400);
    }

    const lead = await prisma.gatewayLead.update({
      where: { id: params.id },
      data,
    });

    return success({ lead: normalizeGatewayLead(lead) });
  } catch (error) {
    return handleApiError(error);
  }
}
