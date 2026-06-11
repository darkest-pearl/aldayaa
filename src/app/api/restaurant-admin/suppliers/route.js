export const dynamic = 'force-dynamic';

import { z } from 'zod';
import { failure, handleApiError, success } from '../../../../lib/api-response';
import { prisma } from '../../../../lib/prisma';
import {
  getRestaurantSlugFromRequest,
  normalizeOptionalText,
  requireRestaurantStaffAccess,
} from '../../../../lib/restaurant-staff-access';
import { normalizeSuppliers } from '../../../../lib/suppliers';

const supplierSchema = z.object({
  restaurantSlug: z.string().trim().min(1),
  name: z.string().trim().min(1).max(160),
  contactName: z.string().trim().max(120).optional().nullable(),
  phone: z.string().trim().max(80).optional().nullable(),
  email: z.string().trim().email().optional().nullable(),
  whatsapp: z.string().trim().max(80).optional().nullable(),
  address: z.string().trim().max(240).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
  isActive: z.boolean().optional(),
});

function buildSupplierData(data) {
  return {
    name: data.name.trim(),
    contactName: normalizeOptionalText(data.contactName),
    phone: normalizeOptionalText(data.phone),
    email: normalizeOptionalText(data.email)?.toLowerCase() || null,
    whatsapp: normalizeOptionalText(data.whatsapp),
    address: normalizeOptionalText(data.address),
    notes: normalizeOptionalText(data.notes),
    isActive: data.isActive ?? true,
  };
}

export async function GET(request) {
  try {
    const restaurantSlug = getRestaurantSlugFromRequest(request);
    const staff = await requireRestaurantStaffAccess(request, restaurantSlug);
    const { searchParams } = new URL(request.url);
    const status = (searchParams.get('status') || '').trim().toUpperCase();
    const search = (searchParams.get('search') || '').trim().toLowerCase();

    const where = { restaurantId: staff.restaurantId };
    if (status === 'ACTIVE') where.isActive = true;
    if (status === 'INACTIVE') where.isActive = false;

    const suppliers = await prisma.supplier.findMany({
      where,
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
    const filteredSuppliers = search
      ? suppliers.filter((supplier) =>
          [supplier.name, supplier.contactName, supplier.phone, supplier.email, supplier.whatsapp]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(search)
        )
      : suppliers;

    return success({
      suppliers: normalizeSuppliers(filteredSuppliers),
      staffRole: staff.role,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const parsed = supplierSchema.safeParse(body);
    if (!parsed.success) {
      return failure('Invalid supplier payload', 400, { details: parsed.error.flatten() });
    }

    const staff = await requireRestaurantStaffAccess(request, parsed.data.restaurantSlug, { write: true });
    const supplier = await prisma.supplier.create({
      data: {
        ...buildSupplierData(parsed.data),
        restaurantId: staff.restaurantId,
      },
    });

    return success({ supplier: normalizeSuppliers([supplier])[0] });
  } catch (error) {
    return handleApiError(error);
  }
}
