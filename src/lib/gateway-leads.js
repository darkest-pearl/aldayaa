export const GATEWAY_LEAD_STATUSES = ['NEW', 'CONTACTED', 'QUALIFIED', 'ARCHIVED'];
export const GATEWAY_LEAD_FOLLOW_UP_STATES = ['NEW', 'CONTACTED', 'NEEDS_FOLLOW_UP', 'ARCHIVED'];

const STATUS_LABELS = {
  NEW: 'New',
  CONTACTED: 'Contacted',
  QUALIFIED: 'Qualified',
  ARCHIVED: 'Archived',
};

const FOLLOW_UP_LABELS = {
  NEW: 'New lead',
  CONTACTED: 'Contacted',
  NEEDS_FOLLOW_UP: 'Needs follow-up',
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

function normalizeDate(value) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value;
}

export function normalizeGatewayLeadInternalNotes(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function getGatewayLeadFollowUpState(lead) {
  if (lead?.status === 'ARCHIVED') return { key: 'ARCHIVED', label: FOLLOW_UP_LABELS.ARCHIVED };
  if (lead?.status === 'NEW') return { key: 'NEW', label: FOLLOW_UP_LABELS.NEW };
  if (lead?.lastContactedAt) return { key: 'CONTACTED', label: FOLLOW_UP_LABELS.CONTACTED };
  return { key: 'NEEDS_FOLLOW_UP', label: FOLLOW_UP_LABELS.NEEDS_FOLLOW_UP };
}

export function normalizeGatewayLead(lead) {
  if (!lead) return null;
  const status = isValidGatewayLeadStatus(lead.status) ? lead.status : 'NEW';
  const normalized = {
    id: lead.id,
    restaurantName: lead.restaurantName || '',
    contactName: lead.contactName || '',
    phone: lead.phone || '',
    email: lead.email || '',
    interestedModules: parseInterestedModules(lead.interestedModules),
    message: lead.message || '',
    internalNotes: lead.internalNotes || '',
    status,
    statusLabel: getGatewayLeadStatusLabel(status),
    lastContactedAt: normalizeDate(lead.lastContactedAt),
    createdAt: normalizeDate(lead.createdAt),
    updatedAt: normalizeDate(lead.updatedAt),
  };

  return {
    ...normalized,
    followUpState: getGatewayLeadFollowUpState(normalized),
  };
}
