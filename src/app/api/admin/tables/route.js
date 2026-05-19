export const dynamic = "force-dynamic";
import { z } from 'zod';
import { requireAdmin } from '../../../../lib/auth';
import { handleApiError, success, failure } from '../../../../lib/api-response';
import { prisma } from '../../../../lib/prisma';
import {
  generateQrToken,
  generateTableSlug,
  normalizeTable,
} from '../../../../lib/tables';

const tableSchema = z.object({
  label: z.string().trim().min(1).max(80),
  seats: z.number().int().min(1).max(999).optional().nullable(),
  zone: z.string().trim().max(80).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
  isActive: z.boolean().optional(),
});

function cleanOptionalString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

async function generateUniqueSlug(label) {
  const baseSlug = generateTableSlug(label);
  let slug = baseSlug;
  let suffix = 2;

  while (await prisma.restaurantTable.findUnique({ where: { slug }, select: { id: true } })) {
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  return slug;
}

async function generateUniqueQrToken() {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const qrToken = generateQrToken();
    const existing = await prisma.restaurantTable.findUnique({
      where: { qrToken },
      select: { id: true },
    });
    if (!existing) return qrToken;
  }

  throw new Error('Unable to generate unique table token');
}

function getBaseUrl(request) {
  return process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl?.origin || '';
}

export async function GET(request) {
  try {
    await requireAdmin(request, ['ADMIN', 'MANAGER', 'SUPPORT']);
    const tables = await prisma.restaurantTable.findMany({
      orderBy: [{ isActive: 'desc' }, { zone: 'asc' }, { label: 'asc' }],
    });
    const baseUrl = getBaseUrl(request);
    return success({ tables: tables.map((table) => normalizeTable(table, baseUrl)) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request) {
  try {
    await requireAdmin(request, ['ADMIN', 'MANAGER']);
    const body = await request.json();
    const parsed = tableSchema.safeParse(body);

    if (!parsed.success) {
      return failure('Invalid table payload', 400, { details: parsed.error.flatten() });
    }

    const slug = await generateUniqueSlug(parsed.data.label);
    const qrToken = await generateUniqueQrToken();
    const table = await prisma.restaurantTable.create({
      data: {
        label: parsed.data.label.trim(),
        slug,
        qrToken,
        seats: parsed.data.seats ?? null,
        zone: cleanOptionalString(parsed.data.zone),
        notes: cleanOptionalString(parsed.data.notes),
        isActive: parsed.data.isActive ?? true,
      },
    });

    return success({ table: normalizeTable(table, getBaseUrl(request)) });
  } catch (error) {
    return handleApiError(error);
  }
}
