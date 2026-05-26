import fs from 'node:fs';
import path from 'node:path';
import {
  ORDER_STATUSES,
  canTransitionOrderStatus,
} from '../src/lib/order-status.js';

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
  assertIncludes(orderRoute, 'orderContext: tableContext ? ORDER_CONTEXTS.TABLE : ORDER_CONTEXTS.STANDARD', 'Order context persistence');
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
  assertIncludes(ordersClient, 'getOrderContextLabel(context)', 'Admin orders table-order badge');
  assertIncludes(ordersClient, 'tableZone', 'Admin orders table zone display');
  assertIncludes(publicTablePage, 'You are ordering for this table', 'Public table landing table-order copy');
  assertIncludes(publicTablePage, 'Staff will see your table number', 'Public table landing staff visibility copy');
  assertIncludes(publicTablePage, 'not a payment or POS checkout yet', 'Public table landing POS limitation copy');
}

function checkWaiterAssistedOrderingFoundation() {
  const schema = read('prisma/schema.prisma');
  const orderRoute = read('src/app/api/orders/route.js');
  const assistedRoutePath = path.join(root, 'src/app/api/admin/orders/assisted/route.js');
  const assistedPagePath = path.join(root, 'src/app/admin/(protected)/assisted-order/page.jsx');
  const assistedClientPath = path.join(root, 'src/app/admin/(protected)/assisted-order/AssistedOrderClient.jsx');
  const adminShell = read('src/app/admin/components/AdminShell.jsx');
  const ordersClient = read('src/app/admin/(protected)/orders/OrdersClient.jsx');

  assertIncludes(schema, 'orderSource', 'Order orderSource field');
  assertIncludes(schema, 'createdByAdminId', 'Order createdByAdminId field');
  assertIncludes(schema, 'createdByAdminEmail', 'Order createdByAdminEmail field');
  assert(fs.existsSync(assistedRoutePath), 'Assisted order API route is missing');
  assert(fs.existsSync(assistedPagePath), 'Assisted order admin page is missing');
  assert(fs.existsSync(assistedClientPath), 'Assisted order admin client is missing');

  const assistedRoute = read('src/app/api/admin/orders/assisted/route.js');
  const assistedClient = read('src/app/admin/(protected)/assisted-order/AssistedOrderClient.jsx');

  assertIncludes(assistedRoute, "await requireAdmin(request, ['ADMIN', 'MANAGER'])", 'Assisted order API role guard');
  assertIncludes(assistedRoute, 'FEATURE_KEYS.WAITER_ASSISTED_ORDERING', 'Assisted order feature flag check');
  assertIncludes(assistedRoute, 'prisma.menuItem.findMany', 'Assisted order DB menu item lookup');
  assertIncludes(assistedRoute, 'name: menuItem.name', 'Assisted order item name DB snapshot');
  assertIncludes(assistedRoute, 'price: menuItem.price', 'Assisted order item price DB snapshot');
  assertIncludes(assistedRoute, 'orderSource: ORDER_SOURCES.STAFF_ASSISTED', 'Assisted order source persistence');
  assertIncludes(assistedRoute, 'createdByAdminId: admin.id', 'Assisted order admin id persistence');
  assertIncludes(assistedRoute, 'createdByAdminEmail: admin.email', 'Assisted order admin email persistence');
  assertIncludes(assistedRoute, 'prisma.restaurantTable.findFirst', 'Assisted order table lookup');
  assertIncludes(assistedRoute, 'isActive: true', 'Assisted order active table guard');
  assertNotIncludes(assistedRoute, 'Number(item.price)', 'Assisted order client price trust');
  assertIncludes(assistedClient, '/api/admin/orders/assisted', 'Assisted order UI API usage');
  assertIncludes(assistedClient, '/api/menu/items', 'Assisted order UI menu loading');
  assertIncludes(assistedClient, '/api/admin/tables', 'Assisted order UI table loading');
  assertIncludes(adminShell, "'/admin/assisted-order'", 'Assisted order admin navigation');
  assertIncludes(adminShell, "roles: ['ADMIN', 'MANAGER']", 'Assisted order admin navigation roles');
  assertIncludes(ordersClient, 'createdByAdminEmail', 'Admin orders staff source search');
  assertIncludes(ordersClient, 'getOrderSourceLabel(source)', 'Admin orders staff-assisted label');
  assertIncludes(orderRoute, 'prisma.menuItem.findMany', 'Customer order route still uses DB pricing');
}

function checkOrderStatusWorkflowRefinement() {
  const helperPath = path.join(root, 'src/lib/order-status.js');
  assert(fs.existsSync(helperPath), 'src/lib/order-status.js does not exist');

  const helper = read('src/lib/order-status.js');
  const orderRoute = read('src/app/api/orders/route.js');
  const assistedRoute = read('src/app/api/admin/orders/assisted/route.js');
  const ordersClient = read('src/app/admin/(protected)/orders/OrdersClient.jsx');
  const readme = read('README.md');

  for (const expected of [
    'ORDER_STATUSES',
    'ORDER_CONTEXTS',
    'ORDER_SOURCES',
    'isValidOrderStatus',
    'getOrderStatusLabel',
    'getOrderContextLabel',
    'getOrderSourceLabel',
    'canTransitionOrderStatus',
  ]) {
    assertIncludes(helper, expected, `Order status helper ${expected}`);
  }

  assertIncludes(orderRoute, 'canTransitionOrderStatus', 'Orders API transition guard');
  assertIncludes(orderRoute, 'isValidOrderStatus', 'Orders API status validation helper');
  assertIncludes(orderRoute, 'ORDER_CONTEXTS.TABLE', 'Customer order route table context constant');
  assertIncludes(orderRoute, 'ORDER_CONTEXTS.STANDARD', 'Customer order route standard context constant');
  assertIncludes(orderRoute, 'ORDER_SOURCES.CUSTOMER', 'Customer order route source constant');
  assertIncludes(assistedRoute, 'ORDER_CONTEXTS.TABLE', 'Assisted order route table context constant');
  assertIncludes(assistedRoute, 'ORDER_SOURCES.STAFF_ASSISTED', 'Assisted order route source constant');
  assertIncludes(ordersClient, 'Status update failed:', 'Admin orders transition error display');
  assertIncludes(ordersClient, 'canTransitionOrderStatus', 'Admin orders disabled transition options');
  assertIncludes(ordersClient, 'getOrderStatusLabel', 'Admin orders status labels');
  assertIncludes(readme, 'Order status workflow helpers added.', 'README order status workflow note');
  assertIncludes(readme, 'not a kitchen display or POS workflow', 'README kitchen/POS limitation');

  assert(
    canTransitionOrderStatus(ORDER_STATUSES.NEW, ORDER_STATUSES.COMPLETED),
    'Order status transition NEW -> COMPLETED should be allowed',
  );
  assert(
    !canTransitionOrderStatus(ORDER_STATUSES.COMPLETED, ORDER_STATUSES.IN_PROGRESS),
    'Order status transition COMPLETED -> IN_PROGRESS should be blocked',
  );
  assert(
    !canTransitionOrderStatus(ORDER_STATUSES.CANCELLED, ORDER_STATUSES.NEW),
    'Order status transition CANCELLED -> NEW should be blocked',
  );
}

function checkKitchenQueueFoundation() {
  const features = read('src/lib/features.js');
  const adminShell = read('src/app/admin/components/AdminShell.jsx');
  const readme = read('README.md');
  const kitchenRoutePath = path.join(root, 'src/app/api/admin/kitchen/orders/route.js');
  const kitchenPagePath = path.join(root, 'src/app/admin/(protected)/kitchen/page.jsx');
  const kitchenClientPath = path.join(root, 'src/app/admin/(protected)/kitchen/KitchenQueueClient.jsx');

  assertIncludes(features, 'KITCHEN_QUEUE', 'KITCHEN_QUEUE feature key');
  const defaultBlockMatch = features.match(/const DEFAULT_ENABLED_FEATURES = Object\.freeze\(\[([\s\S]*?)\]\);/);
  assert(defaultBlockMatch, 'Default enabled features block not found for kitchen queue check');
  assertNotIncludes(defaultBlockMatch[1], 'FEATURE_KEYS.KITCHEN_QUEUE', 'KITCHEN_QUEUE default enabled features');
  assert(fs.existsSync(kitchenRoutePath), 'Kitchen queue API route is missing');
  assert(fs.existsSync(kitchenPagePath), 'Kitchen queue admin page is missing');
  assert(fs.existsSync(kitchenClientPath), 'Kitchen queue admin client is missing');

  const kitchenRoute = read('src/app/api/admin/kitchen/orders/route.js');
  const kitchenPage = read('src/app/admin/(protected)/kitchen/page.jsx');
  const kitchenClient = read('src/app/admin/(protected)/kitchen/KitchenQueueClient.jsx');

  assertIncludes(kitchenRoute, "await requireAdmin(request, ['ADMIN', 'MANAGER'])", 'Kitchen queue API role guard');
  assertIncludes(kitchenRoute, 'FEATURE_KEYS.KITCHEN_QUEUE', 'Kitchen queue API feature key check');
  assertIncludes(kitchenRoute, 'getRestaurantProfile', 'Kitchen queue API restaurant profile loading');
  assertIncludes(kitchenRoute, 'requireFeatureEnabled', 'Kitchen queue API feature enabled check');
  assertIncludes(kitchenRoute, 'ORDER_STATUSES.NEW', 'Kitchen queue API NEW status filter');
  assertIncludes(kitchenRoute, 'ORDER_STATUSES.IN_PROGRESS', 'Kitchen queue API IN_PROGRESS status filter');
  assertIncludes(kitchenRoute, 'notIn: [ORDER_STATUSES.COMPLETED, ORDER_STATUSES.CANCELLED]', 'Kitchen queue API completed/cancelled exclusion');
  assertIncludes(kitchenRoute, 'include: { items: true, table: true }', 'Kitchen queue API order details');
  assertIncludes(kitchenPage, "['ADMIN', 'MANAGER']", 'Kitchen queue page role guard');
  assertIncludes(adminShell, "'/admin/kitchen'", 'Kitchen queue admin navigation');
  assertIncludes(adminShell, "roles: ['ADMIN', 'MANAGER']", 'Kitchen queue admin navigation roles');
  assertIncludes(kitchenClient, '/api/admin/kitchen/orders', 'Kitchen queue UI API usage');
  assertIncludes(kitchenClient, '/api/orders', 'Kitchen queue status action uses orders API');
  assertIncludes(kitchenClient, "method: 'PUT'", 'Kitchen queue status action PUT method');
  assertIncludes(kitchenClient, 'canTransitionOrderStatus', 'Kitchen queue centralized transition helper usage');
  assertIncludes(kitchenClient, 'getOrderContextLabel', 'Kitchen queue context label helper');
  assertIncludes(kitchenClient, 'getOrderSourceLabel', 'Kitchen queue source label helper');
  assertIncludes(kitchenClient, 'setInterval', 'Kitchen queue light polling');
  assertIncludes(kitchenClient, 'Refresh', 'Kitchen queue manual refresh');
  assertIncludes(readme, 'Kitchen queue foundation added.', 'README kitchen queue note');
  assertIncludes(readme, 'not a full kitchen display, POS, printing, or realtime system', 'README kitchen limitation');
}

function checkModuleAccessPolish() {
  const moduleAccessPath = path.join(root, 'src/lib/module-access.js');
  const moduleUnavailablePath = path.join(root, 'src/app/admin/components/ModuleUnavailable.jsx');
  const kitchenRoute = read('src/app/api/admin/kitchen/orders/route.js');
  const assistedRoute = read('src/app/api/admin/orders/assisted/route.js');
  const kitchenPage = read('src/app/admin/(protected)/kitchen/page.jsx');
  const assistedPage = read('src/app/admin/(protected)/assisted-order/page.jsx');
  const tablesPage = read('src/app/admin/(protected)/tables/page.jsx');
  const tablesClient = read('src/app/admin/(protected)/tables/TablesClient.jsx');
  const features = read('src/lib/features.js');
  const readme = read('README.md');

  assert(fs.existsSync(moduleAccessPath), 'Module access helper is missing');
  assert(fs.existsSync(moduleUnavailablePath), 'ModuleUnavailable component is missing');

  const moduleAccess = read('src/lib/module-access.js');
  const moduleUnavailable = read('src/app/admin/components/ModuleUnavailable.jsx');

  assertIncludes(moduleAccess, 'getModuleUnavailableMessage', 'Module unavailable message helper');
  assertIncludes(moduleAccess, 'requireFeatureEnabled', 'Require feature helper');
  assertIncludes(moduleAccess, 'getFeatureRouteAccess', 'Feature route access helper');
  assertIncludes(moduleAccess, 'isFeatureEnabled', 'Module access feature enabled check');
  assertIncludes(moduleUnavailable, 'ModuleUnavailable', 'ModuleUnavailable component export');
  assertIncludes(moduleUnavailable, '/admin/settings', 'ModuleUnavailable settings link');

  assertIncludes(kitchenPage, 'FEATURE_KEYS.KITCHEN_QUEUE', 'Kitchen page module access feature key');
  assertIncludes(kitchenPage, 'getRestaurantProfile', 'Kitchen page profile loading');
  assertIncludes(kitchenPage, 'getFeatureRouteAccess', 'Kitchen page module access helper');
  assertIncludes(kitchenPage, '<ModuleUnavailable', 'Kitchen page disabled module state');
  assertIncludes(kitchenPage, '<KitchenQueueClient />', 'Kitchen page enabled queue render');

  assertIncludes(assistedPage, 'FEATURE_KEYS.WAITER_ASSISTED_ORDERING', 'Assisted order page module access feature key');
  assertIncludes(assistedPage, 'getRestaurantProfile', 'Assisted order page profile loading');
  assertIncludes(assistedPage, 'getFeatureRouteAccess', 'Assisted order page module access helper');
  assertIncludes(assistedPage, '<ModuleUnavailable', 'Assisted order page disabled module state');
  assertIncludes(assistedPage, '<AssistedOrderClient />', 'Assisted order page enabled client render');

  assertIncludes(tablesPage, 'FEATURE_KEYS.TABLE_QR_ORDERING', 'Tables page module access feature key');
  assertIncludes(tablesPage, 'getRestaurantProfile', 'Tables page profile loading');
  assertIncludes(tablesPage, 'getFeatureRouteAccess', 'Tables page module access helper');
  assertIncludes(tablesPage, 'tableQrOrderingEnabled', 'Tables page passes module state');
  assertIncludes(tablesClient, 'QR table ordering is disabled', 'Tables page disabled setup warning');
  assertIncludes(tablesClient, 'You can prepare tables now', 'Tables page setup warning copy');

  assertIncludes(kitchenRoute, 'requireFeatureEnabled', 'Kitchen API module access enforcement');
  assertIncludes(kitchenRoute, 'FEATURE_KEYS.KITCHEN_QUEUE', 'Kitchen API module access feature key');
  assertIncludes(assistedRoute, 'requireFeatureEnabled', 'Assisted order API module access enforcement');
  assertIncludes(assistedRoute, 'FEATURE_KEYS.WAITER_ASSISTED_ORDERING', 'Assisted order API module access feature key');

  const defaultBlockMatch = features.match(/const DEFAULT_ENABLED_FEATURES = Object\.freeze\(\[([\s\S]*?)\]\);/);
  assert(defaultBlockMatch, 'Default enabled features block not found for module access check');
  assertNotIncludes(defaultBlockMatch[1], 'FEATURE_KEYS.KITCHEN_QUEUE', 'KITCHEN_QUEUE default enabled features');
  assertNotIncludes(defaultBlockMatch[1], 'FEATURE_KEYS.WAITER_ASSISTED_ORDERING', 'WAITER_ASSISTED_ORDERING default enabled features');
  assertNotIncludes(defaultBlockMatch[1], 'FEATURE_KEYS.TABLE_QR_ORDERING', 'TABLE_QR_ORDERING default enabled features');
  assertIncludes(readme, 'Module disabled-state UX added for admin features.', 'README module disabled UX note');
  assertIncludes(readme, 'No billing or subscription system has been added', 'README no billing note');
}

function checkInventoryFoundation() {
  const schema = read('prisma/schema.prisma');
  const features = read('src/lib/features.js');
  const helperPath = path.join(root, 'src/lib/inventory.js');
  const pagePath = path.join(root, 'src/app/admin/(protected)/inventory/page.jsx');
  const clientPath = path.join(root, 'src/app/admin/(protected)/inventory/InventoryClient.jsx');
  const itemsRoutePath = path.join(root, 'src/app/api/admin/inventory/items/route.js');
  const itemRoutePath = path.join(root, 'src/app/api/admin/inventory/items/[id]/route.js');
  const movementsRoutePath = path.join(root, 'src/app/api/admin/inventory/movements/route.js');
  const adminShell = read('src/app/admin/components/AdminShell.jsx');
  const readme = read('README.md');

  assertIncludes(schema, 'model InventoryItem', 'InventoryItem Prisma model');
  assertIncludes(schema, 'model InventoryMovement', 'InventoryMovement Prisma model');
  assert(/movements\s+InventoryMovement\[\]/.test(schema), 'InventoryItem movements relation missing');
  assert(/item\s+InventoryItem\s+@relation/.test(schema), 'InventoryMovement item relation missing');
  assertIncludes(schema, '@@index([name])', 'InventoryItem name index');
  assertIncludes(schema, '@@index([category])', 'InventoryItem category index');
  assertIncludes(schema, '@@index([isActive])', 'InventoryItem isActive index');
  assertIncludes(schema, '@@index([itemId])', 'InventoryMovement itemId index');
  assertIncludes(schema, '@@index([type])', 'InventoryMovement type index');
  assertIncludes(schema, '@@index([createdAt])', 'InventoryMovement createdAt index');

  const defaultBlockMatch = features.match(/const DEFAULT_ENABLED_FEATURES = Object\.freeze\(\[([\s\S]*?)\]\);/);
  assert(defaultBlockMatch, 'Default enabled features block not found for inventory check');
  assertNotIncludes(defaultBlockMatch[1], 'FEATURE_KEYS.INVENTORY', 'INVENTORY default enabled features');

  assert(fs.existsSync(helperPath), 'Inventory helper is missing');
  assert(fs.existsSync(pagePath), 'Admin inventory page is missing');
  assert(fs.existsSync(clientPath), 'Admin inventory client is missing');
  assert(fs.existsSync(itemsRoutePath), 'Inventory items API route is missing');
  assert(fs.existsSync(itemRoutePath), 'Inventory item API route is missing');
  assert(fs.existsSync(movementsRoutePath), 'Inventory movements API route is missing');

  const helper = read('src/lib/inventory.js');
  const page = read('src/app/admin/(protected)/inventory/page.jsx');
  const client = read('src/app/admin/(protected)/inventory/InventoryClient.jsx');
  const itemsRoute = read('src/app/api/admin/inventory/items/route.js');
  const itemRoute = read('src/app/api/admin/inventory/items/[id]/route.js');
  const movementsRoute = read('src/app/api/admin/inventory/movements/route.js');

  for (const expected of [
    'INVENTORY_MOVEMENT_TYPES',
    'normalizeInventoryItem',
    'normalizeInventoryMovement',
    'calculateStockAfterMovement',
    'isValidInventoryMovementType',
    'STOCK_IN',
    'STOCK_OUT',
    'ADJUSTMENT',
    'WASTE',
    'COUNT_CORRECTION',
  ]) {
    assertIncludes(helper, expected, `Inventory helper ${expected}`);
  }

  assertIncludes(page, 'FEATURE_KEYS.INVENTORY', 'Inventory page feature key');
  assertIncludes(page, 'getFeatureRouteAccess', 'Inventory page module access helper');
  assertIncludes(page, '<ModuleUnavailable', 'Inventory page disabled module state');
  assertIncludes(page, '<InventoryClient />', 'Inventory page enabled client render');
  assertIncludes(adminShell, "'/admin/inventory'", 'Inventory admin navigation');
  assertIncludes(adminShell, "roles: ['ADMIN', 'MANAGER', 'SUPPORT']", 'Inventory admin navigation roles');

  for (const [route, label] of [
    [itemsRoute, 'Inventory items API'],
    [itemRoute, 'Inventory item API'],
    [movementsRoute, 'Inventory movements API'],
  ]) {
    assertIncludes(route, 'FEATURE_KEYS.INVENTORY', `${label} feature key`);
    assertIncludes(route, 'getRestaurantProfile', `${label} profile loading`);
    assertIncludes(route, 'requireFeatureEnabled', `${label} feature enforcement`);
  }

  assertIncludes(itemsRoute, "requireInventoryFeature(request, ['ADMIN', 'MANAGER', 'SUPPORT'])", 'Inventory items API SUPPORT view access');
  assertIncludes(itemsRoute, "requireInventoryFeature(request, ['ADMIN', 'MANAGER'])", 'Inventory items API manage access');
  assertIncludes(itemRoute, 'requireInventoryFeature(request)', 'Inventory item API manage access');
  assertIncludes(itemRoute, "await requireAdmin(request, ['ADMIN', 'MANAGER'])", 'Inventory item API requireAdmin roles');
  assertIncludes(movementsRoute, "requireInventoryFeature(request, ['ADMIN', 'MANAGER', 'SUPPORT'])", 'Inventory movements API SUPPORT view access');
  assertIncludes(movementsRoute, "requireInventoryFeature(request, ['ADMIN', 'MANAGER'])", 'Inventory movements API manage access');
  assertIncludes(itemsRoute, 'currentStock: z.coerce.number().min(0)', 'Inventory item non-negative stock validation');
  assertIncludes(itemRoute, 'isActive: false', 'Inventory item soft deactivate');
  assertIncludes(movementsRoute, 'calculateStockAfterMovement', 'Inventory movement server-side stock calculation');
  assertIncludes(movementsRoute, 'resultingStock < 0', 'Inventory movement below-zero prevention');
  assertIncludes(movementsRoute, 'prisma.$transaction(async', 'Inventory movement interactive transaction');
  assert(
    movementsRoute.includes('tx.inventoryItem.findUnique') || movementsRoute.includes('tx.inventoryItem.findFirst'),
    'Inventory movement transaction item lookup missing',
  );
  assertIncludes(movementsRoute, 'tx.inventoryItem.update', 'Inventory movement transaction stock update');
  assertIncludes(movementsRoute, 'tx.inventoryMovement.create', 'Inventory movement transaction create');
  assertIncludes(client, '/api/admin/inventory/items', 'Inventory UI items API usage');
  assertIncludes(client, '/api/admin/inventory/movements', 'Inventory UI movements API usage');
  assertIncludes(client, 'Current stock', 'Inventory UI current stock display');
  assertIncludes(client, 'Recent movements', 'Inventory UI recent movements display');

  const inventorySource = [helper, page, client, itemsRoute, itemRoute, movementsRoute].join('\n');
  assertNotIncludes(inventorySource, 'RECIPE_CONSUMPTION', 'Inventory foundation recipe consumption logic');
  assertNotIncludes(inventorySource, 'SUPPLIER_REQUESTS', 'Inventory foundation supplier request logic');
  assertIncludes(readme, 'Inventory foundation added.', 'README inventory foundation note');
  assertIncludes(readme, 'No recipe consumption', 'README inventory recipe limitation');
  assertIncludes(readme, 'no automatic stock deduction', 'README inventory stock deduction limitation');
  assertIncludes(readme, 'no supplier request automation', 'README inventory supplier limitation');
}

function checkInventoryLowStockUxFilters() {
  const helper = read('src/lib/inventory.js');
  const client = read('src/app/admin/(protected)/inventory/InventoryClient.jsx');
  const readme = read('README.md');
  const inventorySource = [helper, client].join('\n');

  assertIncludes(helper, 'INVENTORY_STOCK_STATUSES', 'Inventory stock status constants');
  assertIncludes(helper, 'OUT_OF_STOCK', 'Inventory out-of-stock status');
  assertIncludes(helper, 'LOW_STOCK', 'Inventory low-stock status');
  assertIncludes(helper, 'OK', 'Inventory OK stock status');
  assertIncludes(helper, 'getInventoryStockStatus', 'Inventory stock status helper');
  assertIncludes(helper, 'getInventoryStockStatusLabel', 'Inventory stock status label helper');
  assertIncludes(helper, 'stockStatus', 'Normalized inventory item stockStatus');
  assertIncludes(helper, 'stockStatusLabel', 'Normalized inventory item stockStatusLabel');
  assertIncludes(helper, 'currentStock <= 0', 'Inventory out-of-stock calculation');
  assertIncludes(helper, 'currentStock <= reorderLevel', 'Inventory low-stock calculation');

  assertIncludes(client, 'search', 'Inventory UI search state');
  assertIncludes(client, 'statusFilter', 'Inventory UI status filter state');
  assertIncludes(client, 'stockFilter', 'Inventory UI stock filter state');
  assertIncludes(client, 'categoryFilter', 'Inventory UI category filter state');
  assertIncludes(client, 'filteredItems', 'Inventory UI filtered item list');
  assertIncludes(client, 'Total items', 'Inventory UI total items summary');
  assertIncludes(client, 'Active items', 'Inventory UI active items summary');
  assertIncludes(client, 'Low stock', 'Inventory UI low stock summary');
  assertIncludes(client, 'Out of stock', 'Inventory UI out of stock summary');
  assertIncludes(client, 'stockStatusLabel', 'Inventory UI stock status label display');
  assertIncludes(client, 'selectedMovementItem.stockStatusLabel', 'Inventory movement selected item stock status');
  assertIncludes(client, 'selectedMovementItem.reorderLevel', 'Inventory movement selected item reorder level');

  assertNotIncludes(inventorySource, 'RECIPE_CONSUMPTION', 'Inventory low-stock UX recipe consumption logic');
  assertNotIncludes(inventorySource, 'SUPPLIER_REQUESTS', 'Inventory low-stock UX supplier request logic');
  assertNotIncludes(inventorySource, 'automaticStockDeduction', 'Inventory low-stock UX automatic deduction logic');
  assertIncludes(readme, 'Inventory low-stock UX and filters added.', 'README inventory low-stock UX note');
  assertIncludes(readme, 'Still no recipe consumption', 'README inventory polish recipe limitation');
  assertIncludes(readme, 'automatic deduction', 'README inventory polish deduction limitation');
  assertIncludes(readme, 'supplier automation', 'README inventory polish supplier limitation');
}

function checkInventoryUnitCategoryPolish() {
  const schema = read('prisma/schema.prisma');
  const helper = read('src/lib/inventory.js');
  const itemsRoute = read('src/app/api/admin/inventory/items/route.js');
  const itemRoute = read('src/app/api/admin/inventory/items/[id]/route.js');
  const client = read('src/app/admin/(protected)/inventory/InventoryClient.jsx');
  const readme = read('README.md');
  const inventorySource = [helper, itemsRoute, itemRoute, client].join('\n');

  assertIncludes(helper, 'INVENTORY_UNIT_OPTIONS', 'Inventory unit option registry');
  for (const unit of ['kg', 'g', 'liter', 'ml', 'piece', 'pack', 'carton', 'box', 'bottle', 'bag']) {
    assertIncludes(helper, `value: '${unit}'`, `Inventory common unit option ${unit}`);
  }
  assertIncludes(helper, 'normalizeInventoryUnit', 'Inventory unit normalization helper');
  assertIncludes(helper, 'getInventoryUnitLabel', 'Inventory unit label helper');
  assertIncludes(helper, 'getInventoryUnitOptions', 'Inventory unit options helper');

  assertIncludes(itemsRoute, 'normalizeInventoryUnit', 'Inventory create API unit normalization');
  assertIncludes(itemsRoute, 'unit: normalizeInventoryUnit(parsed.data.unit)', 'Inventory create API normalized unit persistence');
  assertIncludes(itemsRoute, 'category: cleanOptionalString(parsed.data.category)', 'Inventory create API category cleanup');
  assertIncludes(itemsRoute, 'sku: cleanOptionalString(parsed.data.sku)', 'Inventory create API SKU cleanup');
  assertIncludes(itemRoute, 'normalizeInventoryUnit', 'Inventory update API unit normalization');
  assertIncludes(itemRoute, 'unit: normalizeInventoryUnit(parsed.data.unit)', 'Inventory update API normalized unit persistence');
  assertIncludes(itemRoute, 'category: cleanOptionalString(parsed.data.category)', 'Inventory update API category cleanup');
  assertIncludes(itemRoute, 'sku: cleanOptionalString(parsed.data.sku)', 'Inventory update API SKU cleanup');

  assertIncludes(client, 'getInventoryUnitOptions', 'Inventory UI unit options import');
  assertIncludes(client, 'unitOptions', 'Inventory UI unit options');
  assertIncludes(client, 'inventory-unit-options', 'Inventory UI unit datalist');
  assertIncludes(client, 'categorySuggestions', 'Inventory UI category suggestions');
  assertIncludes(client, 'inventory-category-options', 'Inventory UI category datalist');

  assertNotIncludes(schema, 'model InventoryCategory', 'Separate inventory category table');
  assertNotIncludes(schema, 'model InventoryUnit', 'Separate inventory unit table');
  assertNotIncludes(inventorySource, 'RECIPE_CONSUMPTION', 'Inventory unit/category polish recipe consumption logic');
  assertNotIncludes(inventorySource, 'SUPPLIER_REQUESTS', 'Inventory unit/category polish supplier request logic');
  assertNotIncludes(inventorySource, 'automaticStockDeduction', 'Inventory unit/category polish automatic deduction logic');
  assertIncludes(readme, 'Inventory unit/category polish added.', 'README inventory unit/category polish note');
  assertIncludes(readme, 'No recipe consumption or automatic deduction has been added.', 'README inventory unit/category limitation');
}

function checkRecipeIngredientMappingFoundation() {
  const schema = read('prisma/schema.prisma');
  const features = read('src/lib/features.js');
  const helperPath = path.join(root, 'src/lib/recipes.js');
  const pagePath = path.join(root, 'src/app/admin/(protected)/recipes/page.jsx');
  const clientPath = path.join(root, 'src/app/admin/(protected)/recipes/RecipesClient.jsx');
  const menuItemsRoutePath = path.join(root, 'src/app/api/admin/recipes/menu-items/route.js');
  const ingredientsRoutePath = path.join(root, 'src/app/api/admin/recipes/ingredients/route.js');
  const ingredientRoutePath = path.join(root, 'src/app/api/admin/recipes/ingredients/[id]/route.js');
  const adminShell = read('src/app/admin/components/AdminShell.jsx');
  const orderRoute = read('src/app/api/orders/route.js');
  const assistedRoute = read('src/app/api/admin/orders/assisted/route.js');
  const readme = read('README.md');

  assertIncludes(schema, 'model MenuItemIngredient', 'MenuItemIngredient Prisma model');
  assertIncludes(schema, 'menuItemId', 'MenuItemIngredient menuItemId field');
  assertIncludes(schema, 'inventoryItemId', 'MenuItemIngredient inventoryItemId field');
  assertIncludes(schema, 'quantity', 'MenuItemIngredient quantity field');
  assertIncludes(schema, 'unit', 'MenuItemIngredient unit field');
  assertIncludes(schema, '@@index([menuItemId])', 'MenuItemIngredient menuItemId index');
  assertIncludes(schema, '@@index([inventoryItemId])', 'MenuItemIngredient inventoryItemId index');
  assertIncludes(schema, '@@unique([menuItemId, inventoryItemId])', 'MenuItemIngredient unique menu/inventory mapping');
  assertIncludes(schema, 'ingredients MenuItemIngredient[]', 'MenuItem recipe ingredient relation');
  assertIncludes(schema, 'recipeIngredients MenuItemIngredient[]', 'InventoryItem recipe ingredient relation');

  const defaultBlockMatch = features.match(/const DEFAULT_ENABLED_FEATURES = Object\.freeze\(\[([\s\S]*?)\]\);/);
  assert(defaultBlockMatch, 'Default enabled features block not found for recipe check');
  assertNotIncludes(defaultBlockMatch[1], 'FEATURE_KEYS.RECIPE_CONSUMPTION', 'RECIPE_CONSUMPTION default enabled features');

  assert(fs.existsSync(helperPath), 'Recipe helper is missing');
  assert(fs.existsSync(pagePath), 'Admin recipes page is missing');
  assert(fs.existsSync(clientPath), 'Admin recipes client is missing');
  assert(fs.existsSync(menuItemsRoutePath), 'Recipe menu-items API route is missing');
  assert(fs.existsSync(ingredientsRoutePath), 'Recipe ingredients API route is missing');
  assert(fs.existsSync(ingredientRoutePath), 'Recipe ingredient item API route is missing');

  const helper = read('src/lib/recipes.js');
  const page = read('src/app/admin/(protected)/recipes/page.jsx');
  const client = read('src/app/admin/(protected)/recipes/RecipesClient.jsx');
  const menuItemsRoute = read('src/app/api/admin/recipes/menu-items/route.js');
  const ingredientsRoute = read('src/app/api/admin/recipes/ingredients/route.js');
  const ingredientRoute = read('src/app/api/admin/recipes/ingredients/[id]/route.js');
  const recipeSource = [helper, page, client, menuItemsRoute, ingredientsRoute, ingredientRoute].join('\n');

  assertIncludes(helper, 'normalizeMenuItemIngredient', 'Recipe helper normalizeMenuItemIngredient');
  assertIncludes(helper, 'validateRecipeIngredientQuantity', 'Recipe helper quantity validation');
  assertIncludes(helper, 'normalizeRecipeIngredientUnit', 'Recipe helper unit normalization');
  assertIncludes(helper, 'normalizeInventoryUnit', 'Recipe helper inventory unit normalization reuse');

  for (const [route, label] of [
    [menuItemsRoute, 'Recipe menu-items API'],
    [ingredientsRoute, 'Recipe ingredients API'],
    [ingredientRoute, 'Recipe ingredient item API'],
  ]) {
    assertIncludes(route, 'FEATURE_KEYS.RECIPE_CONSUMPTION', `${label} feature key`);
    assertIncludes(route, 'getRestaurantProfile', `${label} profile loading`);
    assertIncludes(route, 'requireFeatureEnabled', `${label} feature enforcement`);
  }

  assertIncludes(menuItemsRoute, "requireRecipeFeature(request, ['ADMIN', 'MANAGER', 'SUPPORT'])", 'Recipe menu-items API SUPPORT view access');
  assertIncludes(ingredientsRoute, "requireRecipeFeature(request, ['ADMIN', 'MANAGER', 'SUPPORT'])", 'Recipe ingredients API SUPPORT view access');
  assertIncludes(ingredientsRoute, "requireRecipeFeature(request, ['ADMIN', 'MANAGER'])", 'Recipe ingredients API manage access');
  assertIncludes(ingredientRoute, "requireRecipeFeature(request, ['ADMIN', 'MANAGER'])", 'Recipe ingredient item API manage access');
  assertIncludes(ingredientsRoute, 'quantity: z.coerce.number().positive()', 'Recipe ingredient positive quantity validation');
  assertIncludes(ingredientsRoute, 'normalizeRecipeIngredientUnit(parsed.data.unit)', 'Recipe ingredient create unit normalization');
  assertIncludes(ingredientRoute, 'normalizeRecipeIngredientUnit(parsed.data.unit)', 'Recipe ingredient update unit normalization');
  assertIncludes(ingredientsRoute, 'isActive: true', 'Recipe ingredient active inventory guard');
  assertIncludes(ingredientsRoute, 'prisma.menuItem.findUnique', 'Recipe ingredient menu item existence check');
  assertIncludes(ingredientsRoute, 'prisma.inventoryItem.findFirst', 'Recipe ingredient inventory item availability check');

  assertIncludes(page, 'FEATURE_KEYS.RECIPE_CONSUMPTION', 'Recipes page feature key');
  assertIncludes(page, 'getFeatureRouteAccess', 'Recipes page module access helper');
  assertIncludes(page, '<ModuleUnavailable', 'Recipes page disabled module state');
  assertIncludes(page, '<RecipesClient />', 'Recipes page enabled client render');
  assertIncludes(client, '/api/admin/recipes/menu-items', 'Recipes UI menu-items API usage');
  assertIncludes(client, '/api/admin/recipes/ingredients', 'Recipes UI ingredients API usage');
  assertIncludes(client, 'This defines recipe usage only. It does not deduct stock yet.', 'Recipes UI no stock deduction copy');
  assertIncludes(client, 'currentStock', 'Recipes UI inventory current stock display');
  assertIncludes(client, 'stockStatusLabel', 'Recipes UI inventory stock status display');
  assertIncludes(adminShell, "'/admin/recipes'", 'Recipes admin navigation');
  assertIncludes(adminShell, "roles: ['ADMIN', 'MANAGER', 'SUPPORT']", 'Recipes admin navigation roles');

  assertNotIncludes(orderRoute, 'MenuItemIngredient', 'Customer order automatic recipe deduction');
  assertNotIncludes(orderRoute, 'inventoryMovement', 'Customer order automatic inventory movement');
  assertNotIncludes(assistedRoute, 'MenuItemIngredient', 'Assisted order automatic recipe deduction');
  assertNotIncludes(assistedRoute, 'inventoryMovement', 'Assisted order automatic inventory movement');
  assertNotIncludes(recipeSource, 'SUPPLIER_REQUESTS', 'Recipe mapping supplier request logic');
  assertNotIncludes(recipeSource, 'costingAnalytics', 'Recipe mapping costing analytics logic');
  assertIncludes(readme, 'Recipe ingredient mapping foundation added.', 'README recipe mapping note');
  assertIncludes(readme, 'No automatic inventory deduction', 'README recipe no deduction limitation');
  assertIncludes(readme, 'no supplier automation', 'README recipe supplier limitation');
  assertIncludes(readme, 'no costing analytics', 'README recipe costing limitation');
}

function checkRecipeMappingUxPolish() {
  const helper = read('src/lib/recipes.js');
  const client = read('src/app/admin/(protected)/recipes/RecipesClient.jsx');
  const menuItemsRoute = read('src/app/api/admin/recipes/menu-items/route.js');
  const orderRoute = read('src/app/api/orders/route.js');
  const assistedRoute = read('src/app/api/admin/orders/assisted/route.js');
  const readme = read('README.md');

  assertIncludes(helper, 'getRecipeMappingCoverage', 'Recipe mapping coverage helper');
  assertIncludes(helper, 'getMenuItemIngredientCount', 'Recipe menu item ingredient count helper');
  assertIncludes(helper, 'hasRecipeMapping', 'Recipe mapped menu item helper');
  assertIncludes(helper, 'mappedMenuItems', 'Recipe mapping coverage mapped count');
  assertIncludes(helper, 'unmappedMenuItems', 'Recipe mapping coverage unmapped count');
  assertIncludes(helper, 'totalIngredientMappings', 'Recipe mapping coverage ingredient count');

  assertIncludes(menuItemsRoute, 'ingredientCount', 'Recipe menu-items API ingredient count');
  assertIncludes(menuItemsRoute, 'hasRecipeMapping', 'Recipe menu-items API mapping flag');

  assertIncludes(client, 'mappingCoverage', 'Recipes UI mapping summary data');
  assertIncludes(client, 'Total menu items', 'Recipes UI total menu items summary');
  assertIncludes(client, 'Mapped menu items', 'Recipes UI mapped menu items summary');
  assertIncludes(client, 'Unmapped menu items', 'Recipes UI unmapped menu items summary');
  assertIncludes(client, 'Total ingredient mappings', 'Recipes UI ingredient mappings summary');
  assertIncludes(client, 'coverageFilter', 'Recipes UI mapped/unmapped filter state');
  assertIncludes(client, "value=\"MAPPED\"", 'Recipes UI mapped filter option');
  assertIncludes(client, "value=\"UNMAPPED\"", 'Recipes UI unmapped filter option');
  assertIncludes(client, 'No ingredients mapped yet', 'Recipes UI selected item empty state');
  assertIncludes(client, 'This defines recipe usage only. It does not deduct stock yet.', 'Recipes UI no stock deduction copy retained');
  assertIncludes(client, 'selectedInventoryItem.stockStatusLabel', 'Recipes UI selected inventory stock status');
  assertIncludes(client, 'selectedInventoryItem.unit', 'Recipes UI selected inventory unit');
  assertIncludes(client, 'unit: editingId ? prev.unit : inventoryItem?.unit || prev.unit', 'Recipes UI default unit from inventory item');

  assertNotIncludes(orderRoute, 'MenuItemIngredient', 'Recipe UX customer order automatic deduction');
  assertNotIncludes(orderRoute, 'inventoryMovement', 'Recipe UX customer order automatic inventory movement');
  assertNotIncludes(assistedRoute, 'MenuItemIngredient', 'Recipe UX assisted order automatic deduction');
  assertNotIncludes(assistedRoute, 'inventoryMovement', 'Recipe UX assisted order automatic inventory movement');
  assertIncludes(readme, 'Recipe mapping UX and coverage summary added.', 'README recipe mapping UX note');
  assertIncludes(readme, 'No automatic deduction', 'README recipe UX no deduction limitation');
  assertIncludes(readme, 'no supplier automation', 'README recipe UX supplier limitation');
  assertIncludes(readme, 'no costing analytics', 'README recipe UX costing limitation');
}

function checkRecipeConsumptionDryRun() {
  const helper = read('src/lib/recipes.js');
  const routePath = path.join(root, 'src/app/api/admin/orders/[id]/recipe-consumption-preview/route.js');
  const ordersClient = read('src/app/admin/(protected)/orders/OrdersClient.jsx');
  const recipesClient = read('src/app/admin/(protected)/recipes/RecipesClient.jsx');
  const readme = read('README.md');

  assertIncludes(helper, 'calculateRecipeConsumptionForOrder', 'Recipe consumption dry-run order helper');
  assertIncludes(helper, 'aggregateRecipeConsumption', 'Recipe consumption aggregate helper');
  assertIncludes(helper, 'normalizeRecipeConsumptionLine', 'Recipe consumption line normalizer');
  assertIncludes(helper, 'totalRequiredQuantity', 'Recipe consumption total required quantity');
  assertIncludes(helper, 'missingMapping', 'Recipe consumption missing mapping flag');

  assert(fs.existsSync(routePath), 'Recipe consumption preview API route is missing');
  const route = read('src/app/api/admin/orders/[id]/recipe-consumption-preview/route.js');

  assertIncludes(route, "await requireAdmin(request, ['ADMIN', 'MANAGER', 'SUPPORT'])", 'Recipe preview API role guard');
  assertIncludes(route, 'FEATURE_KEYS.RECIPE_CONSUMPTION', 'Recipe preview API feature key');
  assertIncludes(route, 'getRestaurantProfile', 'Recipe preview API profile loading');
  assertIncludes(route, 'requireFeatureEnabled', 'Recipe preview API feature enforcement');
  assertIncludes(route, 'prisma.order.findUnique', 'Recipe preview API order lookup');
  assertIncludes(route, 'include: { items: true }', 'Recipe preview API order items include');
  assertIncludes(route, 'prisma.menuItemIngredient.findMany', 'Recipe preview API recipe mapping lookup');
  assertIncludes(route, 'include: { inventoryItem: true }', 'Recipe preview API inventory item include');
  assertIncludes(route, 'calculateRecipeConsumptionForOrder', 'Recipe preview API dry-run helper usage');
  assertNotIncludes(route, 'inventoryMovement.create', 'Recipe preview API inventory movement creation');
  assertNotIncludes(route, 'inventoryItem.update', 'Recipe preview API inventory stock update');

  assertIncludes(ordersClient, 'Recipe preview', 'Admin orders UI recipe preview action');
  assertIncludes(ordersClient, 'recipePreview', 'Admin orders UI recipe preview state');
  assertIncludes(ordersClient, 'recipe-consumption-preview', 'Admin orders UI recipe preview API usage');
  assertIncludes(ordersClient, 'would be consumed', 'Admin orders UI dry-run copy');
  assertIncludes(ordersClient, 'No inventory is deducted', 'Admin orders UI no deduction copy');
  assertIncludes(ordersClient, 'missingMapping', 'Admin orders UI missing mapping display');
  assertIncludes(recipesClient, 'previewed from orders', 'Admin recipes UI preview copy');

  assertIncludes(readme, 'Recipe consumption dry-run added.', 'README recipe dry-run note');
  assertIncludes(readme, 'No automatic stock deduction', 'README recipe dry-run no deduction');
  assertIncludes(readme, 'no inventory movement creation', 'README recipe dry-run no movement');
  assertIncludes(readme, 'no supplier automation', 'README recipe dry-run supplier limitation');
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
  checkWaiterAssistedOrderingFoundation,
  checkOrderStatusWorkflowRefinement,
  checkKitchenQueueFoundation,
  checkModuleAccessPolish,
  checkInventoryFoundation,
  checkInventoryLowStockUxFilters,
  checkInventoryUnitCategoryPolish,
  checkRecipeIngredientMappingFoundation,
  checkRecipeMappingUxPolish,
  checkRecipeConsumptionDryRun,
];

for (const check of checks) {
  check();
}

console.log(`Smoke hardening checks passed (${checks.length} groups).`);
