import crypto from 'node:crypto';

function cleanOptionalString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function generateTableSlug(label) {
  const slug = String(label || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);

  return slug || 'table';
}

export function generateQrToken() {
  return crypto.randomBytes(18).toString('base64url');
}

export function buildTableOrderUrl(table, baseUrl = '') {
  const path = `/public/table/${encodeURIComponent(table.slug)}`;
  const tokenQuery = table.qrToken ? `?token=${encodeURIComponent(table.qrToken)}` : '';
  const cleanBaseUrl = typeof baseUrl === 'string' ? baseUrl.replace(/\/+$/, '') : '';
  return cleanBaseUrl ? `${cleanBaseUrl}${path}${tokenQuery}` : `${path}${tokenQuery}`;
}

export function normalizeTable(table = {}, baseUrl = '') {
  const normalized = {
    id: table.id,
    label: table.label || '',
    slug: table.slug || '',
    qrToken: table.qrToken || '',
    seats: Number.isInteger(table.seats) ? table.seats : null,
    zone: cleanOptionalString(table.zone),
    isActive: table.isActive !== false,
    notes: cleanOptionalString(table.notes),
    createdAt: table.createdAt instanceof Date ? table.createdAt.toISOString() : table.createdAt,
    updatedAt: table.updatedAt instanceof Date ? table.updatedAt.toISOString() : table.updatedAt,
  };

  return {
    ...normalized,
    orderUrl: normalized.slug ? buildTableOrderUrl(normalized, baseUrl) : '',
  };
}
