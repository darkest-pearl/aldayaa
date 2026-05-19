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

function checkQrTableOrderingFoundation() {
  const schema = read('prisma/schema.prisma');
  const features = read('src/lib/features.js');
  const adminShell = read('src/app/admin/components/AdminShell.jsx');
  const adminTablesClient = read('src/app/admin/(protected)/tables/TablesClient.jsx');
  const publicTablePage = read('src/app/public/table/[slug]/page.js');
  const orderPage = read('src/app/public/order/page.js');

  assertIncludes(schema, 'model RestaurantTable', 'RestaurantTable Prisma model');
  assertIncludes(schema, 'slug      String   @unique', 'RestaurantTable unique slug');
  assertIncludes(schema, 'qrToken   String   @unique', 'RestaurantTable unique QR token');
  assertIncludes(features, 'TABLE_QR_ORDERING', 'TABLE_QR_ORDERING feature key');
  assert(fs.existsSync(path.join(root, 'src/app/api/admin/tables/route.js')), 'Admin table collection API route is missing');
  assert(fs.existsSync(path.join(root, 'src/app/api/admin/tables/[id]/route.js')), 'Admin table item API route is missing');
  assert(fs.existsSync(path.join(root, 'src/app/admin/(protected)/tables/page.jsx')), 'Admin tables page is missing');
  assert(fs.existsSync(path.join(root, 'src/app/public/table/[slug]/page.js')), 'Public table landing route is missing');
  assertIncludes(adminTablesClient, '/api/admin/tables', 'Admin tables UI API usage');
  assertIncludes(adminTablesClient, "['ADMIN', 'MANAGER']", 'Admin tables manage role guard');
  assertIncludes(adminShell, "'/admin/tables'", 'Admin tables navigation');
  assertIncludes(publicTablePage, 'FEATURE_KEYS.TABLE_QR_ORDERING', 'Public table feature flag check');
  assertIncludes(publicTablePage, 'searchParams = {}', 'Public table token query awareness');
  assertIncludes(publicTablePage, 'searchParams.token', 'Public table token read');
  assertIncludes(publicTablePage, 'tableRecord.qrToken !== token', 'Public table token validation');
  assertIncludes(publicTablePage, '/public/order?table=', 'Public table handoff URL');
  assertIncludes(publicTablePage, 'tableToken=', 'Public table token handoff URL');
  assertIncludes(orderPage, 'searchParams = {}', 'Order page table query awareness');
  assertIncludes(orderPage, 'Ordering for', 'Order page table notice');
}

function checkTableOrderContextFoundation() {
  const schema = read('prisma/schema.prisma');
  const orderRoute = read('src/app/api/orders/route.js');
  const orderPage = read('src/app/public/order/page.js');
  const orderClient = read('src/components/OrderClient.jsx');
  const ordersClient = read('src/app/admin/(protected)/orders/OrdersClient.jsx');

  assertIncludes(schema, 'tableId', 'Order tableId field');
  assertIncludes(schema, 'tableLabel', 'Order tableLabel field');
  assertIncludes(schema, 'tableSlug', 'Order tableSlug field');
  assertIncludes(schema, 'orderContext', 'Order orderContext field');
  assert(/table\s+RestaurantTable\?/.test(schema), 'Order RestaurantTable relation missing');
  assert(/orders\s+Order\[\]/.test(schema), 'RestaurantTable orders relation missing');
  assertIncludes(orderRoute, 'tableSlug: z.string().trim()', 'Order POST tableSlug validation');
  assertIncludes(orderRoute, 'table: z.string().trim()', 'Order POST table alias validation');
  assertIncludes(orderRoute, 'tableToken: z.string().trim()', 'Order POST tableToken validation');
  assertIncludes(orderRoute, 'FEATURE_KEYS.TABLE_QR_ORDERING', 'Order POST table feature flag check');
  assertIncludes(orderRoute, 'prisma.restaurantTable.findFirst', 'Order POST RestaurantTable lookup');
  assertIncludes(orderRoute, 'qrToken: requestedTableToken', 'Order POST RestaurantTable token lookup');
  assertIncludes(orderRoute, 'if (!requestedTableToken)', 'Order POST table token required');
  assertIncludes(orderRoute, "orderContext: tableContext ? 'TABLE' : 'STANDARD'", 'Order context persistence');
  assertIncludes(orderRoute, 'tableLabel: tableContext?.label', 'Order table label snapshot');
  assertIncludes(orderRoute, 'include: { items: true, table: true }', 'Orders API table relation output');
  assertIncludes(orderPage, 'searchParams.tableToken', 'Public order page reads tableToken');
  assertIncludes(orderPage, 'qrToken: tableToken', 'Public order page validates table token');
  assertIncludes(orderPage, 'table={table}', 'Public order page passes table context');
  assertIncludes(orderClient, 'table = null', 'OrderClient table prop fallback');
  assertIncludes(orderClient, 'tableSlug: table.slug', 'OrderClient submits table slug');
  assertIncludes(orderClient, 'tableToken: table.tableToken', 'OrderClient submits table token');
  assertIncludes(ordersClient, 'contextFilter', 'Admin orders context filter');
  assertIncludes(ordersClient, 'order.orderContext', 'Admin orders context display');
  assertIncludes(ordersClient, 'order.tableLabel', 'Admin orders table label display');
}

function checkTableOrderUxRefinement() {
  const orderRoute = read('src/app/api/orders/route.js');
  const orderClient = read('src/components/OrderClient.jsx');
  const ordersClient = read('src/app/admin/(protected)/orders/OrdersClient.jsx');
  const publicTablePage = read('src/app/public/table/[slug]/page.js');

  assertIncludes(orderRoute, 'const requestedTableSlugFromBody = getRequestedTableSlug(body)', 'Order POST detects table context before address validation');
  assertIncludes(orderRoute, "const orderType = requestedTableSlugFromBody ? 'PICKUP' : body.deliveryType", 'Order POST coerces table orders to pickup');
  assertIncludes(orderRoute, 'Table-context orders reuse PICKUP', 'Order POST table order deliveryType comment');
  assertIncludes(orderRoute, "!hasTableContext && parsed.data.deliveryType === 'DELIVERY'", 'Order POST table orders bypass delivery address requirement');
  assertIncludes(orderRoute, 'address: hasTableContext', 'Order POST clears table order address');
  assertIncludes(orderRoute, 'qrToken: requestedTableToken', 'Order POST keeps table token validation');
  assertIncludes(orderClient, 'Staff will receive this table order', 'OrderClient table-order checkout copy');
  assertIncludes(orderClient, 'No delivery address is needed', 'OrderClient table-order address copy');
  assertIncludes(orderClient, 'Send table order', 'OrderClient table-order submit label');
  assertIncludes(ordersClient, 'Table order', 'Admin orders table-order badge');
  assertIncludes(ordersClient, 'tableZone', 'Admin orders table zone display');
  assertIncludes(publicTablePage, 'You are ordering for this table', 'Public table landing table-order copy');
  assertIncludes(publicTablePage, 'Staff will see your table number', 'Public table landing staff visibility copy');
  assertIncludes(publicTablePage, 'not a payment or POS checkout yet', 'Public table landing POS limitation copy');
}

const checks = [
  checkOrderHardening,
  checkReservationCancellationHardening,
  checkAdminUserHardening,
  checkEnvExample,
  checkRestaurantProfileFoundation,
  checkRestaurantProfileUiWiring,
  checkFeatureModulesFoundation,
  checkQrTableOrderingFoundation,
  checkTableOrderContextFoundation,
  checkTableOrderUxRefinement,
];

for (const check of checks) {
  check();
}

console.log(`Smoke hardening checks passed (${checks.length} groups).`);
