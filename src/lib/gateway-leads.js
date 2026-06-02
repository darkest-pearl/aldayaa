export const GATEWAY_LEAD_STATUSES = ['NEW', 'CONTACTED', 'QUALIFIED', 'ARCHIVED'];

const STATUS_LABELS = {
  NEW: 'New',
  CONTACTED: 'Contacted',
  QUALIFIED: 'Qualified',
  ARCHIVED: 'Archived',
};

export function isValidGatewayLeadStatus(status) {
  return GATEWAY_LEAD_STATUSES.includes(status);
}

export function getGatewayLeadStatusLabel(status) {
  return STATUS_LABELS[status] || 'Unknown';
}

function parseInterestedModules(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string' && item.trim()) : [];
  } catch {
    return [];
  }
}

export function normalizeGatewayLead(lead) {
  if (!lead) return null;
  const status = isValidGatewayLeadStatus(lead.status) ? lead.status : 'NEW';

  return {
    id: lead.id,
    restaurantName: lead.restaurantName || '',
    contactName: lead.contactName || '',
    phone: lead.phone || '',
    email: lead.email || '',
    interestedModules: parseInterestedModules(lead.interestedModules),
    message: lead.message || '',
    status,
    statusLabel: getGatewayLeadStatusLabel(status),
    createdAt: lead.createdAt instanceof Date ? lead.createdAt.toISOString() : lead.createdAt,
  };
}
