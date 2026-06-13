export const dynamic = 'force-dynamic';

import { z } from 'zod';
import { failure, handleApiError, success } from '../../../../../lib/api-response';
import {
  INVENTORY_STOCK_STATUSES,
  getInventoryStockStatus,
  normalizeInventoryItem,
  normalizeInventoryUnit,
} from '../../../../../lib/inventory';
import { prisma } from '../../../../../lib/prisma';
import {
  getRestaurantSlugFromRequest,
  normalizeOptionalText,
  requireRestaurantStaffAccess,
} from '../../../../../lib/restaurant-staff-access';
import { TENANT_AUDIT_ACTIONS, createTenantAuditLog } from '../../../../../lib/tenant-audit';

const itemSchema = z.object({
  restaurantSlug: z.string().trim().min(1),
  name: z.string().trim().min(1).max(120),
  sku: z.string().trim().max(80).optional().nullable(),
  category: z.string().trim().max(80).optional().nullable(),
  unit: z.string().trim().min(1).max(40),
  currentStock: z.coerce.number().min(0).default(0),
  reorderLevel: z.coerce.number().min(0).optional().nullable(),
  costPerUnit: z.coerce.number().min(0).optional().nullable(),
  isActive: z.boolean().optional(),
  notes: z.string().trim().max(500).optional().nullable(),
});

function cleanOptionalSku(value) {
  return normalizeOptionalText(value);
}

function buildInventoryItemData(data) {
  return {
    name: data.name.trim(),
    sku: cleanOptionalSku(data.sku),
    category: normalizeOptionalText(data.category),
    unit: normalizeInventoryUnit(data.unit),
    currentStock: data.currentStock,
    reorderLevel: data.reorderLevel ?? null,
    costPerUnit: data.costPerUnit ?? null,
    isActive: data.isActive ?? true,
    notes: normalizeOptionalText(data.notes),
  };
}

function matchesLowStockFilter(item, lowStock) {
  if (lowStock !== 'true') return true;
  return getInventoryStockStatus(item) !== INVENTORY_STOCK_STATUSES.OK;
}

function isPrismaUniqueConstraintError(error) {
  return error?.code === 'P2002';
}

export async function GET(request) {
  try {
    const restaurantSlug = getRestaurantSlugFromRequest(request);
    const staff = await requireRestaurantStaffAccess(request, restaurantSlug);
    const { searchParams } = new URL(request.url);
    const search = (searchParams.get('search') || '').trim().toLowerCase();
    const lowStock = searchParams.get('lowStock') || '';
    const categoryFilter = (searchParams.get('category') || '').trim();
    const statusFilter = (searchParams.get('status') || '').trim().toUpperCase();

    const where = { restaurantId: staff.restaurantId };
    if (categoryFilter) where.category = categoryFilter;
    if (statusFilter === 'ACTIVE') where.isActive = true;
    if (statusFilter === 'INACTIVE') where.isActive = false;

    const items = await prisma.inventoryItem.findMany({
      where,
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });

    const filteredItems = items.filter((item) => {
      if (!matchesLowStockFilter(item, lowStock)) return false;
      if (!search) return true;
      return [item.name, item.sku, item.category]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(search);
    });

    return success({
      items: filteredItems.map(normalizeInventoryItem),
      staffRole: staff.role,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const parsed = itemSchema.safeParse(body);
    if (!parsed.success) {
      return failure('Invalid inventory item payload', 400, { details: parsed.error.flatten() });
    }

    const staff = await requireRestaurantStaffAccess(request, parsed.data.restaurantSlug, { write: true });
    const data = buildInventoryItemData(parsed.data);

    if (data.sku) {
      const existingSku = await prisma.inventoryItem.findFirst({
        where: { sku: data.sku, restaurantId: staff.restaurantId },
        select: { id: true },
      });
      if (existingSku) return failure('Inventory SKU is already in use', 409);
    }

    let item;
    try {
      item = await prisma.inventoryItem.create({
        data: {
          ...data,
          restaurantId: staff.restaurantId,
        },
      });
    } catch (error) {
      if (isPrismaUniqueConstraintError(error)) {
        return failure('Inventory SKU is unavailable', 409);
      }
      throw error;
    }

    await createTenantAuditLog({
      staff,
      request,
      action: TENANT_AUDIT_ACTIONS.INVENTORY_ITEM_CREATED,
      entityType: 'INVENTORY_ITEM',
      entityId: item.id,
      summary: `Created inventory item ${item.name}`,
      metadata: {
        name: item.name,
        sku: item.sku,
        unit: item.unit,
        currentStock: item.currentStock,
        reorderLevel: item.reorderLevel,
      },
    });

    return success({ item: normalizeInventoryItem(item) });
  } catch (error) {
    return handleApiError(error);
  }
}
