export const dynamic = 'force-dynamic';

import { z } from 'zod';
import { failure, handleApiError, success } from '../../../../../lib/api-response';
import { prisma } from '../../../../../lib/prisma';
import {
  getRestaurantSlugFromRequest,
  normalizeOptionalText,
  requireRestaurantStaffAccess,
} from '../../../../../lib/restaurant-staff-access';
import { normalizeSupplier } from '../../../../../lib/suppliers';

const supplierUpdateSchema = z.object({
  restaurantSlug: z.string().trim().min(1),
  name: z.string().trim().min(1).max(160).optional(),
  contactName: z.string().trim().max(120).optional().nullable(),
  phone: z.string().trim().max(80).optional().nullable(),
  email: z.string().trim().email().optional().nullable(),
  whatsapp: z.string().trim().max(80).optional().nullable(),
  address: z.string().trim().max(240).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
  isActive: z.boolean().optional(),
});

function buildSupplierUpdateData(data) {
  const update = {};
  if (data.name !== undefined) update.name = data.name.trim();
  if (data.contactName !== undefined) update.contactName = normalizeOptionalText(data.contactName);
  if (data.phone !== undefined) update.phone = normalizeOptionalText(data.phone);
  if (data.email !== undefined) update.email = normalizeOptionalText(data.email)?.toLowerCase() || null;
  if (data.whatsapp !== undefined) update.whatsapp = normalizeOptionalText(data.whatsapp);
  if (data.address !== undefined) update.address = normalizeOptionalText(data.address);
  if (data.notes !== undefined) update.notes = normalizeOptionalText(data.notes);
  if (data.isActive !== undefined) update.isActive = data.isActive;
  return update;
}

export async function GET(request, { params }) {
  try {
    const restaurantSlug = getRestaurantSlugFromRequest(request);
    const staff = await requireRestaurantStaffAccess(request, restaurantSlug);
    const supplier = await prisma.supplier.findFirst({
      where: { id: params.id, restaurantId: staff.restaurantId },
    });

    if (!supplier) return failure('Supplier not found', 404);

    return success({
      supplier: normalizeSupplier(supplier),
      staffRole: staff.role,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request, { params }) {
  try {
    const body = await request.json();
    const parsed = supplierUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return failure('Invalid supplier payload', 400, { details: parsed.error.flatten() });
    }

    const staff = await requireRestaurantStaffAccess(request, parsed.data.restaurantSlug, { write: true });
    const updated = await prisma.supplier.updateMany({
      where: { id: params.id, restaurantId: staff.restaurantId },
      data: buildSupplierUpdateData(parsed.data),
    });

    if (updated.count !== 1) {
      return failure('Supplier not found', 404);
    }

    const supplier = await prisma.supplier.findFirst({
      where: { id: params.id, restaurantId: staff.restaurantId },
    });

    if (!supplier) return failure('Supplier not found', 404);

    return success({ supplier: normalizeSupplier(supplier) });
  } catch (error) {
    return handleApiError(error);
  }
}
