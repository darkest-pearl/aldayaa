import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertIncludes(content, expected, label) {
  assert(content.includes(expected), `${label} missing: ${expected}`);
}

function assertNotIncludes(content, unexpected, label) {
  assert(!content.includes(unexpected), `${label} should not include: ${unexpected}`);
}

function checkOrderHardening() {
  const orderRoute = read('src/app/api/orders/route.js');
  const itemSchemaMatch = orderRoute.match(/const itemSchema = z\.object\(\{[\s\S]*?\n\}\);/);
  assert(itemSchemaMatch, 'Order item schema not found');

  const itemSchema = itemSchemaMatch[0];
  assertNotIncludes(itemSchema, 'name:', 'Order item schema');
  assertNotIncludes(itemSchema, 'price:', 'Order item schema');
  assertIncludes(itemSchema, '.max(99)', 'Order item quantity cap');
  assertIncludes(orderRoute, 'prisma.menuItem.findMany', 'Order DB menu item lookup');
  assertIncludes(orderRoute, 'name: menuItem.name', 'Order item name DB snapshot');
  assertIncludes(orderRoute, 'price: menuItem.price', 'Order item price DB snapshot');
  assertNotIncludes(orderRoute, 'Number(i.price)', 'Order route client price coercion');
}

function checkReservationCancellationHardening() {
  const cancelRoute = read('src/app/api/reservations/cancel/route.js');
  assertIncludes(cancelRoute, 'reference: z.string().trim().min(3)', 'Reservation cancellation reference validation');
  assertIncludes(cancelRoute, 'phone: z.string().trim().min(4)', 'Reservation cancellation phone validation');
  assertIncludes(cancelRoute, 'where: { reference }', 'Reservation cancellation reference lookup');
  assertIncludes(cancelRoute, 'reservation.phone !== phone', 'Reservation cancellation phone match');
}

function checkAdminUserHardening() {
  const adminUserRoute = read('src/app/api/admin/users/[id]/route.js');
  assertIncludes(adminUserRoute, 'currentAdmin.id === params.id', 'Admin self-delete guard');
  assertIncludes(adminUserRoute, "role: 'ADMIN'", 'Last ADMIN count query');
  assertIncludes(adminUserRoute, 'Cannot delete the last remaining ADMIN user', 'Last ADMIN delete guard');
  assertIncludes(adminUserRoute, 'Cannot demote the last remaining ADMIN user', 'Last ADMIN demotion guard');
}

function checkEnvExample() {
  const envExamplePath = path.join(root, '.env.example');
  assert(fs.existsSync(envExamplePath), '.env.example does not exist');

  const envExample = read('.env.example');
  const requiredKeys = [
    'DATABASE_URL',
    'ADMIN_EMAIL',
    'ADMIN_PASSWORD',
    'ADMIN_JWT_SECRET',
    'COOKIE_DOMAIN',
    'WHATSAPP_ACCESS_TOKEN',
    'WHATSAPP_PHONE_NUMBER_ID',
    'ADMIN_WHATSAPP_TO',
    'CONTACT_WHATSAPP_TO',
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET',
    'NEXT_PUBLIC_BASE_URL',
  ];

  for (const key of requiredKeys) {
    assert(new RegExp(`^${key}=`, 'm').test(envExample), `.env.example missing ${key}`);
  }

  const suspiciousValues = [
    /sk-[A-Za-z0-9_-]{20,}/,
    /xox[baprs]-[A-Za-z0-9-]{20,}/,
    /EA[A-Za-z0-9]{40,}/,
    /postgresql:\/\/(?!USER:PASSWORD@HOST)/i,
  ];

  for (const pattern of suspiciousValues) {
    assert(!pattern.test(envExample), `.env.example contains suspicious secret-like value: ${pattern}`);
  }
}

function checkRestaurantProfileFoundation() {
  const schema = read('prisma/schema.prisma');
  const helper = read('src/lib/restaurant-profile.js');
  const apiRoute = read('src/app/api/admin/restaurant-profile/route.js');

  assertIncludes(schema, 'model RestaurantProfile', 'RestaurantProfile Prisma model');
  assertIncludes(schema, 'enabledFeatures', 'RestaurantProfile enabledFeatures field');
  assertIncludes(helper, 'getRestaurantProfile', 'Restaurant profile helper');
  assertIncludes(apiRoute, "await requireAdmin(request, ['ADMIN'", 'Restaurant profile admin API auth');
  assertIncludes(apiRoute, 'profileSchema.safeParse', 'Restaurant profile API validation');
}

function checkRestaurantProfileUiWiring() {
  const settingsClient = read('src/app/admin/(protected)/settings/SettingsClient.jsx');
  const publicLayout = read('src/app/public/layout.js');
  const header = read('src/components/Header.jsx');
  const contactForm = read('src/components/ContactForm.jsx');
  const footer = read('src/components/Footer.jsx');

  assert(fs.existsSync(path.join(root, 'src/app/api/admin/restaurant-profile/route.js')), 'Restaurant profile API route is missing');
  assertIncludes(settingsClient, '/api/admin/restaurant-profile', 'Admin settings profile API usage');
  assertIncludes(settingsClient, "adminRole === 'ADMIN'", 'Admin settings profile update role guard');
  assertIncludes(settingsClient, 'submitDisabled={!canUpdateProfile}', 'Admin settings non-ADMIN submit disable');
  assertIncludes(publicLayout, 'getRestaurantProfile', 'Public layout profile loading');
  assertIncludes(header, 'profile = {}', 'Header profile prop fallback');
  assertIncludes(contactForm, 'profile = {}', 'Contact form profile prop fallback');
  assertIncludes(footer, 'profile: profileProp', 'Footer profile prop support');
}

function checkFeatureModulesFoundation() {
  const featuresPath = path.join(root, 'src/lib/features.js');
  assert(fs.existsSync(featuresPath), 'src/lib/features.js does not exist');

  const features = read('src/lib/features.js');
  const schema = read('prisma/schema.prisma');
  const settingsClient = read('src/app/admin/(protected)/settings/SettingsClient.jsx');
  const header = read('src/components/Header.jsx');

  const defaultKeys = [
    'WEBSITE',
    'MENU',
    'GALLERY',
    'RESERVATIONS',
    'ONLINE_ORDERING',
    'ANNOUNCEMENTS',
    'CONTACT_WHATSAPP',
  ];
  const defaultBlockMatch = features.match(/const DEFAULT_ENABLED_FEATURES = Object\.freeze\(\[([\s\S]*?)\]\);/);
  assert(defaultBlockMatch, 'Default enabled features block not found');
  const defaultBlock = defaultBlockMatch[1];

  for (const key of defaultKeys) {
    assertIncludes(defaultBlock, `FEATURE_KEYS.${key}`, `Default enabled feature ${key}`);
  }

  assertIncludes(features, 'getFeatureDefinition', 'Feature definition helper');
  assertIncludes(features, 'normalizeEnabledFeatures', 'Feature normalization helper');
  assertIncludes(features, 'isFeatureEnabled', 'Feature enabled helper');
  assertIncludes(features, 'getDefaultEnabledFeatures', 'Default enabled features helper');
  assertIncludes(schema, 'enabledFeatures', 'RestaurantProfile enabledFeatures persistence');
  assertIncludes(settingsClient, 'enabledFeatures', 'Admin profile enabledFeatures UI');
  assertIncludes(settingsClient, 'featureGroups', 'Admin feature grouping UI');
  assertIncludes(header, 'isFeatureEnabled', 'Header feature visibility helper');
  assertIncludes(header, 'visibleNavLinks', 'Header feature-filtered nav links');
}

const checks = [
  checkOrderHardening,
  checkReservationCancellationHardening,
  checkAdminUserHardening,
  checkEnvExample,
  checkRestaurantProfileFoundation,
  checkRestaurantProfileUiWiring,
  checkFeatureModulesFoundation,
];

for (const check of checks) {
  check();
}

console.log(`Smoke hardening checks passed (${checks.length} groups).`);
