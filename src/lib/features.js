export const FEATURE_KEYS = Object.freeze({
  WEBSITE: 'WEBSITE',
  MENU: 'MENU',
  GALLERY: 'GALLERY',
  RESERVATIONS: 'RESERVATIONS',
  ONLINE_ORDERING: 'ONLINE_ORDERING',
  ANNOUNCEMENTS: 'ANNOUNCEMENTS',
  CONTACT_WHATSAPP: 'CONTACT_WHATSAPP',
  TABLE_QR_ORDERING: 'TABLE_QR_ORDERING',
  WAITER_ASSISTED_ORDERING: 'WAITER_ASSISTED_ORDERING',
  KITCHEN_QUEUE: 'KITCHEN_QUEUE',
  INVENTORY: 'INVENTORY',
  RECIPE_CONSUMPTION: 'RECIPE_CONSUMPTION',
  SUPPLIER_REQUESTS: 'SUPPLIER_REQUESTS',
  INVOICE_TRACKING: 'INVOICE_TRACKING',
  CASH_RECONCILIATION: 'CASH_RECONCILIATION',
  TAX_REPORTS: 'TAX_REPORTS',
  INSIGHTS: 'INSIGHTS',
  EMPLOYEE_MANAGEMENT: 'EMPLOYEE_MANAGEMENT',
  ATTENDANCE: 'ATTENDANCE',
  PAYROLL: 'PAYROLL',
  AI_ORDERING: 'AI_ORDERING',
});

export const FEATURE_DEFINITIONS = Object.freeze([
  {
    key: FEATURE_KEYS.WEBSITE,
    label: 'Public website',
    description: 'Customer-facing website pages and basic restaurant presence.',
    category: 'Customer experience',
  },
  {
    key: FEATURE_KEYS.MENU,
    label: 'Menu',
    description: 'Public and admin menu management.',
    category: 'Customer experience',
  },
  {
    key: FEATURE_KEYS.GALLERY,
    label: 'Gallery',
    description: 'Public photo gallery and gallery admin tools.',
    category: 'Customer experience',
  },
  {
    key: FEATURE_KEYS.RESERVATIONS,
    label: 'Reservations',
    description: 'Public table booking and admin reservation management.',
    category: 'Customer experience',
  },
  {
    key: FEATURE_KEYS.ONLINE_ORDERING,
    label: 'Online ordering',
    description: 'Customer online ordering flow and order management.',
    category: 'Ordering',
  },
  {
    key: FEATURE_KEYS.ANNOUNCEMENTS,
    label: 'Announcements',
    description: 'Public announcement banner and admin announcement controls.',
    category: 'Customer experience',
  },
  {
    key: FEATURE_KEYS.CONTACT_WHATSAPP,
    label: 'WhatsApp contact',
    description: 'WhatsApp links and customer contact CTAs.',
    category: 'Customer experience',
  },
  {
    key: FEATURE_KEYS.TABLE_QR_ORDERING,
    label: 'Table QR ordering',
    description: 'Future table-based QR ordering module.',
    category: 'Ordering',
  },
  {
    key: FEATURE_KEYS.WAITER_ASSISTED_ORDERING,
    label: 'Waiter-assisted ordering',
    description: 'Future waiter-assisted order entry module.',
    category: 'Ordering',
  },
  {
    key: FEATURE_KEYS.KITCHEN_QUEUE,
    label: 'Kitchen queue',
    description: 'Simple active order queue for kitchen and preparation staff.',
    category: 'Ordering',
  },
  {
    key: FEATURE_KEYS.INVENTORY,
    label: 'Inventory',
    description: 'Future stock item tracking module.',
    category: 'Operations',
  },
  {
    key: FEATURE_KEYS.RECIPE_CONSUMPTION,
    label: 'Recipe consumption',
    description: 'Future ingredient usage and recipe depletion module.',
    category: 'Operations',
  },
  {
    key: FEATURE_KEYS.SUPPLIER_REQUESTS,
    label: 'Supplier requests',
    description: 'Future supplier ordering and request workflow.',
    category: 'Operations',
  },
  {
    key: FEATURE_KEYS.INVOICE_TRACKING,
    label: 'Invoice tracking',
    description: 'Future invoice capture and tracking module.',
    category: 'Finance',
  },
  {
    key: FEATURE_KEYS.CASH_RECONCILIATION,
    label: 'Cash reconciliation',
    description: 'Future cashier closing and cash reconciliation module.',
    category: 'Finance',
  },
  {
    key: FEATURE_KEYS.TAX_REPORTS,
    label: 'Tax reports',
    description: 'Future tax reporting and export module.',
    category: 'Finance',
  },
  {
    key: FEATURE_KEYS.INSIGHTS,
    label: 'Insights',
    description: 'Future business insights and reporting module.',
    category: 'Finance',
  },
  {
    key: FEATURE_KEYS.EMPLOYEE_MANAGEMENT,
    label: 'Employee management',
    description: 'Future staff profile and employee management module.',
    category: 'Workforce',
  },
  {
    key: FEATURE_KEYS.ATTENDANCE,
    label: 'Attendance',
    description: 'Future attendance and shift tracking module.',
    category: 'Workforce',
  },
  {
    key: FEATURE_KEYS.PAYROLL,
    label: 'Payroll',
    description: 'Future payroll preparation module.',
    category: 'Workforce',
  },
  {
    key: FEATURE_KEYS.AI_ORDERING,
    label: 'AI ordering',
    description: 'Future AI-assisted ordering module.',
    category: 'Automation',
  },
]);

export const FEATURE_KEY_VALUES = Object.freeze(FEATURE_DEFINITIONS.map((feature) => feature.key));

const DEFAULT_ENABLED_FEATURES = Object.freeze([
  FEATURE_KEYS.WEBSITE,
  FEATURE_KEYS.MENU,
  FEATURE_KEYS.GALLERY,
  FEATURE_KEYS.RESERVATIONS,
  FEATURE_KEYS.ONLINE_ORDERING,
  FEATURE_KEYS.ANNOUNCEMENTS,
  FEATURE_KEYS.CONTACT_WHATSAPP,
]);

const knownFeatureKeys = new Set(FEATURE_KEY_VALUES);

export function getFeatureDefinition(key) {
  return FEATURE_DEFINITIONS.find((feature) => feature.key === key) || null;
}

export function getDefaultEnabledFeatures() {
  return [...DEFAULT_ENABLED_FEATURES];
}

export function normalizeEnabledFeatures(value) {
  if (value === undefined || value === null || value === '') {
    return getDefaultEnabledFeatures();
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return normalizeEnabledFeatures(parsed);
    } catch (error) {
      return getDefaultEnabledFeatures();
    }
  }

  if (!Array.isArray(value)) {
    return getDefaultEnabledFeatures();
  }

  const enabled = [];
  for (const key of value) {
    if (knownFeatureKeys.has(key) && !enabled.includes(key)) {
      enabled.push(key);
    }
  }
  return enabled;
}

export function isFeatureEnabled(enabledFeatures, key) {
  return normalizeEnabledFeatures(enabledFeatures).includes(key);
}
