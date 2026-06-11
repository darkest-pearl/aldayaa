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

const RESTAURANT_CONTENT_CONFIG_MODELS = [
  'RestaurantProfile',
  'RestaurantSettings',
  'MenuCategory',
  'MenuItem',
  'GalleryCategory',
  'Photo',
  'Announcement',
  'RestaurantTable',
];

const RESTAURANT_OPERATIONAL_SCOPE_MODELS = [
  'Reservation',
  'Order',
  'OrderItem',
  'InventoryItem',
  'InventoryMovement',
  'MenuItemIngredient',
  'OrderRecipeConsumption',
];

const RESTAURANT_UNSCOPED_OPERATIONAL_MODELS = [
  'AdminUser',
  'GatewayLead',
];

function getModelBlock(schema, modelName) {
  const match = schema.match(new RegExp(`model ${modelName} \\{[\\s\\S]*?\\n\\}`));
  assert(match, `${modelName} model block is missing`);
  return match[0];
}

function assertOperationalTablesAreNotRestaurantScoped(schema, label) {
  for (const modelName of RESTAURANT_UNSCOPED_OPERATIONAL_MODELS) {
    const modelBlock = getModelBlock(schema, modelName);
    assertNotIncludes(modelBlock, 'restaurantId', `${label} ${modelName}`);
  }
}

function getExportedFunctionSource(source, functionName) {
  const marker = `export async function ${functionName}`;
  const start = source.indexOf(marker);
  assert(start >= 0, `${functionName} function is missing`);
  const next = source.indexOf('\nexport async function ', start + marker.length);
  return next >= 0 ? source.slice(start, next) : source.slice(start);
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
  assertIncludes(cancelRoute, 'withDemoRestaurantWhere({ reference })', 'Reservation cancellation demo-scoped reference lookup');
  assertIncludes(cancelRoute, 'prisma.reservation.findFirst', 'Reservation cancellation should not use global unique reference lookup');
  assertNotIncludes(cancelRoute, 'findUnique({ where: { reference } })', 'Reservation cancellation must not use global reference findUnique');
  assertIncludes(cancelRoute, 'reservation.phone !== phone', 'Reservation cancellation phone match');
  assertIncludes(cancelRoute, 'prisma.reservation.updateMany', 'Reservation cancellation mutation is demo-scoped');
  assertIncludes(cancelRoute, 'withDemoRestaurantWhere({ id: reservation.id })', 'Reservation cancellation scoped mutation');
  assertIncludes(cancelRoute, 'updated.count !== 1', 'Reservation cancellation checks scoped update count');
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

function checkBusinessGatewayFoundation() {
  const rootPage = read('src/app/page.js');
  const schema = read('prisma/schema.prisma');
  const packageJson = read('package.json');
  const readme = read('README.md');
  const leadFormPath = path.join(root, 'src/components/GatewayLeadForm.jsx');
  const leadApiPath = path.join(root, 'src/app/api/gateway/leads/route.js');
  const publicPagePath = path.join(root, 'src/app/public/page.js');

  assert(fs.existsSync(publicPagePath), '/public restaurant app page is missing');
  assertNotIncludes(rootPage, 'redirect("/public")', 'Root gateway page redirect');
  assertIncludes(rootPage, 'Restaurant automation system', 'Root gateway hero copy');
  assertIncludes(rootPage, 'href="/public"', 'Root gateway live demo link');
  assertIncludes(rootPage, 'digital menus', 'Root gateway product module copy');
  assertIncludes(rootPage, 'QR table', 'Root gateway QR module copy');
  assertIncludes(rootPage, 'inventory', 'Root gateway inventory module copy');
  assertIncludes(rootPage, 'Starter', 'Root gateway package placeholder');
  assertIncludes(rootPage, 'Operations', 'Root gateway package placeholder');
  assertIncludes(rootPage, 'Advanced / Custom', 'Root gateway package placeholder');
  assertIncludes(rootPage, 'GatewayLeadForm', 'Root gateway lead form usage');

  assert(fs.existsSync(leadFormPath), 'Gateway lead form component is missing');
  const leadForm = read('src/components/GatewayLeadForm.jsx');
  assertIncludes(leadForm, 'restaurantName', 'Gateway lead form restaurant field');
  assertIncludes(leadForm, 'contactName', 'Gateway lead form contact field');
  assertIncludes(leadForm, 'phone', 'Gateway lead form phone field');
  assertIncludes(leadForm, 'interestedModules', 'Gateway lead form interested modules field');
  assertIncludes(leadForm, '/api/gateway/leads', 'Gateway lead form API submit');

  assertIncludes(schema, 'model GatewayLead', 'GatewayLead Prisma model');
  assertIncludes(schema, 'restaurantName', 'GatewayLead restaurant field');
  assertIncludes(schema, 'interestedModules', 'GatewayLead interested modules field');
  assert(fs.existsSync(leadApiPath), 'Gateway lead API route is missing');
  const leadApi = read('src/app/api/gateway/leads/route.js');
  assertIncludes(leadApi, 'leadSchema.safeParse', 'Gateway lead API validation');
  assertIncludes(leadApi, 'prisma.gatewayLead.create', 'Gateway lead API persistence');
  assertIncludes(leadApi, 'failure(', 'Gateway lead API error response');

  assertNotIncludes(packageJson, '"stripe"', 'Stripe dependency');
  assert(!fs.existsSync(path.join(root, 'src/app/api/billing')), 'Billing API route should not exist yet');
  assert(!fs.existsSync(path.join(root, 'src/app/api/provisioning')), 'Provisioning API route should not exist yet');
  assertOperationalTablesAreNotRestaurantScoped(schema, 'Business gateway foundation operational tenant scope');
  assertIncludes(readme, 'Business gateway foundation added at `/`.', 'README business gateway note');
  assertIncludes(readme, '`/public` remains the live demo restaurant website.', 'README public demo note');
  assertIncludes(readme, 'No payments, subscriptions, automatic restaurant provisioning, or multi-tenant database model', 'README gateway scope limits');
}

function checkGatewayLeadFormUxPolish() {
  const packageJson = read('package.json');
  const schema = read('prisma/schema.prisma');
  const readme = read('README.md');
  const rootPage = read('src/app/page.js');
  const leadForm = read('src/components/GatewayLeadForm.jsx');
  const leadApi = read('src/app/api/gateway/leads/route.js');
  const adminClient = read('src/app/platform-admin/(protected)/leads/GatewayLeadsClient.jsx');
  const gatewayPolishSource = [rootPage, leadForm, leadApi, adminClient].join('\n');

  assertIncludes(leadForm, 'companyWebsite', 'Gateway lead form honeypot field');
  assertIncludes(leadForm, 'aria-hidden="true"', 'Gateway lead form hidden honeypot');
  assertIncludes(leadForm, 'tabIndex={-1}', 'Gateway lead form honeypot skipped by keyboard');
  assertIncludes(leadForm, 'fieldErrors', 'Gateway lead form field-level validation state');
  assertIncludes(leadForm, 'validateForm', 'Gateway lead form client validation helper');
  assertIncludes(leadForm, 'if (submitting) return;', 'Gateway lead form duplicate submission guard');
  assertIncludes(leadForm, 'Request received', 'Gateway lead form success state');
  assertIncludes(leadForm, 'next step', 'Gateway lead form next-step success copy');
  assertIncludes(leadForm, 'setForm(initialForm)', 'Gateway lead form clears after success');
  assertIncludes(leadForm, "setFieldErrors({})", 'Gateway lead form clears validation after success');

  assertIncludes(leadApi, 'companyWebsite', 'Gateway lead API honeypot field');
  assertIncludes(leadApi, 'isLikelyBotSubmission', 'Gateway lead API honeypot check');
  assertIncludes(leadApi, 'return success({ lead: null }, { status: 201 })', 'Gateway lead API silent bot response');
  assertIncludes(leadApi, 'cleanRequiredString', 'Gateway lead API required field trimming');
  assertIncludes(leadApi, 'cleanOptionalString', 'Gateway lead API optional field trimming');
  assertIncludes(leadApi, 'normalizePhone', 'Gateway lead API phone normalization');
  assertIncludes(leadApi, 'normalizeEmail', 'Gateway lead API email normalization');
  assertIncludes(leadApi, 'normalizeInterestedModules', 'Gateway lead API interested modules normalization');
  assertIncludes(leadApi, '.max(12)', 'Gateway lead API interested modules count cap');
  assertIncludes(leadApi, '.max(80)', 'Gateway lead API interested module length cap');
  assertIncludes(leadApi, 'leadSchema.safeParse', 'Gateway lead API Zod validation retained');
  assertIncludes(leadApi, 'failure(', 'Gateway lead API consistent failure response');

  assertIncludes(rootPage, 'Demo Restaurant is the live demo', 'Gateway page live demo clarity');
  assertIncludes(rootPage, 'example packages', 'Gateway page example package clarity');
  assertIncludes(rootPage, 'not final pricing', 'Gateway page placeholder pricing clarity');
  assertIncludes(rootPage, 'Tell us what to customize', 'Gateway page customization request clarity');

  assertIncludes(adminClient, 'No gateway leads match these filters.', 'Gateway leads admin filter empty state');
  assertIncludes(adminClient, 'max-h-40 overflow-y-auto', 'Gateway leads admin long message readability');
  assertIncludes(adminClient, 'copyToClipboard', 'Gateway leads admin copy convenience');

  for (const unexpected of ['captcha', 'recaptcha', 'hcaptcha']) {
    assert(!packageJson.toLowerCase().includes(unexpected), `Captcha dependency should not be added: ${unexpected}`);
    assert(!gatewayPolishSource.toLowerCase().includes(unexpected), `Captcha source should not be added: ${unexpected}`);
  }

  assert(!fs.existsSync(path.join(root, 'src/app/api/billing')), 'Gateway lead polish should not add billing API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/payments')), 'Gateway lead polish should not add payments API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/provisioning')), 'Gateway lead polish should not add provisioning API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/crm')), 'Gateway lead polish should not add CRM API route');
  assertOperationalTablesAreNotRestaurantScoped(schema, 'Gateway lead polish operational tenant scope');
  assertNotIncludes(gatewayPolishSource, 'sendMail', 'Gateway lead polish email sending');
  assertNotIncludes(gatewayPolishSource, 'nodemailer', 'Gateway lead polish nodemailer usage');
  assertNotIncludes(gatewayPolishSource, 'sendWhatsApp', 'Gateway lead polish WhatsApp sending');
  assertNotIncludes(gatewayPolishSource, 'createRestaurant', 'Gateway lead polish provisioning logic');
  assertNotIncludes(gatewayPolishSource, 'stripe.checkout', 'Gateway lead polish payment logic');

  assertIncludes(readme, 'Gateway lead form UX polish and anti-spam foundation added.', 'README gateway lead polish note');
  assertIncludes(readme, 'Honeypot only; no captcha', 'README gateway lead honeypot-only note');
  assertIncludes(readme, 'No email/WhatsApp sending yet', 'README gateway lead polish no sending note');
  assertIncludes(readme, 'No CRM automation yet', 'README gateway lead polish no CRM note');
  assertIncludes(readme, 'No payments/subscriptions/provisioning yet', 'README gateway lead polish no payments note');
}

function checkGatewayPackagePricingPolish() {
  const packageJson = read('package.json');
  const schema = read('prisma/schema.prisma');
  const readme = read('README.md');
  const rootPage = read('src/app/page.js');
  const leadForm = read('src/components/GatewayLeadForm.jsx');
  const leadApi = read('src/app/api/gateway/leads/route.js');
  const packagePricingSource = [rootPage, leadForm, leadApi].join('\n');

  for (const label of [
    'Starter',
    'Operations',
    'Advanced / Custom',
    'Target restaurant type',
    'Included modules',
    'Best for',
    'Implementation style',
    'Custom quote',
    'Request Starter',
    'Request Operations',
    'Request Advanced / Custom',
  ]) {
    assertIncludes(rootPage, label, `Gateway package pricing copy ${label}`);
  }

  for (const moduleName of [
    'Public website/menu',
    'Reservation/contact flows',
    'Online ordering',
    'QR table ordering',
    'Waiter-assisted ordering',
    'Kitchen queue',
    'Inventory management',
    'Recipe/stock deduction foundation',
    'Custom workflows',
  ]) {
    assertIncludes(rootPage, moduleName, `Gateway package comparison module ${moduleName}`);
  }

  assertIncludes(rootPage, 'Package comparison', 'Gateway package comparison section');
  assertIncludes(rootPage, 'overflow-x-auto', 'Gateway package comparison mobile readability');
  assertIncludes(rootPage, 'packages are examples for discussion', 'Gateway package presentation scope copy');
  assertIncludes(rootPage, 'final scope and price are confirmed after a demo', 'Gateway package final pricing clarity');
  assertIncludes(rootPage, 'restaurants can mix modules', 'Gateway package module mix clarity');
  assertIncludes(rootPage, 'not self-serve billing', 'Gateway package no self-serve billing copy');
  assertIncludes(rootPage, '?package=STARTER#request-demo', 'Gateway Starter CTA package preselection');
  assertIncludes(rootPage, '?package=OPERATIONS#request-demo', 'Gateway Operations CTA package preselection');
  assertIncludes(rootPage, '?package=ADVANCED_CUSTOM#request-demo', 'Gateway Advanced CTA package preselection');
  assertIncludes(rootPage, 'initialPackageInterest', 'Gateway page passes package interest to lead form');

  assertIncludes(leadForm, 'packageInterest', 'Gateway lead form package interest field');
  assertIncludes(leadForm, 'PACKAGE_INTEREST_OPTIONS', 'Gateway lead form package interest options');
  assertIncludes(leadForm, 'getPackageModuleDefaults', 'Gateway lead form package module preselection');
  assertIncludes(leadForm, 'createInitialForm(initialPackageInterest)', 'Gateway lead form initial package selection');
  assertIncludes(leadForm, 'selectedPackageLabel', 'Gateway lead form selected package label');
  assertIncludes(leadForm, 'Request the package or module mix', 'Gateway lead form package field copy');

  assertIncludes(leadApi, 'packageInterest', 'Gateway lead API package interest field');
  assertIncludes(leadApi, 'PACKAGE_INTEREST_LABELS', 'Gateway lead API package labels');
  assertIncludes(leadApi, 'getPackageInterestModuleLabel', 'Gateway lead API package module label helper');
  assertIncludes(leadApi, 'Package: Starter', 'Gateway lead API Starter package storage label');
  assertIncludes(leadApi, 'normalizeInterestedModules(data.interestedModules, data.packageInterest)', 'Gateway lead API stores package interest in modules');

  assertNotIncludes(packageJson, '"stripe"', 'Gateway package pricing Stripe dependency');
  assert(!fs.existsSync(path.join(root, 'src/app/api/billing')), 'Gateway package pricing should not add billing API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/payments')), 'Gateway package pricing should not add payments API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/subscriptions')), 'Gateway package pricing should not add subscriptions API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/provisioning')), 'Gateway package pricing should not add provisioning API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/crm')), 'Gateway package pricing should not add CRM API route');
  assertOperationalTablesAreNotRestaurantScoped(schema, 'Gateway package pricing operational tenant scope');
  assertNotIncludes(packagePricingSource, 'stripe.checkout', 'Gateway package pricing checkout logic');
  assertNotIncludes(packagePricingSource, 'createRestaurant', 'Gateway package pricing provisioning logic');
  assertNotIncludes(packagePricingSource, 'sendMail', 'Gateway package pricing email sending');
  assertNotIncludes(packagePricingSource, 'sendWhatsApp', 'Gateway package pricing WhatsApp sending');

  assertIncludes(readme, 'Gateway package/pricing presentation polish added.', 'README gateway package pricing polish note');
  assertIncludes(readme, 'Packages are presentation/lead-capture only', 'README package presentation-only note');
  assertIncludes(readme, 'No payment/subscription/billing logic yet', 'README package no billing note');
  assertIncludes(readme, 'No automatic provisioning yet', 'README package no provisioning note');
}

function checkProductionRouteQaVerification() {
  const packageJson = read('package.json');
  const schema = read('prisma/schema.prisma');
  const readme = read('README.md');

  const routePaths = [
    ['src/app/page.js', '/ gateway page'],
    ['src/app/public/page.js', '/public demo restaurant page'],
    ['src/app/admin/page.js', '/admin restaurant admin entry'],
    ['src/app/admin/(protected)/layout.js', '/admin protected restaurant admin layout'],
    ['src/app/admin/(auth)/login/page.js', '/admin/login page'],
    ['src/app/platform-admin/(protected)/page.js', '/platform-admin dashboard page'],
    ['src/app/platform-admin/(protected)/leads/page.jsx', '/platform-admin/leads page'],
    ['src/app/platform-admin/(protected)/demo-restaurant/page.jsx', '/platform-admin/demo-restaurant page'],
    ['src/app/api/gateway/leads/route.js', '/api/gateway/leads route'],
    ['src/app/api/admin/gateway-leads/route.js', '/api/admin/gateway-leads route'],
    ['src/app/api/platform/demo-profile/reset/route.js', '/api/platform/demo-profile/reset route'],
    ['src/app/admin/(protected)/gateway-leads/page.jsx', '/admin/gateway-leads redirect page'],
  ];

  for (const [routePath, label] of routePaths) {
    assert(fs.existsSync(path.join(root, routePath)), `${label} is missing`);
  }

  const rootPage = read('src/app/page.js');
  const publicPage = read('src/app/public/page.js');
  const adminLayout = read('src/app/admin/(protected)/layout.js');
  const platformLayout = read('src/app/platform-admin/(protected)/layout.js');
  const adminShell = read('src/app/admin/components/AdminShell.jsx');
  const platformShell = read('src/app/platform-admin/components/PlatformAdminShell.jsx');
  const adminGatewayRedirect = read('src/app/admin/(protected)/gateway-leads/page.jsx');
  const publicLeadApi = read('src/app/api/gateway/leads/route.js');
  const adminLeadApi = read('src/app/api/admin/gateway-leads/route.js');
  const demoResetApi = read('src/app/api/platform/demo-profile/reset/route.js');
  const publicHomeClient = read('src/app/public/HomeClient.jsx');

  assertIncludes(platformLayout, 'getAdminFromRequest(cookies())', 'Platform admin logged-in check');
  assertIncludes(platformLayout, "redirect('/admin/login')", 'Platform admin unauthenticated redirect');
  assertIncludes(platformLayout, "admin.role !== 'ADMIN'", 'Platform admin ADMIN-only role check');
  assertIncludes(platformLayout, "redirect('/admin/dashboard')", 'Platform admin non-ADMIN redirect');

  assertIncludes(adminLayout, 'getAdminFromRequest(cookies())', 'Restaurant admin logged-in check');
  assertIncludes(adminLayout, "redirect('/admin/login')", 'Restaurant admin unauthenticated redirect');
  assertIncludes(adminShell, "roles: ['ADMIN', 'MANAGER']", 'Restaurant admin manager role navigation support');
  assertIncludes(adminShell, "roles: ['ADMIN', 'MANAGER', 'SUPPORT']", 'Restaurant admin support role navigation support');
  assertIncludes(adminShell, "admin.role === 'SUPPORT'", 'Restaurant admin support filtering logic');
  assertIncludes(adminShell, "admin.role === 'MANAGER'", 'Restaurant admin manager filtering logic');

  assertNotIncludes(adminShell, "href: '/admin/gateway-leads'", 'Restaurant admin Gateway Leads nav route');
  assertNotIncludes(adminShell, "label: 'Gateway Leads'", 'Restaurant admin Gateway Leads nav label');
  assertIncludes(platformShell, "href: '/platform-admin/leads'", 'Platform admin Gateway Leads nav route');
  assertIncludes(platformShell, "label: 'Gateway Leads'", 'Platform admin Gateway Leads nav label');
  assertIncludes(adminGatewayRedirect, "redirect('/platform-admin/leads')", '/admin/gateway-leads redirect target');

  assertIncludes(demoResetApi, "await requireAdmin(request, ['ADMIN'])", 'Platform demo reset API ADMIN-only guard');
  assertNotIncludes(demoResetApi, "'MANAGER'", 'Platform demo reset API manager access');
  assertNotIncludes(demoResetApi, "'SUPPORT'", 'Platform demo reset API support access');
  assertIncludes(adminLeadApi, "await requireAdmin(request, ['ADMIN'])", 'Gateway lead admin API ADMIN-only guard');

  assertNotIncludes(publicLeadApi, 'requireAdmin', 'Public gateway lead API admin guard');
  assertIncludes(publicLeadApi, 'leadSchema.safeParse', 'Public gateway lead API validation');
  assertIncludes(publicLeadApi, 'companyWebsite', 'Public gateway lead API honeypot field');
  assertIncludes(publicLeadApi, 'isLikelyBotSubmission', 'Public gateway lead API honeypot guard');
  assertIncludes(publicLeadApi, 'packageInterest', 'Public gateway lead API package interest support');

  for (const forbidden of [
    "href: '/platform-admin/packages'",
    "href: '/platform-admin/client-restaurants'",
    "href: '/platform-admin/settings'",
    "label: 'Packages'",
    "label: 'Client Restaurants'",
    "label: 'Platform Settings'",
  ]) {
    assertNotIncludes(adminShell, forbidden, `Restaurant admin shell platform contamination ${forbidden}`);
  }

  for (const forbidden of [
    "label: 'Menu'",
    "label: 'Orders'",
    "label: 'Kitchen'",
    "label: 'Inventory'",
    "label: 'Recipes'",
    "label: 'Tables'",
    "href: '/admin/menu'",
    "href: '/admin/orders'",
    "href: '/admin/kitchen'",
    "href: '/admin/inventory'",
    "href: '/admin/recipes'",
    "href: '/admin/tables'",
  ]) {
    assertNotIncludes(platformShell, forbidden, `Platform admin shell restaurant operations contamination ${forbidden}`);
  }

  assertIncludes(rootPage, 'href="/public"', 'Public gateway demo restaurant link');
  assertIncludes(rootPage, '?package=STARTER#request-demo', 'Public gateway Starter package CTA route');
  assertIncludes(rootPage, '?package=OPERATIONS#request-demo', 'Public gateway Operations package CTA route');
  assertIncludes(rootPage, '?package=ADVANCED_CUSTOM#request-demo', 'Public gateway Advanced package CTA route');
  assertIncludes(rootPage, '<GatewayLeadForm initialPackageInterest={initialPackageInterest} />', 'Public gateway package interest handoff to form');

  assertIncludes(publicPage, 'getRestaurantProfile()', '/public profile-driven profile read');
  assertIncludes(publicPage, 'toPublicRestaurantProfile(profileRecord)', '/public public profile normalization');
  assertIncludes(publicPage, '<HomeClient recommendedDishes={recommendedDishes} profile={profile} />', '/public profile handoff to client');
  assertIncludes(publicHomeClient, 'profile.restaurantName', '/public client profile restaurant name usage');

  const routeQaSource = [
    rootPage,
    publicPage,
    adminLayout,
    platformLayout,
    adminShell,
    platformShell,
    adminGatewayRedirect,
    publicLeadApi,
    adminLeadApi,
    demoResetApi,
  ].join('\n');

  assertNotIncludes(packageJson, '"stripe"', 'Production route QA Stripe dependency');
  assert(!fs.existsSync(path.join(root, 'src/app/api/billing')), 'Production route QA should not add billing API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/payments')), 'Production route QA should not add payments API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/subscriptions')), 'Production route QA should not add subscriptions API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/provisioning')), 'Production route QA should not add provisioning API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/crm')), 'Production route QA should not add CRM API route');
  assertOperationalTablesAreNotRestaurantScoped(schema, 'Production route QA operational tenant scope');
  assertNotIncludes(routeQaSource, 'stripe.checkout', 'Production route QA checkout logic');
  assertNotIncludes(routeQaSource, 'createRestaurant', 'Production route QA provisioning logic');
  assertNotIncludes(routeQaSource, 'sendMail', 'Production route QA email sending');
  assertNotIncludes(routeQaSource, 'sendWhatsApp', 'Production route QA WhatsApp sending');

  assertIncludes(readme, 'Production route QA smoke coverage added.', 'README production route QA note');
  assertIncludes(readme, 'Source/runtime verification hardening only', 'README production route QA verification-only note');
  assertIncludes(readme, 'No new product feature', 'README production route QA no feature note');
  assertIncludes(readme, 'No billing/provisioning/multi-tenancy', 'README production route QA scope note');
}

function checkPlatformPlaceholderPagePolish() {
  const packageJson = read('package.json');
  const schema = read('prisma/schema.prisma');
  const readme = read('README.md');
  const componentPath = path.join(root, 'src/app/platform-admin/components/PlatformRoadmapPlaceholder.jsx');
  const gatewayWebsitePath = path.join(root, 'src/app/platform-admin/(protected)/gateway-website/page.js');
  const packagesPath = path.join(root, 'src/app/platform-admin/(protected)/packages/page.js');
  const settingsPath = path.join(root, 'src/app/platform-admin/(protected)/settings/page.js');

  assert(fs.existsSync(componentPath), 'Platform roadmap placeholder component is missing');
  assert(fs.existsSync(gatewayWebsitePath), 'Platform gateway website placeholder page is missing');
  assert(fs.existsSync(packagesPath), 'Platform packages placeholder page is missing');
  assert(fs.existsSync(settingsPath), 'Platform settings placeholder page is missing');

  const component = read('src/app/platform-admin/components/PlatformRoadmapPlaceholder.jsx');
  const gatewayWebsite = read('src/app/platform-admin/(protected)/gateway-website/page.js');
  const packages = read('src/app/platform-admin/(protected)/packages/page.js');
  const settings = read('src/app/platform-admin/(protected)/settings/page.js');
  const placeholderSource = [component, gatewayWebsite, packages, settings].join('\n');

  assertIncludes(component, 'Current actions', 'Platform placeholder current actions section');
  assertIncludes(component, 'Future scope', 'Platform placeholder future scope section');
  assertIncludes(component, 'Not implemented yet', 'Platform placeholder scope boundary section');

  for (const expected of [
    'manage public gateway content',
    'Current public gateway is code-managed',
    'View public gateway',
    'View demo restaurant',
    'View gateway leads',
    "href: '/'",
    "href: '/public'",
    "href: '/platform-admin/leads'",
    'edit hero copy',
    'edit package copy',
    'manage FAQ',
    'manage public CTA text',
    'No CMS/editor has been added yet',
  ]) {
    assertIncludes(gatewayWebsite, expected, `Gateway Website placeholder copy ${expected}`);
  }

  for (const expected of [
    'manage package definitions and module bundles',
    'Current package content is code-managed on the public gateway',
    'View public gateway packages',
    'View leads',
    "href: '/#packages'",
    "href: '/platform-admin/leads'",
    'create/edit packages',
    'define module bundles',
    'set pricing display copy',
    'connect to subscription/billing later',
    'No payments/subscriptions/billing logic exists yet',
  ]) {
    assertIncludes(packages, expected, `Packages placeholder copy ${expected}`);
  }

  for (const expected of [
    'control platform-wide settings',
    'Current settings remain code-managed or restaurant-specific',
    'Open demo profile reset',
    'Open restaurant admin settings',
    "href: '/platform-admin/demo-restaurant'",
    "href: '/admin/settings'",
    'platform brand name',
    'gateway contact email/phone',
    'package display defaults',
    'notification preferences later',
    'No email/WhatsApp sending or notification automation exists yet',
  ]) {
    assertIncludes(settings, expected, `Platform Settings placeholder copy ${expected}`);
  }

  assertNotIncludes(packageJson, '"stripe"', 'Platform placeholder polish Stripe dependency');
  assert(!fs.existsSync(path.join(root, 'src/app/api/billing')), 'Platform placeholder polish should not add billing API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/payments')), 'Platform placeholder polish should not add payments API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/subscriptions')), 'Platform placeholder polish should not add subscriptions API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/provisioning')), 'Platform placeholder polish should not add provisioning API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/crm')), 'Platform placeholder polish should not add CRM API route');
  assertOperationalTablesAreNotRestaurantScoped(schema, 'Platform placeholder polish operational tenant scope');
  assertNotIncludes(placeholderSource, 'prisma.', 'Platform placeholder polish database usage');
  assertNotIncludes(placeholderSource, 'sendMail', 'Platform placeholder polish email sending');
  assertNotIncludes(placeholderSource, 'nodemailer', 'Platform placeholder polish nodemailer usage');
  assertNotIncludes(placeholderSource, 'sendWhatsApp', 'Platform placeholder polish WhatsApp sending');
  assertNotIncludes(placeholderSource, 'stripe.checkout', 'Platform placeholder polish payment logic');
  assertNotIncludes(placeholderSource, 'createRestaurant', 'Platform placeholder polish provisioning logic');

  assertIncludes(readme, 'Platform placeholder pages polished.', 'README platform placeholder polish note');
  assertIncludes(readme, 'Roadmap placeholders only.', 'README platform placeholder roadmap-only note');
  assertIncludes(readme, 'No DB models/billing/provisioning/multi-tenancy added.', 'README platform placeholder scope note');
}

function checkMultitenantArchitecturePlan() {
  const schema = read('prisma/schema.prisma');
  const packageJson = read('package.json');
  const readme = read('README.md');
  const planPath = path.join(root, 'docs/MULTITENANT_ARCHITECTURE_PLAN.md');

  assert(fs.existsSync(planPath), 'Multi-tenant architecture planning document is missing');

  const plan = read('docs/MULTITENANT_ARCHITECTURE_PLAN.md');
  for (const expected of [
    'Current state summary',
    'Target architecture',
    'Route strategy',
    'Data ownership mapping',
    'Platform-owned data',
    'Migration strategy',
    'Auth and role strategy',
    'Risk list',
    'Recommended first implementation batch',
    'Batch 33: Add Restaurant model and seed Demo Restaurant without changing runtime behavior',
    'planning only',
    'Do not implement in this batch',
  ]) {
    assertIncludes(plan, expected, `Multi-tenant architecture plan section ${expected}`);
  }

  for (const modelName of [
    'MenuItem',
    'MenuCategory',
    'Photo',
    'Reservation',
    'Order',
    'OrderItem',
    'RestaurantTable',
    'InventoryItem',
    'InventoryMovement',
    'MenuItemIngredient',
    'RestaurantProfile',
    'Announcement',
    'AdminUser',
    'GatewayLead',
  ]) {
    assertIncludes(plan, modelName, `Multi-tenant plan data mapping ${modelName}`);
  }

  assertIncludes(readme, 'Multi-tenant architecture planning document added.', 'README multi-tenant plan note');
  assertIncludes(readme, 'Batch 32 was planning only.', 'README planning-only note');
  assertIncludes(readme, 'At that step, no schema/runtime changes were made.', 'README no schema/runtime note');
  assertIncludes(readme, 'Multi-tenancy was not implemented in Batch 32.', 'README no multi-tenancy implementation note');

  assertIncludes(schema, 'model RestaurantProfile', 'Existing RestaurantProfile model');
  assertOperationalTablesAreNotRestaurantScoped(schema, 'Multi-tenant plan operational tenant scope');
  assert(!fs.existsSync(path.join(root, 'src/app/api/billing')), 'Multi-tenant plan should not add billing API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/payments')), 'Multi-tenant plan should not add payments API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/subscriptions')), 'Multi-tenant plan should not add subscriptions API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/provisioning')), 'Multi-tenant plan should not add provisioning API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/crm')), 'Multi-tenant plan should not add CRM API route');
  assertNotIncludes(packageJson, '"stripe"', 'Multi-tenant plan Stripe dependency');
}

function checkRestaurantTenantAnchorModel() {
  const schema = read('prisma/schema.prisma');
  const packageJson = read('package.json');
  const readme = read('README.md');
  const helperPath = path.join(root, 'src/lib/restaurants.js');
  const migrationPath = path.join(root, 'prisma/migrations/20260604100000_add_restaurant_model/migration.sql');
  const clientRestaurantsPagePath = path.join(root, 'src/app/platform-admin/(protected)/client-restaurants/page.js');

  assertIncludes(schema, 'model Restaurant', 'Restaurant Prisma model');
  const restaurantBlock = getModelBlock(schema, 'Restaurant');
  for (const expected of [
    'id',
    '@id @default(cuid())',
    'name',
    'slug',
    '@unique',
    'status',
    '@default("DEMO")',
    'createdAt',
    '@default(now())',
    'updatedAt',
    '@updatedAt',
  ]) {
    assertIncludes(restaurantBlock, expected, `Restaurant model field ${expected}`);
  }

  assertOperationalTablesAreNotRestaurantScoped(schema, 'Restaurant tenant anchor operational tenant scope');

  assert(fs.existsSync(migrationPath), 'Restaurant model migration is missing');
  const migration = read('prisma/migrations/20260604100000_add_restaurant_model/migration.sql');
  for (const expected of [
    'CREATE TABLE "Restaurant"',
    '"id" TEXT NOT NULL',
    '"name" TEXT NOT NULL',
    '"slug" TEXT NOT NULL',
    '"status" TEXT NOT NULL DEFAULT \'DEMO\'',
    '"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP',
    '"updatedAt" TIMESTAMP(3) NOT NULL',
    'CREATE UNIQUE INDEX "Restaurant_slug_key"',
    'INSERT INTO "Restaurant"',
    'Demo Restaurant',
    'demo-restaurant',
    'ON CONFLICT ("slug") DO UPDATE',
  ]) {
    assertIncludes(migration, expected, `Restaurant model migration ${expected}`);
  }

  assert(fs.existsSync(helperPath), 'Restaurant helper is missing');
  const helper = read('src/lib/restaurants.js');
  for (const expected of [
    'DEMO_RESTAURANT_SLUG',
    "'demo-restaurant'",
    'RESTAURANT_STATUSES',
    'getDemoRestaurantIdentity',
    'normalizeRestaurant',
    'DEMO',
    'ACTIVE',
    'PAUSED',
    'ARCHIVED',
  ]) {
    assertIncludes(helper, expected, `Restaurant helper ${expected}`);
  }

  const clientRestaurantsPage = read('src/app/platform-admin/(protected)/client-restaurants/page.js');
  assertIncludes(clientRestaurantsPage, 'Demo Restaurant tenant anchor', 'Platform client restaurants tenant anchor copy');
  assertIncludes(clientRestaurantsPage, 'Create is limited to Restaurant tenant anchor records', 'Platform client restaurants limited create copy');

  assert(!fs.existsSync(path.join(root, 'src/app/restaurants/[restaurantSlug]')), 'Tenant restaurants slug route should not exist yet');
  assert(!fs.existsSync(path.join(root, 'src/app/api/provisioning')), 'Restaurant tenant anchor should not add provisioning API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/billing')), 'Restaurant tenant anchor should not add billing API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/payments')), 'Restaurant tenant anchor should not add payments API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/subscriptions')), 'Restaurant tenant anchor should not add subscriptions API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/crm')), 'Restaurant tenant anchor should not add CRM API route');
  assertNotIncludes(packageJson, '"stripe"', 'Restaurant tenant anchor Stripe dependency');
  assertNotIncludes(helper, 'sendMail', 'Restaurant helper email sending');
  assertNotIncludes(helper, 'nodemailer', 'Restaurant helper nodemailer usage');
  assertNotIncludes(helper, 'sendWhatsApp', 'Restaurant helper WhatsApp sending');

  assertIncludes(readme, 'Restaurant tenant anchor model added.', 'README restaurant tenant anchor note');
  assertIncludes(readme, 'Demo Restaurant seed exists.', 'README demo restaurant seed note');
  assertIncludes(readme, 'Existing restaurant operations are not tenant-scoped yet.', 'README no tenant-scoped operations note');
  assertIncludes(readme, 'No provisioning or multi-tenant routing yet.', 'README no provisioning routing note');
}

function checkRestaurantIdContentConfigBackfill() {
  const schema = read('prisma/schema.prisma');
  const packageJson = read('package.json');
  const readme = read('README.md');
  const helper = read('src/lib/restaurants.js');
  const migrationPath = path.join(root, 'prisma/migrations/20260604103000_add_restaurant_id_to_content_config/migration.sql');
  const restaurantBlock = getModelBlock(schema, 'Restaurant');
  const relationArrays = {
    RestaurantProfile: 'profiles',
    RestaurantSettings: 'settings',
    MenuCategory: 'menuCategories',
    MenuItem: 'menuItems',
    GalleryCategory: 'galleryCategories',
    Photo: 'photos',
    Announcement: 'announcements',
    RestaurantTable: 'tables',
  };

  for (const modelName of RESTAURANT_CONTENT_CONFIG_MODELS) {
    const modelBlock = getModelBlock(schema, modelName);
    assertIncludes(modelBlock, 'restaurantId', `${modelName} nullable restaurantId field`);
    assertIncludes(modelBlock, 'String?', `${modelName} nullable restaurantId type`);
    assertIncludes(modelBlock, 'Restaurant?', `${modelName} optional Restaurant relation`);
    assertIncludes(modelBlock, '@relation(fields: [restaurantId], references: [id], onDelete: SetNull)', `${modelName} Restaurant relation target`);
    assertIncludes(modelBlock, '@@index([restaurantId])', `${modelName} restaurantId index`);
    assertIncludes(restaurantBlock, relationArrays[modelName], `Restaurant relation array field for ${modelName}`);
    assertIncludes(restaurantBlock, `${modelName}[]`, `Restaurant relation array type for ${modelName}`);
  }

  assertOperationalTablesAreNotRestaurantScoped(schema, 'RestaurantId content/config backfill excluded operational scope');

  assert(fs.existsSync(migrationPath), 'RestaurantId content/config migration is missing');
  const migration = read('prisma/migrations/20260604103000_add_restaurant_id_to_content_config/migration.sql');
  for (const tableName of RESTAURANT_CONTENT_CONFIG_MODELS) {
    assertIncludes(migration, `ALTER TABLE "${tableName}" ADD COLUMN "restaurantId" TEXT`, `${tableName} migration nullable restaurantId column`);
    assertIncludes(migration, `CREATE INDEX "${tableName}_restaurantId_idx"`, `${tableName} migration restaurantId index`);
    assertIncludes(migration, `ALTER TABLE "${tableName}" ADD CONSTRAINT "${tableName}_restaurantId_fkey"`, `${tableName} migration restaurantId foreign key`);
    assertIncludes(migration, `UPDATE "${tableName}"`, `${tableName} migration demo backfill`);
    assertIncludes(migration, `WHERE "restaurantId" IS NULL`, `${tableName} migration null-only backfill`);
  }
  assertIncludes(migration, "WHERE \"id\" = 'demo-restaurant'", 'Migration Demo Restaurant existence guard');
  assertIncludes(migration, 'ON DELETE SET NULL ON UPDATE CASCADE', 'Migration SetNull foreign key behavior');

  for (const excluded of RESTAURANT_UNSCOPED_OPERATIONAL_MODELS) {
    assertNotIncludes(migration, `ALTER TABLE "${excluded}" ADD COLUMN "restaurantId"`, `Excluded ${excluded} migration restaurantId column`);
    assertNotIncludes(migration, `UPDATE "${excluded}"`, `Excluded ${excluded} migration backfill`);
  }

  for (const expected of [
    'DEMO_RESTAURANT_ID',
    'getDemoRestaurantId',
    'getDemoRestaurantWhere',
    "id: DEMO_RESTAURANT_ID",
  ]) {
    assertIncludes(helper, expected, `Restaurant helper content/config ${expected}`);
  }

  const appSource = [
    read('src/app/admin/(protected)/layout.js'),
    read('src/app/platform-admin/(protected)/layout.js'),
    read('src/app/api/admin/settings/route.js'),
    read('src/app/api/admin/announcement/route.js'),
    read('src/app/api/admin/tables/route.js'),
  ].join('\n');
  assertNotIncludes(appSource, 'restaurantId', 'Runtime route/query tenant scoping');
  assert(!fs.existsSync(path.join(root, 'src/app/restaurants/[restaurantSlug]')), 'Tenant restaurants slug route should not exist yet after content/config backfill');
  assert(!fs.existsSync(path.join(root, 'src/app/api/provisioning')), 'RestaurantId content/config should not add provisioning API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/billing')), 'RestaurantId content/config should not add billing API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/payments')), 'RestaurantId content/config should not add payments API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/subscriptions')), 'RestaurantId content/config should not add subscriptions API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/crm')), 'RestaurantId content/config should not add CRM API route');
  assertNotIncludes(packageJson, '"stripe"', 'RestaurantId content/config Stripe dependency');
  assertNotIncludes(helper, 'sendMail', 'Restaurant helper email sending');
  assertNotIncludes(helper, 'nodemailer', 'Restaurant helper nodemailer usage');
  assertNotIncludes(helper, 'sendWhatsApp', 'Restaurant helper WhatsApp sending');

  assertIncludes(readme, 'Nullable restaurantId added to content/config tables.', 'README restaurantId content/config note');
  assertIncludes(readme, 'Existing rows are backfilled to Demo Restaurant.', 'README restaurantId demo backfill note');
  assertIncludes(readme, 'Runtime queries are not tenant-scoped yet.', 'README restaurantId runtime scope note');
  assertIncludes(readme, 'Operational transaction tables are not scoped yet.', 'README restaurantId operational scope note');
  assertIncludes(readme, 'restaurantId is not required yet.', 'README restaurantId nullable note');
}

function checkRestaurantIdOperationalBackfill() {
  const schema = read('prisma/schema.prisma');
  const packageJson = read('package.json');
  const readme = read('README.md');
  const migrationPath = path.join(root, 'prisma/migrations/20260604110000_add_restaurant_id_to_operational_tables/migration.sql');
  const restaurantBlock = getModelBlock(schema, 'Restaurant');
  const relationArrays = {
    Reservation: 'reservations',
    Order: 'orders',
    OrderItem: 'orderItems',
    InventoryItem: 'inventoryItems',
    InventoryMovement: 'inventoryMovements',
    MenuItemIngredient: 'menuItemIngredients',
    OrderRecipeConsumption: 'orderRecipeConsumptions',
  };

  for (const modelName of RESTAURANT_OPERATIONAL_SCOPE_MODELS) {
    const modelBlock = getModelBlock(schema, modelName);
    assertIncludes(modelBlock, 'restaurantId', `${modelName} nullable restaurantId field`);
    assertIncludes(modelBlock, 'String?', `${modelName} nullable restaurantId type`);
    assertIncludes(modelBlock, 'Restaurant?', `${modelName} optional Restaurant relation`);
    assertIncludes(modelBlock, '@relation(fields: [restaurantId], references: [id], onDelete: SetNull)', `${modelName} Restaurant relation target`);
    assertIncludes(modelBlock, '@@index([restaurantId])', `${modelName} restaurantId index`);
    assertIncludes(restaurantBlock, relationArrays[modelName], `Restaurant operational relation array field for ${modelName}`);
    assertIncludes(restaurantBlock, `${modelName}[]`, `Restaurant operational relation array type for ${modelName}`);
  }

  assertOperationalTablesAreNotRestaurantScoped(schema, 'RestaurantId operational backfill excluded scope');

  assert(fs.existsSync(migrationPath), 'RestaurantId operational migration is missing');
  const migration = read('prisma/migrations/20260604110000_add_restaurant_id_to_operational_tables/migration.sql');
  for (const tableName of RESTAURANT_OPERATIONAL_SCOPE_MODELS) {
    assertIncludes(migration, `ALTER TABLE "${tableName}" ADD COLUMN "restaurantId" TEXT`, `${tableName} migration nullable restaurantId column`);
    assertIncludes(migration, `CREATE INDEX "${tableName}_restaurantId_idx"`, `${tableName} migration restaurantId index`);
    assertIncludes(migration, `ALTER TABLE "${tableName}" ADD CONSTRAINT "${tableName}_restaurantId_fkey"`, `${tableName} migration restaurantId foreign key`);
    assertIncludes(migration, `UPDATE "${tableName}"`, `${tableName} migration demo backfill`);
    assertIncludes(migration, `WHERE "restaurantId" IS NULL`, `${tableName} migration null-only backfill`);
  }
  assertIncludes(migration, "WHERE \"id\" = 'demo-restaurant'", 'Operational migration Demo Restaurant existence guard');
  assertIncludes(migration, 'ON DELETE SET NULL ON UPDATE CASCADE', 'Operational migration SetNull foreign key behavior');
  for (const excluded of RESTAURANT_UNSCOPED_OPERATIONAL_MODELS) {
    assertNotIncludes(migration, `ALTER TABLE "${excluded}" ADD COLUMN "restaurantId"`, `Excluded ${excluded} operational migration restaurantId column`);
    assertNotIncludes(migration, `UPDATE "${excluded}"`, `Excluded ${excluded} operational migration backfill`);
  }

  assert(!fs.existsSync(path.join(root, 'src/app/restaurants/[restaurantSlug]')), 'Tenant restaurants slug route should not exist yet after operational backfill');
  assert(!fs.existsSync(path.join(root, 'src/app/api/provisioning')), 'RestaurantId operational should not add provisioning API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/billing')), 'RestaurantId operational should not add billing API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/payments')), 'RestaurantId operational should not add payments API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/subscriptions')), 'RestaurantId operational should not add subscriptions API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/crm')), 'RestaurantId operational should not add CRM API route');
  assertNotIncludes(packageJson, '"stripe"', 'RestaurantId operational Stripe dependency');

  assertIncludes(readme, 'Nullable restaurantId added to operational tables.', 'README restaurantId operational note');
  assertIncludes(readme, 'Existing operational rows are backfilled to Demo Restaurant.', 'README restaurantId operational demo backfill note');
  assertIncludes(readme, 'Runtime queries are still not tenant-scoped.', 'README restaurantId operational runtime scope note');
  assertIncludes(readme, 'AdminUser and GatewayLead are not scoped yet.', 'README restaurantId operational excluded scope note');
  assertIncludes(readme, 'Operational restaurantId is not required yet.', 'README restaurantId operational nullable note');
}

function checkRestaurantContextHelper() {
  const schema = read('prisma/schema.prisma');
  const packageJson = read('package.json');
  const readme = read('README.md');
  const helper = read('src/lib/restaurants.js');
  const platformDashboard = read('src/app/platform-admin/(protected)/page.js');
  const clientRestaurantsPage = read('src/app/platform-admin/(protected)/client-restaurants/page.js');
  const demoRestaurantPage = read('src/app/platform-admin/(protected)/demo-restaurant/page.jsx');

  for (const expected of [
    'DEMO_RESTAURANT_ID',
    'DEMO_RESTAURANT_SLUG',
    "'demo-restaurant'",
    'getDemoRestaurantIdentity',
    'getDemoRestaurantWhere',
    'getRestaurantWhereBySlug',
    'getCurrentDemoRestaurant',
    'ensureDemoRestaurant',
    'normalizeRestaurant',
  ]) {
    assertIncludes(helper, expected, `Restaurant context helper ${expected}`);
  }

  assertIncludes(helper, 'if (!process.env.DATABASE_URL)', 'Restaurant context helper DATABASE_URL fallback branch');
  assertIncludes(helper, 'return getDemoRestaurantIdentity()', 'Restaurant context helper demo identity fallback');
  assertIncludes(helper, 'prisma.restaurant.findFirst', 'Restaurant context helper demo restaurant lookup');
  assertIncludes(helper, 'prisma.restaurant.upsert', 'Restaurant context helper demo restaurant upsert');
  assertIncludes(helper, 'where: getDemoRestaurantWhere()', 'Restaurant context helper ensure where clause');
  assertIncludes(helper, 'slug: DEMO_RESTAURANT_SLUG', 'Restaurant context helper demo slug return');
  assertIncludes(helper, 'id: DEMO_RESTAURANT_ID', 'Restaurant context helper demo id return');

  assertIncludes(platformDashboard, 'getCurrentDemoRestaurant', 'Platform dashboard demo tenant identity lookup');
  assertIncludes(platformDashboard, 'demoRestaurant.name', 'Platform dashboard demo tenant name display');
  assertIncludes(platformDashboard, 'demoRestaurant.slug', 'Platform dashboard demo tenant slug display');
  assertIncludes(clientRestaurantsPage, 'DEMO_RESTAURANT_SLUG', 'Client restaurants registry demo tenant identity reference');
  assertIncludes(clientRestaurantsPage, 'normalizeRestaurant', 'Client restaurants registry restaurant normalization');
  assertIncludes(demoRestaurantPage, 'getCurrentDemoRestaurant', 'Demo restaurant platform page demo tenant identity lookup');
  assertIncludes(demoRestaurantPage, 'initialRestaurant', 'Demo restaurant platform page passes demo tenant identity');

  const publicAdminRuntimeSource = [
    read('src/app/api/orders/route.js'),
    read('src/app/api/reservations/route.js'),
    read('src/app/api/admin/inventory/items/route.js'),
    read('src/app/api/admin/inventory/movements/route.js'),
    read('src/app/api/admin/recipes/ingredients/route.js'),
    read('src/app/api/admin/kitchen/orders/route.js'),
  ].join('\n');
  assertNotIncludes(publicAdminRuntimeSource, 'getCurrentDemoRestaurant', 'Restaurant context helper public/admin broad query usage');
  assertNotIncludes(publicAdminRuntimeSource, 'getRestaurantWhereBySlug', 'Restaurant context helper public/admin slug query usage');
  assertOperationalTablesAreNotRestaurantScoped(schema, 'Restaurant context helper excluded scope');
  assert(!fs.existsSync(path.join(root, 'src/app/restaurants/[restaurantSlug]')), 'Tenant restaurants slug route should not exist yet after restaurant context helper');
  assert(!fs.existsSync(path.join(root, 'src/app/api/provisioning')), 'Restaurant context helper should not add provisioning API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/billing')), 'Restaurant context helper should not add billing API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/payments')), 'Restaurant context helper should not add payments API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/subscriptions')), 'Restaurant context helper should not add subscriptions API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/crm')), 'Restaurant context helper should not add CRM API route');
  assertNotIncludes(packageJson, '"stripe"', 'Restaurant context helper Stripe dependency');
  assertNotIncludes(helper, 'sendMail', 'Restaurant context helper email sending');
  assertNotIncludes(helper, 'nodemailer', 'Restaurant context helper nodemailer usage');
  assertNotIncludes(helper, 'sendWhatsApp', 'Restaurant context helper WhatsApp sending');

  assertIncludes(readme, 'Restaurant context helper added.', 'README restaurant context helper note');
  assertIncludes(readme, 'Helper resolves Demo Restaurant tenant identity.', 'README restaurant context helper identity note');
  assertIncludes(readme, 'Runtime route behavior is not broadly tenant-scoped yet.', 'README restaurant context helper runtime scope note');
  assertIncludes(readme, 'No client restaurant provisioning yet.', 'README restaurant context helper no provisioning note');
}

function checkPublicDemoReadTenantScoping() {
  const packageJson = read('package.json');
  const readme = read('README.md');
  const helper = read('src/lib/restaurants.js');
  const publicHome = read('src/app/public/page.js');
  const publicMenu = read('src/app/public/menu/page.js');
  const publicOrder = read('src/app/public/order/page.js');
  const publicGallery = read('src/app/public/gallery/page.js');
  const publicTable = read('src/app/public/table/[slug]/page.js');
  const menuCategoriesApi = read('src/app/api/menu/categories/route.js');
  const menuItemsApi = read('src/app/api/menu/items/route.js');
  const galleryCategoriesApi = read('src/app/api/gallery/categories/route.js');
  const galleryPhotosApi = read('src/app/api/gallery/photos/route.js');
  const announcementHelper = read('src/lib/announcement.js');
  const profileHelper = read('src/lib/restaurant-profile.js');

  for (const expected of [
    'getDemoRestaurantFilter',
    'getDemoRestaurantOrGlobalWhere',
    'withDemoRestaurantWhere',
    'restaurantId: DEMO_RESTAURANT_ID',
    'restaurantId: null',
  ]) {
    assertIncludes(helper, expected, `Restaurant read scope helper ${expected}`);
  }

  assertIncludes(publicHome, 'withDemoRestaurantWhere({ recommended: true })', 'Public home recommended menu tenant filter');
  assertIncludes(publicMenu, 'withDemoRestaurantWhere()', 'Public menu category tenant filter');
  assertIncludes(publicMenu, 'where: getDemoRestaurantFilter()', 'Public menu item tenant filter');
  assertIncludes(publicOrder, 'withDemoRestaurantWhere()', 'Public order menu category tenant filter');
  assertIncludes(publicOrder, 'where: getDemoRestaurantFilter()', 'Public order menu item tenant filter');
  assertIncludes(publicOrder, 'withDemoRestaurantWhere({ slug, qrToken: tableToken, isActive: true })', 'Public order table lookup tenant filter');
  assertIncludes(publicGallery, 'withDemoRestaurantWhere()', 'Public gallery category tenant filter');
  assertIncludes(publicGallery, 'where: getDemoRestaurantFilter()', 'Public gallery photo tenant filter');
  assertIncludes(publicTable, 'withDemoRestaurantWhere({ slug })', 'Public table lookup tenant filter');
  assertIncludes(publicTable, 'restaurantTable.findFirst', 'Public table lookup no longer uses unique slug only');
  assertIncludes(announcementHelper, 'withDemoRestaurantWhere({ isActive: true })', 'Public active announcement tenant filter');
  assertIncludes(profileHelper, 'where: getDemoRestaurantFilter()', 'Restaurant profile tenant filter');

  assertIncludes(menuCategoriesApi, 'withDemoRestaurantWhere()', 'Menu categories API GET tenant filter');
  assertIncludes(menuCategoriesApi, 'where: getDemoRestaurantFilter()', 'Menu categories API included items tenant filter');
  assertIncludes(menuItemsApi, 'withDemoRestaurantWhere()', 'Menu items API GET tenant filter');
  assertIncludes(galleryCategoriesApi, 'withDemoRestaurantWhere()', 'Gallery categories API GET tenant filter');
  assertIncludes(galleryCategoriesApi, 'where: getDemoRestaurantFilter()', 'Gallery categories API included photos tenant filter');
  assertIncludes(galleryPhotosApi, 'withDemoRestaurantWhere()', 'Gallery photos API GET tenant filter');

  assertIncludes(helper, '{ restaurantId: null }', 'Transitional null fallback usage');

  const orderRoute = read('src/app/api/orders/route.js');
  const reservationRoute = read('src/app/api/reservations/route.js');
  const orderPost = getExportedFunctionSource(orderRoute, 'POST');
  const reservationPost = getExportedFunctionSource(reservationRoute, 'POST');
  assertNotIncludes(orderPost, 'requireAdmin', 'Public order creation route admin auth');
  assertNotIncludes(reservationPost, 'requireAdmin', 'Public reservation creation route admin auth');

  assert(!fs.existsSync(path.join(root, 'src/app/restaurants/[restaurantSlug]')), 'Tenant restaurants slug route should not exist yet after public demo read scoping');
  assert(!fs.existsSync(path.join(root, 'src/app/api/provisioning')), 'Public demo read scoping should not add provisioning API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/billing')), 'Public demo read scoping should not add billing API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/payments')), 'Public demo read scoping should not add payments API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/subscriptions')), 'Public demo read scoping should not add subscriptions API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/crm')), 'Public demo read scoping should not add CRM API route');
  assertNotIncludes(packageJson, '"stripe"', 'Public demo read scoping Stripe dependency');
  assertNotIncludes([publicHome, publicMenu, publicOrder, publicGallery, publicTable].join('\n'), 'sendMail', 'Public demo read scoping email sending');
  assertNotIncludes([publicHome, publicMenu, publicOrder, publicGallery, publicTable].join('\n'), 'sendWhatsApp', 'Public demo read scoping WhatsApp sending');

  assertIncludes(readme, 'Public demo reads are tenant-scoped to Demo Restaurant.', 'README public demo read scoping note');
  assertIncludes(readme, 'Public demo read scoping keeps current routes unchanged.', 'README public demo route stability note');
  assertIncludes(readme, 'Current routes are unchanged.', 'README public demo route stability note');
  assertIncludes(readme, 'Null restaurantId fallback is transitional.', 'README public demo null fallback note');
}

function checkRestaurantAdminDemoOperationTenantScoping() {
  const packageJson = read('package.json');
  const schema = read('prisma/schema.prisma');
  const readme = read('README.md');
  const helper = read('src/lib/restaurants.js');

  const menuCategories = read('src/app/api/menu/categories/route.js');
  const menuCategoryItem = read('src/app/api/menu/categories/[id]/route.js');
  const menuItems = read('src/app/api/menu/items/route.js');
  const menuItem = read('src/app/api/menu/items/[id]/route.js');
  const galleryCategories = read('src/app/api/gallery/categories/route.js');
  const galleryCategory = read('src/app/api/gallery/categories/[id]/route.js');
  const galleryPhotos = read('src/app/api/gallery/photos/route.js');
  const galleryPhoto = read('src/app/api/gallery/photos/[id]/route.js');
  const profileRoute = read('src/app/api/admin/restaurant-profile/route.js');
  const settingsRoute = read('src/app/api/admin/settings/route.js');
  const announcementRoute = read('src/app/api/admin/announcement/route.js');
  const tablesRoute = read('src/app/api/admin/tables/route.js');
  const tableRoute = read('src/app/api/admin/tables/[id]/route.js');
  const reservationsRoute = read('src/app/api/reservations/route.js');
  const ordersRoute = read('src/app/api/orders/route.js');
  const assistedOrderRoute = read('src/app/api/admin/orders/assisted/route.js');
  const kitchenRoute = read('src/app/api/admin/kitchen/orders/route.js');
  const inventoryItemsRoute = read('src/app/api/admin/inventory/items/route.js');
  const inventoryItemRoute = read('src/app/api/admin/inventory/items/[id]/route.js');
  const inventoryMovementsRoute = read('src/app/api/admin/inventory/movements/route.js');
  const recipeMenuItemsRoute = read('src/app/api/admin/recipes/menu-items/route.js');
  const recipeIngredientsRoute = read('src/app/api/admin/recipes/ingredients/route.js');
  const recipeIngredientRoute = read('src/app/api/admin/recipes/ingredients/[id]/route.js');
  const recipePreviewRoute = read('src/app/api/admin/orders/[id]/recipe-consumption-preview/route.js');
  const recipeApplyRoute = read('src/app/api/admin/orders/[id]/apply-recipe-consumption/route.js');

  assertIncludes(helper, 'withDemoRestaurantData', 'Restaurant admin demo data helper');
  assertIncludes(helper, 'restaurantId: DEMO_RESTAURANT_ID', 'Restaurant admin demo data helper writes demo id');

  for (const [source, label] of [
    [menuCategories, 'admin menu categories route'],
    [menuItems, 'admin menu items route'],
    [galleryCategories, 'admin gallery categories route'],
    [galleryPhotos, 'admin gallery photos route'],
    [tablesRoute, 'admin tables route'],
    [reservationsRoute, 'reservation admin route'],
    [ordersRoute, 'order admin route'],
    [assistedOrderRoute, 'assisted order route'],
    [kitchenRoute, 'kitchen queue route'],
    [inventoryItemsRoute, 'inventory items route'],
    [inventoryMovementsRoute, 'inventory movements route'],
    [recipeMenuItemsRoute, 'recipe menu items route'],
    [recipeIngredientsRoute, 'recipe ingredients route'],
    [recipePreviewRoute, 'recipe preview route'],
    [recipeApplyRoute, 'recipe apply route'],
  ]) {
    assertIncludes(source, 'withDemoRestaurantWhere', `${label} demo read/update filter`);
  }

  for (const [source, label] of [
    [menuCategories, 'menu category create'],
    [menuItems, 'menu item create'],
    [galleryCategories, 'gallery category create'],
    [galleryPhotos, 'gallery photo create'],
    [profileRoute, 'profile upsert'],
    [settingsRoute, 'settings update'],
    [announcementRoute, 'announcement upsert'],
    [tablesRoute, 'table create'],
    [assistedOrderRoute, 'assisted order create'],
    [inventoryItemsRoute, 'inventory item create'],
    [inventoryMovementsRoute, 'inventory movement create'],
    [recipeIngredientsRoute, 'recipe ingredient create'],
    [recipeApplyRoute, 'recipe consumption apply'],
  ]) {
    assertIncludes(source, 'withDemoRestaurantData', `${label} sets demo restaurantId`);
  }

  for (const [source, label] of [
    [menuCategoryItem, 'menu category item route'],
    [menuItem, 'menu item route'],
    [galleryCategory, 'gallery category item route'],
    [galleryPhoto, 'gallery photo route'],
    [tableRoute, 'table item route'],
    [inventoryItemRoute, 'inventory item route'],
    [recipeIngredientRoute, 'recipe ingredient item route'],
  ]) {
    assertIncludes(source, 'withDemoRestaurantWhere', `${label} demo guard`);
  }

  assertIncludes(menuCategoryItem, 'prisma.menuCategory.findFirst', 'Menu category update/delete guarded read');
  assertIncludes(menuCategoryItem, 'prisma.menuItem.deleteMany', 'Menu category delete scoped child cleanup');
  assertIncludes(menuCategoryItem, 'prisma.menuCategory.deleteMany', 'Menu category scoped delete');
  assertIncludes(menuItem, 'prisma.menuItem.findFirst', 'Menu item update/delete guarded read');
  assertIncludes(menuItem, 'prisma.menuItem.deleteMany', 'Menu item scoped delete');
  assertIncludes(galleryCategory, 'prisma.galleryCategory.findFirst', 'Gallery category update/delete guarded read');
  assertIncludes(galleryCategory, 'prisma.photo.deleteMany', 'Gallery category delete scoped child cleanup');
  assertIncludes(galleryPhoto, 'prisma.photo.findFirst', 'Gallery photo update/delete guarded read');
  assertIncludes(announcementRoute, 'prisma.announcement.updateMany', 'Announcement sibling deactivation scoped update');
  assertIncludes(tablesRoute, 'withDemoRestaurantData({', 'Table create demo restaurantId');
  assertIncludes(tableRoute, 'prisma.restaurantTable.findFirst', 'Table update/delete guarded read');
  assertIncludes(reservationsRoute, 'withDemoRestaurantWhere()', 'Reservation admin read scoped');
  assertIncludes(reservationsRoute, 'withDemoRestaurantWhere({ id: parsed.data.id })', 'Reservation admin write guarded');
  assertIncludes(ordersRoute, 'withDemoRestaurantWhere()', 'Order admin read scoped');
  assertIncludes(ordersRoute, 'withDemoRestaurantWhere({ id: parsed.data.id })', 'Order admin update guarded');
  assertIncludes(ordersRoute, 'withDemoRestaurantWhere({ orderId: parsed.data.id })', 'Order item delete scoped');
  assertIncludes(assistedOrderRoute, 'items: {', 'Assisted order nested item creation');
  assertIncludes(assistedOrderRoute, 'create: orderItems.map', 'Assisted order items receive demo restaurantId');
  assertIncludes(kitchenRoute, 'withDemoRestaurantWhere({', 'Kitchen queue scoped status filter');
  assertIncludes(inventoryMovementsRoute, 'tx.inventoryItem.findFirst', 'Inventory movement item guarded read');
  assertIncludes(inventoryMovementsRoute, 'restaurantId: DEMO_RESTAURANT_ID', 'Inventory movement writes demo restaurantId');
  assertIncludes(recipeMenuItemsRoute, 'where: getDemoRestaurantFilter()', 'Recipe menu item ingredient include scoped');
  assertIncludes(recipeIngredientsRoute, 'prisma.menuItem.findFirst', 'Recipe ingredient menu item guarded read');
  assertIncludes(recipeIngredientsRoute, 'prisma.inventoryItem.findFirst', 'Recipe ingredient inventory item guarded read');
  assertIncludes(recipeIngredientRoute, 'prisma.menuItemIngredient.findFirst', 'Recipe ingredient update/delete guarded read');
  assertIncludes(recipePreviewRoute, 'prisma.order.findFirst', 'Recipe preview order scoped read');
  assertIncludes(recipePreviewRoute, 'where: getDemoRestaurantFilter()', 'Recipe preview order item include scoped');
  assertIncludes(recipePreviewRoute, 'withDemoRestaurantWhere({ menuItemId: { in: menuItemIds } })', 'Recipe preview ingredient scoped read');
  assertIncludes(recipeApplyRoute, 'withDemoRestaurantWhere({ orderId: order.id, status: \'APPLIED\' })', 'Recipe apply duplicate scoped read');
  assertIncludes(recipeApplyRoute, 'tx.orderRecipeConsumption.create', 'Recipe apply consumption log create');
  assertIncludes(recipeApplyRoute, 'withDemoRestaurantData({', 'Recipe apply writes demo restaurantId');

  const orderPost = getExportedFunctionSource(ordersRoute, 'POST');
  const reservationPost = getExportedFunctionSource(reservationsRoute, 'POST');
  assertNotIncludes(orderPost, 'requireAdmin', 'Batch 38 public order creation admin auth');
  assertNotIncludes(reservationPost, 'requireAdmin', 'Batch 38 public reservation creation admin auth');

  const adminUserBlock = getModelBlock(schema, 'AdminUser');
  const gatewayLeadBlock = getModelBlock(schema, 'GatewayLead');
  assertNotIncludes(adminUserBlock, 'restaurantId', 'AdminUser tenant scoping');
  assertNotIncludes(gatewayLeadBlock, 'restaurantId', 'GatewayLead tenant scoping');

  assert(!fs.existsSync(path.join(root, 'src/app/restaurants/[restaurantSlug]')), 'Tenant restaurants slug route should not exist yet after admin demo operation scoping');
  assert(!fs.existsSync(path.join(root, 'src/app/api/provisioning')), 'Admin demo operation scoping should not add provisioning API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/billing')), 'Admin demo operation scoping should not add billing API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/payments')), 'Admin demo operation scoping should not add payments API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/subscriptions')), 'Admin demo operation scoping should not add subscriptions API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/crm')), 'Admin demo operation scoping should not add CRM API route');
  assertNotIncludes(packageJson, '"stripe"', 'Admin demo operation scoping Stripe dependency');

  assertIncludes(readme, 'Restaurant admin demo operations are tenant-scoped to Demo Restaurant.', 'README admin demo operation scoping note');
  assertIncludes(readme, 'Current URLs are unchanged.', 'README admin demo operation route stability note');
  assertIncludes(readme, 'Transitional null restaurantId fallback remains.', 'README admin demo operation null fallback note');
  assertIncludes(readme, 'New restaurant-owned admin records write restaurantId = demo-restaurant.', 'README admin demo operation write note');
  assertIncludes(readme, 'AdminUser and GatewayLead remain platform/global for now.', 'README admin demo operation global model note');
}

function checkPublicDemoWriteTenantScoping() {
  const packageJson = read('package.json');
  const schema = read('prisma/schema.prisma');
  const readme = read('README.md');
  const helper = read('src/lib/restaurants.js');
  const orderRoute = read('src/app/api/orders/route.js');
  const reservationRoute = read('src/app/api/reservations/route.js');
  const orderPost = getExportedFunctionSource(orderRoute, 'POST');
  const reservationPost = getExportedFunctionSource(reservationRoute, 'POST');

  assertIncludes(helper, 'withDemoRestaurantData', 'Public demo write data helper');
  assertIncludes(helper, 'restaurantId: DEMO_RESTAURANT_ID', 'Public demo write helper writes demo restaurantId');

  assertIncludes(orderPost, 'withDemoRestaurantWhere({ slug: requestedTableSlug, qrToken: requestedTableToken, isActive: true })', 'Public order table lookup tenant filter');
  assertIncludes(orderPost, 'withDemoRestaurantWhere({ id: { in: itemIds } })', 'Public order menu item lookup tenant filter');
  assertIncludes(orderPost, 'data: orderContext.isDemoRestaurant ? withDemoRestaurantData(orderData) : orderData', 'Public order create preserves demo restaurantId branch');
  assertIncludes(orderPost, 'orderItems.map((item) => withDemoRestaurantData(item))', 'Public order item create writes demo restaurantId');
  assertIncludes(orderPost, 'orderSource: ORDER_SOURCES.CUSTOMER', 'Public order source preserved');
  assertIncludes(orderPost, 'reference = generateReference()', 'Public order reference generation preserved');
  assertIncludes(orderPost, 'notifyWhenReady', 'Public order notification preference logic preserved');
  assertIncludes(orderPost, 'qrToken: requestedTableToken', 'Public order table token guard preserved');
  assertNotIncludes(orderPost, 'requireAdmin', 'Public order creation auth guard');

  assertIncludes(reservationPost, '? withDemoRestaurantData(reservationData)', 'Public reservation create preserves demo restaurantId branch');
  assertIncludes(reservationPost, 'resolveReservationCreationContext(parsed.data.restaurantSlug)', 'Public reservation create resolves tenant context');
  assertIncludes(reservationPost, 'reference = generateReservationReference()', 'Public reservation reference generation preserved');
  assertIncludes(reservationPost, 'return success({ reservation: serializedReservation, reference })', 'Public reservation response shape preserved');
  assertNotIncludes(reservationPost, 'requireAdmin', 'Public reservation creation auth guard');

  const adminUserBlock = getModelBlock(schema, 'AdminUser');
  const gatewayLeadBlock = getModelBlock(schema, 'GatewayLead');
  assertNotIncludes(adminUserBlock, 'restaurantId', 'Public demo writes AdminUser scoping');
  assertNotIncludes(gatewayLeadBlock, 'restaurantId', 'Public demo writes GatewayLead scoping');

  assert(!fs.existsSync(path.join(root, 'src/app/restaurants/[restaurantSlug]')), 'Tenant restaurants slug route should not exist yet after public demo write scoping');
  assert(!fs.existsSync(path.join(root, 'src/app/api/provisioning')), 'Public demo write scoping should not add provisioning API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/billing')), 'Public demo write scoping should not add billing API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/payments')), 'Public demo write scoping should not add payments API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/subscriptions')), 'Public demo write scoping should not add subscriptions API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/crm')), 'Public demo write scoping should not add CRM API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/email')), 'Public demo write scoping should not add email API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/whatsapp')), 'Public demo write scoping should not add WhatsApp API route');
  assertNotIncludes(packageJson, '"stripe"', 'Public demo write scoping Stripe dependency');
  assertNotIncludes(packageJson, '"nodemailer"', 'Public demo write scoping nodemailer dependency');
  assertNotIncludes([orderPost, reservationPost].join('\n'), 'sendMail', 'Public demo write scoping email sending');
  assertNotIncludes([orderPost, reservationPost].join('\n'), 'sendWhatsApp', 'Public demo write scoping WhatsApp sending');

  assertIncludes(readme, 'Public demo writes are tenant-scoped to Demo Restaurant.', 'README public demo write scoping note');
  assertIncludes(readme, 'Public orders and reservations now write restaurantId = demo-restaurant.', 'README public demo write restaurantId note');
  assertIncludes(readme, 'Current URLs are unchanged.', 'README public demo write route stability note');
  assertIncludes(readme, 'AdminUser and GatewayLead remain global/platform-owned.', 'README public demo write global model note');
  assertIncludes(readme, 'No client restaurant provisioning yet.', 'README public demo write no provisioning note');
}

function checkTenantPublicRouteAlias() {
  const packageJson = read('package.json');
  const schema = read('prisma/schema.prisma');
  const readme = read('README.md');
  const helper = read('src/lib/restaurants.js');

  const tenantLayoutPath = path.join(root, 'src/app/r/[restaurantSlug]/layout.js');
  const tenantHelperPath = path.join(root, 'src/app/r/[restaurantSlug]/tenant-route.js');
  const tenantHomePath = path.join(root, 'src/app/r/[restaurantSlug]/page.js');
  const tenantMenuPath = path.join(root, 'src/app/r/[restaurantSlug]/menu/page.js');
  const tenantOrderPath = path.join(root, 'src/app/r/[restaurantSlug]/order/page.js');
  const tenantGalleryPath = path.join(root, 'src/app/r/[restaurantSlug]/gallery/page.js');
  const tenantTablePath = path.join(root, 'src/app/r/[restaurantSlug]/table/[slug]/page.js');

  for (const [routePath, label] of [
    [tenantLayoutPath, '/r/[restaurantSlug] layout'],
    [tenantHelperPath, '/r/[restaurantSlug] tenant helper'],
    [tenantHomePath, '/r/[restaurantSlug] route'],
    [tenantMenuPath, '/r/[restaurantSlug]/menu route'],
    [tenantOrderPath, '/r/[restaurantSlug]/order route'],
    [tenantGalleryPath, '/r/[restaurantSlug]/gallery route'],
    [tenantTablePath, '/r/[restaurantSlug]/table/[slug] route'],
  ]) {
    assert(fs.existsSync(routePath), `${label} is missing`);
  }

  const tenantLayout = read('src/app/r/[restaurantSlug]/layout.js');
  const tenantHelper = read('src/app/r/[restaurantSlug]/tenant-route.js');
  const tenantHome = read('src/app/r/[restaurantSlug]/page.js');
  const tenantMenu = read('src/app/r/[restaurantSlug]/menu/page.js');
  const tenantOrder = read('src/app/r/[restaurantSlug]/order/page.js');
  const tenantGallery = read('src/app/r/[restaurantSlug]/gallery/page.js');
  const tenantTable = read('src/app/r/[restaurantSlug]/table/[slug]/page.js');
  const publicHome = read('src/app/public/page.js');
  const publicMenu = read('src/app/public/menu/page.js');
  const publicOrder = read('src/app/public/order/page.js');
  const publicGallery = read('src/app/public/gallery/page.js');
  const publicTable = read('src/app/public/table/[slug]/page.js');
  const orderRoute = read('src/app/api/orders/route.js');
  const reservationRoute = read('src/app/api/reservations/route.js');
  const orderPost = getExportedFunctionSource(orderRoute, 'POST');
  const reservationPost = getExportedFunctionSource(reservationRoute, 'POST');

  assertIncludes(helper, 'getRestaurantBySlug', 'Restaurant helper tenant slug resolver');
  assertIncludes(helper, 'getRestaurantWhereBySlug(restaurantSlug)', 'Restaurant helper slug where usage');
  assertIncludes(helper, 'restaurantSlug === DEMO_RESTAURANT_SLUG', 'Restaurant helper demo slug fallback');
  assertIncludes(tenantHelper, 'getRestaurantBySlug', 'Tenant route helper resolves slug');
  assertIncludes(tenantHelper, 'getTenantRestaurantProfile', 'Tenant route helper tenant profile loader');
  assertIncludes(tenantHelper, 'getTenantRestaurantSettings', 'Tenant route helper tenant settings loader');
  assertIncludes(tenantHelper, 'getTenantRestaurantContext', 'Tenant route helper tenant context loader');
  assertIncludes(tenantHelper, 'const restaurantId = restaurant.id', 'Tenant route helper non-demo restaurantId lookup');
  assertIncludes(tenantHelper, 'restaurant.slug === DEMO_RESTAURANT_SLUG', 'Tenant route helper preserves demo branch');
  assertIncludes(tenantHelper, 'where: { restaurantId }', 'Tenant route helper exact tenant profile/settings lookup');
  assertIncludes(tenantHelper, 'getDemoRestaurantFilter()', 'Tenant route helper demo fallback preserved');
  assertIncludes(tenantHelper, 'notFound()', 'Tenant route helper unknown slug 404');
  assertNotIncludes(tenantHelper, 'restaurant.slug !== DEMO_RESTAURANT_SLUG', 'Tenant route helper no longer only supports demo restaurant');

  assertIncludes(tenantLayout, 'getTenantRestaurantContext(params)', 'Tenant layout uses tenant context');
  assertIncludes(tenantLayout, '<Header profile={context.profile}', 'Tenant layout tenant header profile');
  assertIncludes(tenantLayout, '<Footer profile={context.profile}', 'Tenant layout tenant footer profile');
  assertNotIncludes(tenantLayout, '../../public/layout', 'Tenant layout should not use demo public layout');
  assertNotIncludes(tenantHome, '../../public/page', 'Tenant home should not blindly alias public page');
  assertNotIncludes(tenantMenu, '../../../public/menu/page', 'Tenant menu should not blindly alias public menu');
  assertIncludes(tenantOrder, '../../../public/order/page', 'Tenant order preserves demo public order page');
  assertNotIncludes(tenantGallery, '../../../public/gallery/page', 'Tenant gallery should not blindly alias public gallery');
  assertIncludes(tenantTable, '../../../../public/table/[slug]/page', 'Tenant table aliases public table page');

  for (const [source, label] of [
    [tenantHome, 'tenant home'],
    [tenantMenu, 'tenant menu'],
    [tenantOrder, 'tenant order'],
    [tenantGallery, 'tenant gallery'],
  ]) {
    assertIncludes(source, 'getTenantRestaurantContext(params)', `${label} loads tenant context`);
  }

  assertIncludes(tenantHome, 'Menu content has not been added yet.', 'Tenant home menu empty state');
  assertIncludes(tenantHome, 'Gallery content has not been added yet.', 'Tenant home gallery empty state');
  assertIncludes(tenantHome, 'context.isDemoRestaurant', 'Tenant home preserves demo rendering branch');
  assertIncludes(tenantMenu, 'getTenantContentWhere(context)', 'Tenant menu uses tenant category filter');
  assertIncludes(tenantMenu, 'getTenantRelationWhere(context)', 'Tenant menu uses tenant item filter');
  assertIncludes(tenantMenu, 'Menu content has not been added yet.', 'Tenant menu empty state');
  assertIncludes(tenantGallery, 'getTenantContentWhere(context)', 'Tenant gallery uses tenant category filter');
  assertIncludes(tenantGallery, 'getTenantRelationWhere(context)', 'Tenant gallery uses tenant photo filter');
  assertIncludes(tenantGallery, 'Gallery content has not been added yet.', 'Tenant gallery empty state');
  assertIncludes(tenantOrder, 'ordering is not available yet', 'Tenant order unavailable state');
  assertIncludes(tenantOrder, 'if (context.isDemoRestaurant)', 'Tenant order non-demo unsafe global order guard');
  assertIncludes(tenantOrder, 'return <PublicOrderPage searchParams={searchParams} />', 'Tenant order demo order branch preserved');

  assertIncludes(publicHome, 'withDemoRestaurantWhere({ recommended: true })', 'Tenant alias public home scoped read');
  assertIncludes(publicMenu, 'withDemoRestaurantWhere()', 'Tenant alias public menu category scoped read');
  assertIncludes(publicMenu, 'where: getDemoRestaurantFilter()', 'Tenant alias public menu item scoped read');
  assertIncludes(publicOrder, 'withDemoRestaurantWhere()', 'Tenant alias public order category scoped read');
  assertIncludes(publicOrder, 'where: getDemoRestaurantFilter()', 'Tenant alias public order item scoped read');
  assertIncludes(publicOrder, 'withDemoRestaurantWhere({ slug, qrToken: tableToken, isActive: true })', 'Tenant alias public order table scoped read');
  assertIncludes(publicGallery, 'withDemoRestaurantWhere()', 'Tenant alias public gallery category scoped read');
  assertIncludes(publicGallery, 'where: getDemoRestaurantFilter()', 'Tenant alias public gallery photo scoped read');
  assertIncludes(publicTable, 'withDemoRestaurantWhere({ slug })', 'Tenant alias public table scoped read');
  assertIncludes(orderPost, 'data: orderContext.isDemoRestaurant ? withDemoRestaurantData(orderData) : orderData', 'Tenant alias order write keeps restaurantId stamping');
  assertIncludes(orderPost, 'orderItems.map((item) => withDemoRestaurantData(item))', 'Tenant alias order item write keeps restaurantId stamping');
  assertIncludes(reservationPost, '? withDemoRestaurantData(reservationData)', 'Tenant alias reservation write keeps demo restaurantId stamping');

  for (const publicRoutePath of [
    'src/app/public/page.js',
    'src/app/public/menu/page.js',
    'src/app/public/order/page.js',
    'src/app/public/gallery/page.js',
    'src/app/public/table/[slug]/page.js',
  ]) {
    assert(fs.existsSync(path.join(root, publicRoutePath)), `${publicRoutePath} should still exist`);
  }

  const adminUserBlock = getModelBlock(schema, 'AdminUser');
  const gatewayLeadBlock = getModelBlock(schema, 'GatewayLead');
  assertNotIncludes(adminUserBlock, 'restaurantId', 'Tenant public alias AdminUser scoping');
  assertNotIncludes(gatewayLeadBlock, 'restaurantId', 'Tenant public alias GatewayLead scoping');

  assert(!fs.existsSync(path.join(root, 'src/app/restaurants/[restaurantSlug]')), 'Tenant public alias should not add restaurants slug route yet');
  assert(!fs.existsSync(path.join(root, 'src/app/api/provisioning')), 'Tenant public alias should not add provisioning API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/billing')), 'Tenant public alias should not add billing API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/payments')), 'Tenant public alias should not add payments API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/subscriptions')), 'Tenant public alias should not add subscriptions API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/crm')), 'Tenant public alias should not add CRM API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/email')), 'Tenant public alias should not add email API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/whatsapp')), 'Tenant public alias should not add WhatsApp API route');
  assertNotIncludes(packageJson, '"stripe"', 'Tenant public alias Stripe dependency');
  assertNotIncludes(packageJson, '"nodemailer"', 'Tenant public alias nodemailer dependency');
  assertNotIncludes([tenantHome, tenantMenu, tenantOrder, tenantGallery, tenantTable].join('\n'), 'sendMail', 'Tenant public alias email sending');
  assertNotIncludes([tenantHome, tenantMenu, tenantOrder, tenantGallery, tenantTable].join('\n'), 'sendWhatsApp', 'Tenant public alias WhatsApp sending');

  assertIncludes(readme, 'Initialized tenant public reads activated.', 'README initialized tenant public reads note');
  assertIncludes(readme, '`/r/[slug]` works after profile/settings initialization.', 'README initialized tenant route note');
  assertIncludes(readme, 'Non-demo tenants use their own profile/settings.', 'README initialized tenant profile note');
  assertIncludes(readme, 'Menu/gallery/order content still require later provisioning.', 'README initialized tenant content boundary');
  assertIncludes(readme, '`/public` remains the Demo Restaurant shortcut.', 'README initialized tenant public shortcut note');
  assertIncludes(readme, 'No custom domains/billing/provisioning yet.', 'README initialized tenant no provisioning note');
}

function checkPlatformClientRestaurantRegistry() {
  const packageJson = read('package.json');
  const schema = read('prisma/schema.prisma');
  const readme = read('README.md');
  const pagePath = path.join(root, 'src/app/platform-admin/(protected)/client-restaurants/page.js');

  assert(fs.existsSync(pagePath), '/platform-admin/client-restaurants registry page is missing');
  const page = read('src/app/platform-admin/(protected)/client-restaurants/page.js');

  assertIncludes(page, 'prisma.restaurant.findMany', 'Client restaurant registry database read');
  assertIncludes(page, 'normalizeRestaurant', 'Client restaurant registry normalization');
  assertIncludes(page, 'DEMO_RESTAURANT_SLUG', 'Client restaurant registry demo slug helper');
  assertIncludes(page, 'restaurant.name', 'Client restaurant registry name display');
  assertIncludes(page, 'restaurant.slug', 'Client restaurant registry slug display');
  assertIncludes(page, 'restaurant.status', 'Client restaurant registry status display');
  assertIncludes(page, 'restaurant.type', 'Client restaurant registry type display');
  assertIncludes(page, 'restaurant.createdAt', 'Client restaurant registry createdAt display');
  assertIncludes(page, 'restaurant.updatedAt', 'Client restaurant registry updatedAt display');
  assertIncludes(page, 'restaurant.notes', 'Client restaurant registry notes display');
  assertIncludes(page, 'href={`/r/${restaurant.slug}`}', 'Client restaurant registry tenant home link');
  assertIncludes(page, 'href={`/r/${restaurant.slug}/menu`}', 'Client restaurant registry tenant menu link');
  assertIncludes(page, 'href={`/r/${restaurant.slug}/order`}', 'Client restaurant registry tenant order link');
  assertIncludes(page, 'href="/platform-admin/demo-restaurant"', 'Client restaurant registry demo reset link');
  assertIncludes(page, 'Demo Restaurant tenant anchor is missing.', 'Client restaurant registry empty state');
  assertIncludes(page, 'Use future provisioning controls later.', 'Client restaurant registry future provisioning empty copy');
  assertNotIncludes(page, 'prisma.restaurant.update', 'Client restaurant registry update mutation');
  assertNotIncludes(page, 'prisma.restaurant.delete', 'Client restaurant registry delete mutation');

  const adminUserBlock = getModelBlock(schema, 'AdminUser');
  const gatewayLeadBlock = getModelBlock(schema, 'GatewayLead');
  assertNotIncludes(adminUserBlock, 'restaurantId', 'Client restaurant registry AdminUser scoping');
  assertNotIncludes(gatewayLeadBlock, 'restaurantId', 'Client restaurant registry GatewayLead scoping');

  assert(!fs.existsSync(path.join(root, 'src/app/api/platform/restaurants')), 'Client restaurant registry should not add platform restaurant API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/platform/client-restaurants')), 'Client restaurant registry should not add client restaurant API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/provisioning')), 'Client restaurant registry should not add provisioning API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/billing')), 'Client restaurant registry should not add billing API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/payments')), 'Client restaurant registry should not add payments API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/subscriptions')), 'Client restaurant registry should not add subscriptions API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/crm')), 'Client restaurant registry should not add CRM API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/email')), 'Client restaurant registry should not add email API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/whatsapp')), 'Client restaurant registry should not add WhatsApp API route');
  assertNotIncludes(packageJson, '"stripe"', 'Client restaurant registry Stripe dependency');
  assertNotIncludes(packageJson, '"nodemailer"', 'Client restaurant registry nodemailer dependency');

  assertIncludes(readme, 'Platform client restaurant registry added.', 'README client restaurant registry note');
  assertIncludes(readme, 'Backed by the Restaurant table.', 'README client restaurant registry table note');
  assertIncludes(readme, 'Shows the Demo Restaurant tenant anchor.', 'README client restaurant registry demo note');
  assertIncludes(readme, 'Links to the tenant public route.', 'README client restaurant registry tenant link note');
  assertIncludes(readme, 'No billing/subscriptions/custom domains yet.', 'README client restaurant registry billing note');
}

function checkPlatformClientRestaurantCreate() {
  const packageJson = read('package.json');
  const schema = read('prisma/schema.prisma');
  const readme = read('README.md');
  const helper = read('src/lib/restaurants.js');
  const pagePath = path.join(root, 'src/app/platform-admin/(protected)/client-restaurants/page.js');
  const actionPath = path.join(root, 'src/app/platform-admin/(protected)/client-restaurants/actions.js');

  assert(fs.existsSync(pagePath), '/platform-admin/client-restaurants create page is missing');
  assert(fs.existsSync(actionPath), '/platform-admin/client-restaurants create action is missing');
  const page = read('src/app/platform-admin/(protected)/client-restaurants/page.js');
  const action = read('src/app/platform-admin/(protected)/client-restaurants/actions.js');
  const createAction = getExportedFunctionSource(action, 'createClientRestaurant');

  assertIncludes(helper, 'RESERVED_RESTAURANT_SLUGS', 'Restaurant helper reserved slugs');
  assertIncludes(helper, 'normalizeRestaurantSlug', 'Restaurant helper slug normalization');
  assertIncludes(helper, 'isValidRestaurantSlug', 'Restaurant helper slug validity check');
  assertIncludes(helper, 'validateRestaurantSlug', 'Restaurant helper slug validation');
  for (const reservedSlug of ['public', 'admin', 'platform-admin', 'api', 'r', 'demo']) {
    assertIncludes(helper, `'${reservedSlug}'`, `Restaurant helper reserved slug ${reservedSlug}`);
  }

  assertIncludes(page, '<form action={createClientRestaurant}', 'Client restaurant create form');
  for (const fieldName of ['name="name"', 'name="slug"', 'name="status"', 'name="type"', 'name="notes"']) {
    assertIncludes(page, fieldName, `Client restaurant create form field ${fieldName}`);
  }

  assertIncludes(createAction, 'getAdminFromRequest(cookies())', 'Client restaurant create ADMIN auth lookup');
  assertIncludes(createAction, "admin.role !== 'ADMIN'", 'Client restaurant create ADMIN-only role guard');
  assertIncludes(createAction, 'name.length < 2', 'Client restaurant create name validation');
  assertIncludes(createAction, 'validateRestaurantSlug(rawSlug)', 'Client restaurant create reserved slug validation');
  assertIncludes(createAction, 'prisma.restaurant.findUnique', 'Client restaurant create duplicate slug lookup');
  assertIncludes(createAction, 'A restaurant with this slug already exists.', 'Client restaurant create duplicate slug friendly error');
  assertIncludes(createAction, 'prisma.restaurant.create', 'Client restaurant create Restaurant row creation');
  assertIncludes(createAction, 'status: normalizeRestaurantStatus', 'Client restaurant create status normalization');
  assertIncludes(createAction, 'type: normalizeRestaurantType', 'Client restaurant create type normalization');
  assertIncludes(createAction, 'notes: cleanOptionalField', 'Client restaurant create notes trimming');
  assertIncludes(createAction, 'revalidatePath', 'Client restaurant create registry revalidation');
  assertIncludes(createAction, 'redirect(`/platform-admin/client-restaurants?created=${created.slug}`)', 'Client restaurant create success redirect');

  assertNotIncludes(createAction, 'restaurantProfile', 'Client restaurant create should not create RestaurantProfile');
  assertNotIncludes(createAction, 'restaurantSettings', 'Client restaurant create should not create RestaurantSettings');
  assertNotIncludes(createAction, 'menuCategory', 'Client restaurant create should not create menu categories');
  assertNotIncludes(createAction, 'menuItem', 'Client restaurant create should not create menu items');
  assertNotIncludes(createAction, 'galleryCategory', 'Client restaurant create should not create gallery categories');
  assertNotIncludes(createAction, 'photo', 'Client restaurant create should not create photos');
  assertNotIncludes(createAction, 'order.', 'Client restaurant create should not create orders');
  assertNotIncludes(createAction, 'inventoryItem', 'Client restaurant create should not create inventory rows');
  assertNotIncludes(createAction, 'adminUser', 'Client restaurant create should not create AdminUser');
  assertNotIncludes(createAction, 'gatewayLead', 'Client restaurant create should not touch GatewayLead');

  assertIncludes(page, 'Tenant public route activates after profile/settings initialization.', 'Client restaurant non-demo route pre-init copy');
  assertIncludes(page, 'Tenant public reads are active; menu/gallery/order content still require later provisioning.', 'Client restaurant initialized tenant route active copy');
  assertIncludes(page, 'restaurant.slug === DEMO_RESTAURANT_SLUG', 'Client restaurant non-demo link guard');
  assertIncludes(page, 'href={`/r/${restaurant.slug}`}', 'Client restaurant demo tenant home link retained');
  assertIncludes(page, 'href={`/r/${restaurant.slug}/menu`}', 'Client restaurant demo tenant menu link retained');
  assertIncludes(page, 'href={`/r/${restaurant.slug}/gallery`}', 'Client restaurant tenant gallery link retained');
  assertIncludes(page, 'href={`/r/${restaurant.slug}/order`}', 'Client restaurant demo tenant order link retained');

  const adminUserBlock = getModelBlock(schema, 'AdminUser');
  const gatewayLeadBlock = getModelBlock(schema, 'GatewayLead');
  assertNotIncludes(adminUserBlock, 'restaurantId', 'Client restaurant create AdminUser scoping');
  assertNotIncludes(gatewayLeadBlock, 'restaurantId', 'Client restaurant create GatewayLead scoping');

  assert(!fs.existsSync(path.join(root, 'src/app/api/provisioning')), 'Client restaurant create should not add provisioning API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/billing')), 'Client restaurant create should not add billing API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/payments')), 'Client restaurant create should not add payments API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/subscriptions')), 'Client restaurant create should not add subscriptions API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/crm')), 'Client restaurant create should not add CRM API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/email')), 'Client restaurant create should not add email API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/whatsapp')), 'Client restaurant create should not add WhatsApp API route');
  assertNotIncludes(packageJson, '"stripe"', 'Client restaurant create Stripe dependency');
  assertNotIncludes(packageJson, '"nodemailer"', 'Client restaurant create nodemailer dependency');
  assertNotIncludes(createAction, 'sendMail', 'Client restaurant create email sending');
  assertNotIncludes(createAction, 'sendWhatsApp', 'Client restaurant create WhatsApp sending');

  assertIncludes(readme, 'Platform client restaurant tenant creation added.', 'README client restaurant create note');
  assertIncludes(readme, 'Creates only Restaurant tenant anchor records.', 'README client restaurant create Restaurant-only note');
  assertIncludes(readme, 'No full provisioning yet.', 'README client restaurant create no provisioning note');
  assertIncludes(readme, 'No profile/settings/menu/admin user creation yet.', 'README client restaurant create no related data note');
  assertIncludes(readme, 'Non-demo public routes are not active yet.', 'README client restaurant create non-demo route note');
  assertIncludes(readme, 'No billing/subscriptions/custom domains yet.', 'README client restaurant create billing note');
}

function checkTenantSafeProfileSettingsSchema() {
  const packageJson = read('package.json');
  const schema = read('prisma/schema.prisma');
  const readme = read('README.md');
  const blockerPath = path.join(root, 'docs/CLIENT_RESTAURANT_PROFILE_SETTINGS_INIT_BLOCKER.md');
  const migrationPath = path.join(root, 'prisma/migrations/20260605043000_make_profile_settings_tenant_safe/migration.sql');
  const profileHelper = read('src/lib/restaurant-profile.js');
  const settingsHelper = read('src/lib/restaurant-settings.js');
  const profileRoute = read('src/app/api/admin/restaurant-profile/route.js');
  const settingsRoute = read('src/app/api/admin/settings/route.js');
  const resetRoute = read('src/app/api/platform/demo-profile/reset/route.js');
  const action = read('src/app/platform-admin/(protected)/client-restaurants/actions.js');
  const page = read('src/app/platform-admin/(protected)/client-restaurants/page.js');

  const profileBlock = getModelBlock(schema, 'RestaurantProfile');
  const settingsBlock = getModelBlock(schema, 'RestaurantSettings');
  assertIncludes(profileBlock, 'id                 Int      @id @default(autoincrement())', 'RestaurantProfile tenant-safe generated id');
  assertIncludes(settingsBlock, 'id                    Int     @id @default(autoincrement())', 'RestaurantSettings tenant-safe generated id');
  assertNotIncludes(profileBlock, '@default(1)', 'RestaurantProfile singleton id default');
  assertNotIncludes(settingsBlock, '@default(1)', 'RestaurantSettings singleton id default');
  assertIncludes(profileBlock, '@@unique([restaurantId])', 'RestaurantProfile unique restaurantId constraint');
  assertIncludes(settingsBlock, '@@unique([restaurantId])', 'RestaurantSettings unique restaurantId constraint');

  assert(fs.existsSync(blockerPath), 'Client restaurant profile/settings initialization blocker doc is missing');
  assert(fs.existsSync(migrationPath), 'Tenant-safe profile/settings migration is missing');
  const migration = read('prisma/migrations/20260605043000_make_profile_settings_tenant_safe/migration.sql');
  const blocker = read('docs/CLIENT_RESTAURANT_PROFILE_SETTINGS_INIT_BLOCKER.md');

  assertIncludes(migration, 'UPDATE "RestaurantProfile"', 'Tenant-safe migration profile demo backfill');
  assertIncludes(migration, 'UPDATE "RestaurantSettings"', 'Tenant-safe migration settings demo backfill');
  assertIncludes(migration, 'SET "restaurantId" = \'demo-restaurant\'', 'Tenant-safe migration demo restaurant backfill id');
  assertIncludes(migration, 'CREATE SEQUENCE IF NOT EXISTS "RestaurantProfile_id_seq"', 'Tenant-safe migration profile sequence');
  assertIncludes(migration, 'CREATE SEQUENCE IF NOT EXISTS "RestaurantSettings_id_seq"', 'Tenant-safe migration settings sequence');
  assertIncludes(migration, 'MAX("id") FROM "RestaurantProfile"', 'Tenant-safe migration profile sequence max id');
  assertIncludes(migration, 'MAX("id") FROM "RestaurantSettings"', 'Tenant-safe migration settings sequence max id');
  assertIncludes(migration, 'ALTER COLUMN "id" SET DEFAULT nextval', 'Tenant-safe migration generated id default');
  assertIncludes(migration, 'CREATE UNIQUE INDEX "RestaurantProfile_restaurantId_key"', 'Tenant-safe migration profile unique restaurantId');
  assertIncludes(migration, 'CREATE UNIQUE INDEX "RestaurantSettings_restaurantId_key"', 'Tenant-safe migration settings unique restaurantId');
  assertIncludes(migration, 'unique indexes allow multiple NULL values', 'Tenant-safe migration nullable restaurantId note');

  assertIncludes(profileHelper, 'where: getDemoRestaurantFilter()', 'Tenant-safe profile helper demo tenant lookup');
  assertIncludes(profileHelper, 'where: { restaurantId: DEMO_RESTAURANT_ID }', 'Tenant-safe profile helper duplicate fallback');
  assertNotIncludes(profileHelper, 'getDemoRestaurantOrGlobalWhere({ id: defaultRestaurantProfile.id })', 'Tenant-safe profile helper id-only filter');
  assertNotIncludes(profileHelper, 'restaurantProfile.findUnique', 'Tenant-safe profile helper id-only findUnique');
  assertIncludes(settingsHelper, 'where: getDemoRestaurantFilter()', 'Tenant-safe settings helper demo tenant lookup');
  assertNotIncludes(settingsHelper, 'getDemoRestaurantOrGlobalWhere({ id: 1 })', 'Tenant-safe settings helper id-only filter');
  assertNotIncludes(settingsHelper, 'id: 1,', 'Tenant-safe settings helper singleton default id');
  assertIncludes(profileRoute, 'where: { restaurantId: DEMO_RESTAURANT_ID }', 'Tenant-safe admin profile route restaurantId upsert');
  assertNotIncludes(profileRoute, 'where: { id: 1 }', 'Tenant-safe admin profile route no singleton upsert');
  assertIncludes(settingsRoute, 'where: { id: existingSettings.id }', 'Tenant-safe admin settings route loaded row update');
  assertNotIncludes(settingsRoute, 'where: { id: 1 }', 'Tenant-safe admin settings route no singleton update');
  assertIncludes(resetRoute, 'where: { restaurantId: DEMO_RESTAURANT_ID }', 'Tenant-safe demo reset route restaurantId upsert');
  assertIncludes(resetRoute, 'withDemoRestaurantData(toPrismaRestaurantProfileData', 'Tenant-safe demo reset route create restaurantId');

  assertIncludes(blocker, 'Blocker status: resolved by Batch 44 schema migration.', 'Blocker doc resolved status');
  assertIncludes(blocker, 'Initialization action status: added in Batch 45.', 'Blocker doc initialization added status');
  assertIncludes(blocker, 'RestaurantProfile.id now uses `autoincrement()`', 'Blocker doc profile resolved detail');
  assertIncludes(blocker, 'RestaurantSettings.id now uses `autoincrement()`', 'Blocker doc settings resolved detail');
  assertIncludes(blocker, 'one profile/settings row per restaurant is now possible', 'Blocker doc tenant-safe possibility');
  assertIncludes(blocker, 'creates only missing `RestaurantProfile` and/or `RestaurantSettings` rows', 'Blocker doc init missing-only scope');
  assertIncludes(blocker, 'keep non-demo ordering inactive until tenant-aware write APIs are added', 'Blocker doc non-demo ordering boundary');

  const initAction = getExportedFunctionSource(action, 'initializeRestaurantBasics');
  assertIncludes(action, 'initializeRestaurantBasics', 'Client restaurant profile/settings init action');
  assertIncludes(initAction, 'getAdminFromRequest(cookies())', 'Client restaurant init ADMIN auth lookup');
  assertIncludes(initAction, "admin.role !== 'ADMIN'", 'Client restaurant init ADMIN-only role guard');
  assertIncludes(initAction, 'prisma.restaurant.findUnique', 'Client restaurant init target Restaurant lookup');
  assertIncludes(initAction, 'prisma.restaurantProfile.findUnique', 'Client restaurant init profile restaurantId lookup');
  assertIncludes(initAction, 'where: { restaurantId: restaurant.id }', 'Client restaurant init restaurantId ownership lookup');
  assertIncludes(initAction, 'prisma.restaurantSettings.findUnique', 'Client restaurant init settings restaurantId lookup');
  assertIncludes(initAction, 'prisma.restaurantProfile.create', 'Client restaurant init creates missing RestaurantProfile');
  assertIncludes(initAction, 'prisma.restaurantSettings.create', 'Client restaurant init creates missing RestaurantSettings');
  assertIncludes(initAction, 'if (!existingProfile)', 'Client restaurant init does not overwrite existing profile');
  assertIncludes(initAction, 'if (!existingSettings)', 'Client restaurant init does not overwrite existing settings');
  assertNotIncludes(initAction, 'restaurantProfile.upsert', 'Client restaurant init should not upsert RestaurantProfile');
  assertNotIncludes(initAction, 'restaurantSettings.upsert', 'Client restaurant init should not upsert RestaurantSettings');
  assertIncludes(initAction, 'already initialized', 'Client restaurant init already initialized message');
  assertIncludes(initAction, 'partially initialized', 'Client restaurant init partially initialized message');
  assertIncludes(page, 'profile/settings status', 'Client restaurant registry profile/settings status copy');
  assertIncludes(page, 'hasProfile', 'Client restaurant registry profile status data');
  assertIncludes(page, 'hasSettings', 'Client restaurant registry settings status data');
  assertIncludes(page, 'Initialize profile/settings', 'Client restaurant registry initialize button');
  assertIncludes(page, 'Creates basic profile/settings only. Does not create menu, admin users, or activate ordering.', 'Client restaurant init scope copy');
  assertIncludes(page, 'restaurant.slug !== DEMO_RESTAURANT_SLUG', 'Client restaurant init non-demo guard');

  for (const forbidden of [
    'menuCategory',
    'menuItem',
    'galleryCategory',
    'photo',
    'order.',
    'reservation',
    'inventoryItem',
    'menuItemIngredient',
    'adminUser',
    'gatewayLead',
  ]) {
    assertNotIncludes(initAction, forbidden, `Client restaurant init should not touch ${forbidden}`);
  }

  assertIncludes(page, 'Tenant public reads are active; menu/gallery/order content still require later provisioning.', 'Client restaurant init keeps provisioning boundary copy');
  const adminUserBlock = getModelBlock(schema, 'AdminUser');
  const gatewayLeadBlock = getModelBlock(schema, 'GatewayLead');
  assertNotIncludes(adminUserBlock, 'restaurantId', 'Blocked init AdminUser scoping');
  assertNotIncludes(gatewayLeadBlock, 'restaurantId', 'Blocked init GatewayLead scoping');

  assert(!fs.existsSync(path.join(root, 'src/app/api/provisioning')), 'Blocked init should not add provisioning API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/billing')), 'Blocked init should not add billing API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/payments')), 'Blocked init should not add payments API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/subscriptions')), 'Blocked init should not add subscriptions API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/crm')), 'Blocked init should not add CRM API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/email')), 'Blocked init should not add email API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/whatsapp')), 'Blocked init should not add WhatsApp API route');
  assertNotIncludes(packageJson, '"stripe"', 'Blocked init Stripe dependency');
  assertNotIncludes(packageJson, '"nodemailer"', 'Blocked init nodemailer dependency');

  assertIncludes(readme, 'RestaurantProfile/RestaurantSettings tenant-safe schema migration added.', 'README tenant-safe profile/settings migration note');
  assertIncludes(readme, 'Profile/settings id defaults no longer use singleton constants.', 'README tenant-safe no singleton default note');
  assertIncludes(readme, 'One profile/settings row per restaurant is now possible.', 'README tenant-safe per restaurant note');
  assertIncludes(readme, 'Client restaurant profile/settings initialization added.', 'README client restaurant init note');
  assertIncludes(readme, 'Creates only missing RestaurantProfile and RestaurantSettings rows.', 'README client restaurant init missing-only note');
  assertIncludes(readme, 'No full provisioning/menu/admin user/order activation yet.', 'README client restaurant init provisioning boundary');
  assertIncludes(readme, 'Initialized tenant public reads activated.', 'README client restaurant init route boundary');
}

function checkTenantStarterContentProvisioning() {
  const packageJson = read('package.json');
  const schema = read('prisma/schema.prisma');
  const readme = read('README.md');
  const page = read('src/app/platform-admin/(protected)/client-restaurants/page.js');
  const action = read('src/app/platform-admin/(protected)/client-restaurants/actions.js');
  const tenantMenu = read('src/app/r/[restaurantSlug]/menu/page.js');
  const tenantGallery = read('src/app/r/[restaurantSlug]/gallery/page.js');
  const tenantOrder = read('src/app/r/[restaurantSlug]/order/page.js');
  const provisionAction = getExportedFunctionSource(action, 'provisionRestaurantStarterContent');

  for (const modelName of ['MenuCategory', 'MenuItem', 'GalleryCategory', 'Photo']) {
    const modelBlock = getModelBlock(schema, modelName);
    assertIncludes(modelBlock, 'restaurantId', `${modelName} starter provisioning restaurantId field`);
    assertIncludes(modelBlock, 'Restaurant?', `${modelName} starter provisioning Restaurant relation`);
    assertIncludes(modelBlock, '@@index([restaurantId])', `${modelName} starter provisioning restaurantId index`);
  }

  assertIncludes(action, 'provisionRestaurantStarterContent', 'Tenant starter content provisioning action exists');
  assertIncludes(provisionAction, 'getAdminFromRequest(cookies())', 'Tenant starter content provisioning ADMIN auth lookup');
  assertIncludes(provisionAction, "admin.role !== 'ADMIN'", 'Tenant starter content provisioning ADMIN-only guard');
  assertIncludes(provisionAction, 'prisma.restaurant.findUnique', 'Tenant starter content provisioning Restaurant lookup');
  assertIncludes(provisionAction, 'restaurant.slug === DEMO_RESTAURANT_SLUG', 'Tenant starter content provisioning rejects Demo Restaurant');
  assertIncludes(provisionAction, 'prisma.restaurantProfile.findUnique', 'Tenant starter content provisioning profile initialization check');
  assertIncludes(provisionAction, 'prisma.restaurantSettings.findUnique', 'Tenant starter content provisioning settings initialization check');
  assertIncludes(provisionAction, 'where: { restaurantId: restaurant.id }', 'Tenant starter content provisioning restaurantId ownership checks');
  assertIncludes(provisionAction, 'prisma.menuCategory.findMany', 'Tenant starter content provisioning menu category check');
  assertIncludes(provisionAction, 'prisma.menuItem.count', 'Tenant starter content provisioning menu item check');
  assertIncludes(provisionAction, 'prisma.galleryCategory.findMany', 'Tenant starter content provisioning gallery category check');
  assertIncludes(provisionAction, 'prisma.photo.count', 'Tenant starter content provisioning photo check');
  assertIncludes(provisionAction, 'prisma.menuCategory.create', 'Tenant starter content provisioning creates missing menu category');
  assertIncludes(provisionAction, 'prisma.menuItem.create', 'Tenant starter content provisioning creates missing menu item');
  assertIncludes(provisionAction, 'prisma.galleryCategory.create', 'Tenant starter content provisioning creates missing gallery category');
  assertIncludes(provisionAction, 'prisma.photo.create', 'Tenant starter content provisioning creates missing photo');
  assertIncludes(provisionAction, 'restaurantId: restaurant.id', 'Tenant starter content provisioning scopes created rows');
  assertIncludes(provisionAction, 'isAvailable: false', 'Tenant starter content provisioning keeps starter menu unavailable');
  assertIncludes(provisionAction, 'already provisioned', 'Tenant starter content provisioning already provisioned message');
  assertIncludes(provisionAction, 'partially provisioned', 'Tenant starter content provisioning partial message');
  assertNotIncludes(provisionAction, 'upsert', 'Tenant starter content provisioning should not overwrite existing content');
  assertNotIncludes(provisionAction, 'update(', 'Tenant starter content provisioning should not update existing content');

  for (const forbidden of [
    'adminUser',
    'order.',
    'reservation',
    'inventoryItem',
    'inventoryMovement',
    'recipe',
    'gatewayLead',
    'sendMail',
    'sendWhatsApp',
  ]) {
    assertNotIncludes(provisionAction, forbidden, `Tenant starter content provisioning should not touch ${forbidden}`);
  }

  assertIncludes(page, 'menu/gallery starter status', 'Tenant starter content registry status copy');
  assertIncludes(page, 'hasStarterMenu', 'Tenant starter content registry menu status data');
  assertIncludes(page, 'hasStarterGallery', 'Tenant starter content registry gallery status data');
  assertIncludes(page, 'Provision starter menu/gallery', 'Tenant starter content provisioning button');
  assertIncludes(page, '<form action={provisionRestaurantStarterContent}', 'Tenant starter content provisioning form');
  assertIncludes(page, 'Creates starter menu/gallery content only. Does not create admin users, ordering setup, billing, or custom domains.', 'Tenant starter content provisioning scope copy');
  assertIncludes(page, 'restaurant.hasProfile && restaurant.hasSettings', 'Tenant starter content provisioning initialized-only UI guard');
  assertIncludes(page, 'restaurant.slug !== DEMO_RESTAURANT_SLUG', 'Tenant starter content provisioning non-demo UI guard');

  assertIncludes(tenantMenu, 'getTenantContentWhere(context)', 'Tenant starter content public menu tenant category read');
  assertIncludes(tenantMenu, 'getTenantRelationWhere(context)', 'Tenant starter content public menu tenant item read');
  assertIncludes(tenantGallery, 'getTenantContentWhere(context)', 'Tenant starter content public gallery tenant category read');
  assertIncludes(tenantGallery, 'getTenantRelationWhere(context)', 'Tenant starter content public gallery tenant photo read');
  assertIncludes(tenantOrder, 'ordering is not available yet', 'Tenant starter content non-demo order has unavailable state');
  assertIncludes(tenantOrder, 'Online ordering must be enabled for this tenant before checkout can accept orders.', 'Tenant starter content non-demo order feature-gated copy');

  assert(!fs.existsSync(path.join(root, 'src/app/api/provisioning')), 'Tenant starter content should not add provisioning API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/billing')), 'Tenant starter content should not add billing API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/payments')), 'Tenant starter content should not add payments API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/subscriptions')), 'Tenant starter content should not add subscriptions API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/crm')), 'Tenant starter content should not add CRM API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/email')), 'Tenant starter content should not add email API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/whatsapp')), 'Tenant starter content should not add WhatsApp API route');
  assertNotIncludes(packageJson, '"stripe"', 'Tenant starter content Stripe dependency');
  assertNotIncludes(packageJson, '"nodemailer"', 'Tenant starter content nodemailer dependency');

  assertIncludes(readme, 'Initialized tenants can now receive starter menu/gallery content.', 'README tenant starter content note');
  assertIncludes(readme, 'Starter content is platform-admin provisioned.', 'README tenant starter content platform action note');
  assertIncludes(readme, 'Tenant public menu/gallery pages read tenant-scoped content.', 'README tenant starter content public read note');
  assertIncludes(readme, 'Ordering, billing, custom domains, and broader tenant staff management are still future work.', 'README tenant starter content boundaries note');
  assertNotIncludes(readme, 'Ordering/admin users/billing/custom domains are still future work.', 'README stale tenant starter content boundaries note');
}

function checkRestaurantStaffAuthSchemaBoundary() {
  const packageJson = read('package.json');
  const schema = read('prisma/schema.prisma');
  const readme = read('README.md');
  const page = read('src/app/platform-admin/(protected)/client-restaurants/page.js');
  const action = read('src/app/platform-admin/(protected)/client-restaurants/actions.js');
  const platformLayout = read('src/app/platform-admin/(protected)/layout.js');
  const auth = read('src/lib/auth.js');
  const staffAuth = read('src/lib/restaurant-staff-auth.js');
  const middleware = read('middleware.js');
  const seed = read('prisma/seed.js');
  const envExample = read('.env.example');
  const blockerPath = path.join(root, 'docs/TENANT_ADMIN_ACCESS_FOUNDATION_BLOCKER.md');
  const migrationPath = path.join(root, 'prisma/migrations/20260609170000_add_restaurant_user_model/migration.sql');
  const loginApiPath = path.join(root, 'src/app/api/restaurant-admin/login/route.js');
  const logoutApiPath = path.join(root, 'src/app/api/restaurant-admin/logout/route.js');
  const tenantAdminPath = path.join(root, 'src/app/r/[restaurantSlug]/admin/page.js');
  const tenantAdminLoginPath = path.join(root, 'src/app/r/[restaurantSlug]/admin/login/page.js');
  const tenantAdminLayoutPath = path.join(root, 'src/app/r/[restaurantSlug]/admin/layout.js');

  assert(fs.existsSync(blockerPath), 'Tenant admin access foundation blocker doc is missing');
  assert(fs.existsSync(migrationPath), 'RestaurantUser schema boundary migration is missing');
  assert(fs.existsSync(loginApiPath), 'Restaurant staff login API route is missing');
  assert(fs.existsSync(logoutApiPath), 'Restaurant staff logout API route is missing');
  assert(fs.existsSync(tenantAdminPath), 'Tenant admin dashboard page is missing');
  assert(fs.existsSync(tenantAdminLoginPath), 'Tenant admin login page is missing');
  assert(fs.existsSync(tenantAdminLayoutPath), 'Tenant admin layout is missing');
  const blocker = read('docs/TENANT_ADMIN_ACCESS_FOUNDATION_BLOCKER.md');
  const migration = read('prisma/migrations/20260609170000_add_restaurant_user_model/migration.sql');
  const loginApi = read('src/app/api/restaurant-admin/login/route.js');
  const logoutApi = read('src/app/api/restaurant-admin/logout/route.js');
  const tenantAdmin = read('src/app/r/[restaurantSlug]/admin/page.js');
  const tenantAdminLogin = read('src/app/r/[restaurantSlug]/admin/login/page.js');
  const tenantAdminLayout = read('src/app/r/[restaurantSlug]/admin/layout.js');
  const restaurantBlock = getModelBlock(schema, 'Restaurant');
  const restaurantUserBlock = getModelBlock(schema, 'RestaurantUser');
  const adminUserBlock = getModelBlock(schema, 'AdminUser');
  const gatewayLeadBlock = getModelBlock(schema, 'GatewayLead');

  assertIncludes(restaurantBlock, 'restaurantUsers   RestaurantUser[]', 'Restaurant relation to RestaurantUser');
  assertIncludes(restaurantUserBlock, 'id           String     @id @default(cuid())', 'RestaurantUser id field');
  assertIncludes(restaurantUserBlock, 'restaurantId String', 'RestaurantUser required restaurantId field');
  assertIncludes(restaurantUserBlock, 'restaurant   Restaurant @relation(fields: [restaurantId], references: [id], onDelete: Cascade)', 'RestaurantUser required Restaurant relation');
  assertIncludes(restaurantUserBlock, 'email        String', 'RestaurantUser email field');
  assertIncludes(restaurantUserBlock, 'passwordHash String', 'RestaurantUser passwordHash field');
  assertIncludes(restaurantUserBlock, 'name         String?', 'RestaurantUser optional name field');
  assertIncludes(restaurantUserBlock, 'role         String     @default("OWNER")', 'RestaurantUser role default');
  assertIncludes(restaurantUserBlock, 'isActive     Boolean    @default(true)', 'RestaurantUser isActive default');
  assertIncludes(restaurantUserBlock, 'createdAt    DateTime   @default(now())', 'RestaurantUser createdAt field');
  assertIncludes(restaurantUserBlock, 'updatedAt    DateTime   @updatedAt', 'RestaurantUser updatedAt field');
  assertIncludes(restaurantUserBlock, 'lastLoginAt  DateTime?', 'RestaurantUser lastLoginAt field');
  assertIncludes(restaurantUserBlock, '@@unique([restaurantId, email])', 'RestaurantUser restaurantId email unique constraint');
  assertIncludes(restaurantUserBlock, '@@index([restaurantId])', 'RestaurantUser restaurantId index');
  assertIncludes(restaurantUserBlock, '@@index([email])', 'RestaurantUser email index');
  assertIncludes(restaurantUserBlock, '@@index([role])', 'RestaurantUser role index');
  assertIncludes(restaurantUserBlock, '@@index([isActive])', 'RestaurantUser isActive index');

  assertIncludes(migration, 'CREATE TABLE "RestaurantUser"', 'RestaurantUser migration creates table');
  assertIncludes(migration, '"restaurantId" TEXT NOT NULL', 'RestaurantUser migration required restaurantId');
  assertIncludes(migration, '"email" TEXT NOT NULL', 'RestaurantUser migration email field');
  assertIncludes(migration, '"passwordHash" TEXT NOT NULL', 'RestaurantUser migration passwordHash field');
  assertIncludes(migration, '"role" TEXT NOT NULL DEFAULT \'OWNER\'', 'RestaurantUser migration role default');
  assertIncludes(migration, '"isActive" BOOLEAN NOT NULL DEFAULT true', 'RestaurantUser migration isActive default');
  assertIncludes(migration, '"lastLoginAt" TIMESTAMP(3)', 'RestaurantUser migration lastLoginAt field');
  assertIncludes(migration, 'CREATE UNIQUE INDEX "RestaurantUser_restaurantId_email_key"', 'RestaurantUser migration unique restaurant email');
  assertIncludes(migration, 'CREATE INDEX "RestaurantUser_restaurantId_idx"', 'RestaurantUser migration restaurantId index');
  assertIncludes(migration, 'CREATE INDEX "RestaurantUser_email_idx"', 'RestaurantUser migration email index');
  assertIncludes(migration, 'CREATE INDEX "RestaurantUser_role_idx"', 'RestaurantUser migration role index');
  assertIncludes(migration, 'CREATE INDEX "RestaurantUser_isActive_idx"', 'RestaurantUser migration isActive index');
  assertIncludes(migration, 'ON DELETE CASCADE', 'RestaurantUser migration cascade restaurant relation');
  assertNotIncludes(migration.toUpperCase(), 'INSERT INTO', 'RestaurantUser migration should not insert rows');
  assertNotIncludes(migration, 'AdminUser', 'RestaurantUser migration should not modify AdminUser');
  assertNotIncludes(migration, 'GatewayLead', 'RestaurantUser migration should not modify GatewayLead');

  assertIncludes(adminUserBlock, 'email        String   @unique', 'Tenant admin blocker current AdminUser unique email');
  assertIncludes(adminUserBlock, 'role         String   @default("ADMIN")', 'Tenant admin blocker current AdminUser global role');
  assertNotIncludes(adminUserBlock, 'restaurantId', 'Tenant admin blocker AdminUser remains unscoped');
  assertNotIncludes(gatewayLeadBlock, 'restaurantId', 'Tenant admin blocker GatewayLead remains unscoped');
  assertIncludes(platformLayout, "admin.role !== 'ADMIN'", 'Tenant admin blocker platform ADMIN-only guard remains');
  assertIncludes(auth, 'jwt.sign({ id: admin.id, email: admin.email, role: admin.role }', 'Tenant admin blocker token has no tenant scope');
  assertNotIncludes(auth, 'restaurantId', 'Tenant admin blocker auth payload remains unscoped');

  assertIncludes(envExample, 'RESTAURANT_STAFF_JWT_SECRET', 'Restaurant staff JWT secret env example');
  assertIncludes(staffAuth, 'RESTAURANT_STAFF_COOKIE_NAME', 'Restaurant staff separate cookie constant');
  assertIncludes(staffAuth, 'aldayaa_restaurant_staff', 'Restaurant staff cookie name value');
  assertNotIncludes(staffAuth, 'aldayaa_admin', 'Restaurant staff auth must not use platform admin cookie');
  assertNotIncludes(staffAuth, "from './restaurants'", 'Restaurant staff auth should not import Prisma-backed restaurants helper');
  assertNotIncludes(staffAuth, 'from "./restaurants"', 'Restaurant staff auth should not import Prisma-backed restaurants helper double quote');
  assertNotIncludes(staffAuth, 'import { prisma }', 'Restaurant staff auth should not import Prisma at module load');
  assertIncludes(staffAuth, 'RESTAURANT_STAFF_ROLES', 'Restaurant staff role constants');
  assertIncludes(staffAuth, 'OWNER: \'OWNER\'', 'Restaurant staff OWNER role');
  assertIncludes(staffAuth, 'MANAGER: \'MANAGER\'', 'Restaurant staff MANAGER role');
  assertIncludes(staffAuth, 'SUPPORT: \'SUPPORT\'', 'Restaurant staff SUPPORT role');
  assertIncludes(staffAuth, "tokenType: 'restaurant_staff'", 'Restaurant staff token type payload');
  assertIncludes(staffAuth, 'restaurantId', 'Restaurant staff session payload includes restaurantId');
  assertIncludes(staffAuth, 'restaurantSlug', 'Restaurant staff session payload includes restaurantSlug');
  assertIncludes(staffAuth, 'createRestaurantStaffTokenPayload', 'Restaurant staff token payload helper');
  assertIncludes(staffAuth, 'Invalid restaurant staff payload', 'Restaurant staff payload validation');
  assertIncludes(staffAuth, 'RESTAURANT_STAFF_JWT_SECRET', 'Restaurant staff preferred JWT secret');
  assertIncludes(staffAuth, 'process.env.ADMIN_JWT_SECRET', 'Restaurant staff fallback JWT secret');
  assertIncludes(staffAuth, 'RESTAURANT_STAFF_JWT_SECRET must be configured in production', 'Restaurant staff production secret guard');
  assertIncludes(staffAuth, 'setRestaurantStaffSessionCookie', 'Restaurant staff set cookie helper');
  assertIncludes(staffAuth, 'clearRestaurantStaffSessionCookie', 'Restaurant staff clear cookie helper');
  assertIncludes(staffAuth, 'authenticateRestaurantStaff', 'Restaurant staff authentication helper');
  assertIncludes(staffAuth, "restaurantSlug === DEMO_RESTAURANT_SLUG", 'Restaurant staff rejects demo restaurant');
  assertIncludes(staffAuth, "restaurant.status === 'ARCHIVED'", 'Restaurant staff rejects archived restaurant');
  assertIncludes(staffAuth, '!staffUser.isActive', 'Restaurant staff rejects inactive users');
  assertIncludes(staffAuth, 'lastLoginAt: new Date()', 'Restaurant staff updates last login');
  assertIncludes(staffAuth, 'hashRestaurantStaffPassword', 'Restaurant staff password hash helper');
  assertIncludes(staffAuth, 'password.length < 10', 'Restaurant staff password min length');
  assertNotIncludes(staffAuth, 'setSessionCookie', 'Restaurant staff auth should not reuse platform admin session helper');

  assertIncludes(loginApi, 'authenticateRestaurantStaff', 'Restaurant staff login API authenticates staff');
  assertIncludes(loginApi, 'setRestaurantStaffSessionCookie', 'Restaurant staff login API sets staff cookie');
  assertIncludes(loginApi, 'restaurantSlug: z.string()', 'Restaurant staff login validates restaurantSlug');
  assertIncludes(loginApi, 'password: z.string().min(10)', 'Restaurant staff login validates password length');
  assertNotIncludes(loginApi, 'setSessionCookie', 'Restaurant staff login must not set platform admin cookie');
  assertNotIncludes(loginApi, 'requireAdmin', 'Restaurant staff login should be public');
  assertIncludes(logoutApi, 'clearRestaurantStaffSessionCookie', 'Restaurant staff logout clears staff cookie');
  assertNotIncludes(logoutApi, 'clearSessionCookie', 'Restaurant staff logout must not clear platform admin cookie');

  assertIncludes(middleware, 'RESTAURANT_STAFF_COOKIE_NAME', 'Middleware reads staff cookie');
  assertIncludes(middleware, 'isTenantAdminRoute', 'Middleware identifies tenant admin routes');
  assertIncludes(middleware, 'verifyRestaurantStaffToken', 'Middleware verifies staff token');
  assertNotIncludes(middleware, './src/lib/restaurants', 'Middleware should not import Prisma-backed restaurants helper');
  assertNotIncludes(middleware, './src/lib/prisma', 'Middleware should not import Prisma helper');
  assertNotIncludes(middleware, '@prisma/client', 'Middleware should not import Prisma client');
  assertIncludes(middleware, 'session.restaurantSlug !== restaurantSlug', 'Middleware enforces tenant slug boundary');
  assertIncludes(middleware, '`/r/${restaurantSlug}/admin/login`', 'Middleware tenant login redirect');
  assertIncludes(middleware, '`/r/${restaurantSlug}/admin`', 'Middleware authenticated login redirect');
  assertNotIncludes(middleware, 'COOKIE_NAME = "aldayaa_admin";\nconst JWT_SECRET', 'Middleware should not rely on weak platform fallback secret');
  assertIncludes(middleware, 'matcher: ["/admin/:path*", "/api/admin/:path*", "/r/:restaurantSlug/admin/:path*"]', 'Middleware matcher includes tenant admin');

  assertIncludes(tenantAdmin, 'requireRestaurantStaffAccess(cookies(), params.restaurantSlug)', 'Tenant admin page verifies DB-backed staff session');
  assertIncludes(tenantAdmin, "redirect(`/r/${params.restaurantSlug}/admin/login`)", 'Tenant admin page redirects unauthenticated staff');
  assertIncludes(tenantAdminLayout, 'bg-neutral-950', 'Tenant admin layout minimal shell styling');
  assertIncludes(tenantAdmin, 'Restaurant staff access is active', 'Tenant admin minimal dashboard copy');
  assertIncludes(tenantAdmin, 'Tenant-scoped menu, gallery, profile, settings, staff management, reservations, tables, order status management, kitchen queue operations, and inventory management are available now.', 'Tenant admin current modules copy');
  assertIncludes(tenantAdminLogin, '/api/restaurant-admin/login', 'Tenant admin login posts to staff login API');
  assertIncludes(tenantAdminLogin, 'restaurantSlug', 'Tenant admin login sends route slug');
  assertNotIncludes(tenantAdmin, 'MenuClient', 'Tenant admin dashboard should not expose menu tools');
  assertNotIncludes(tenantAdmin, 'GalleryClient', 'Tenant admin dashboard should not expose gallery tools');
  assertNotIncludes(tenantAdmin, 'OrdersClient', 'Tenant admin dashboard should not expose orders tools');

  assertIncludes(blocker, 'Foundation status: first-owner login resolved by Batch 50; tenant menu/gallery management resolved by Batch 51; tenant profile/settings management resolved by Batch 52; tenant staff management foundation resolved by Batch 53; tenant reservations management resolved by Batch 54; tenant table management foundation resolved by Batch 55; tenant order API boundary foundation resolved by Batch 56; tenant public order creation resolved by Batch 57; tenant table QR ordering resolved by Batch 58; tenant public order support actions resolved by Batch 59; tenant public reservation support actions resolved by Batch 60; tenant kitchen queue operations resolved by Batch 61; tenant inventory management foundation resolved by Batch 62.', 'Tenant admin foundation current status');
  assertIncludes(blocker, 'Batch 50 adds first-owner provisioning and restaurant staff login.', 'Tenant admin doc Batch 50 update');
  assertIncludes(blocker, 'Batch 51 adds tenant-scoped menu/gallery management.', 'Tenant admin doc Batch 51 update');
  assertIncludes(blocker, 'Batch 52 adds tenant-scoped profile/settings management.', 'Tenant admin doc Batch 52 update');
  assertIncludes(blocker, 'Batch 53 adds OWNER-only tenant staff management for RestaurantUser records.', 'Tenant admin doc Batch 53 update');
  assertIncludes(blocker, 'Batch 54 adds tenant-scoped reservation viewing, status management, and public tenant reservation creation.', 'Tenant admin doc Batch 54 update');
  assertIncludes(blocker, 'Batch 55 adds tenant-scoped table management for table labels, zones, seats, active state, and QR token references without activating tenant table ordering.', 'Tenant admin doc Batch 55 update');
  assertIncludes(blocker, 'Batch 56 adds tenant-scoped order reads and status management without activating public tenant ordering.', 'Tenant admin doc Batch 56 update');
  assertIncludes(blocker, 'Batch 57 activates tenant-safe public order creation for initialized, non-archived tenants when ONLINE_ORDERING is enabled.', 'Tenant admin doc Batch 57 update');
  assertIncludes(blocker, 'Batch 58 activates tenant-safe table QR ordering for initialized, non-archived tenants when ONLINE_ORDERING and TABLE_QR_ORDERING are enabled.', 'Tenant admin doc Batch 58 update');
  assertIncludes(blocker, 'Batch 59 adds tenant-scoped public order tracking and cancellation using restaurantSlug, reference, and phone.', 'Tenant admin doc Batch 59 update');
  assertIncludes(blocker, 'Batch 60 adds tenant-scoped public reservation lookup and cancellation using restaurantSlug, reference, and phone.', 'Tenant admin doc Batch 60 update');
  assertIncludes(blocker, 'Batch 49 adds a separate RestaurantUser model.', 'Tenant admin blocker RestaurantUser schema update');
  assertIncludes(blocker, 'Platform `AdminUser` remains separate from `RestaurantUser`.', 'Tenant admin foundation separate platform users');
  assertIncludes(blocker, 'restaurant staff sessions use `aldayaa_restaurant_staff`, not `aldayaa_admin`', 'Tenant admin foundation separate cookie');
  assertIncludes(blocker, 'tenant staff sessions cannot access `/platform-admin`', 'Tenant admin foundation platform boundary');
  assertIncludes(blocker, 'Restaurant staff access now includes tenant-scoped menu, gallery, profile, settings, staff management foundation, reservations management, table management foundation, order status management foundation, kitchen queue operations, inventory management foundation, public tenant order creation when enabled, tenant table QR ordering when enabled, tenant public order support actions, and tenant public reservation support actions.', 'Tenant admin enabled modules note');
  assertIncludes(blocker, 'Assisted ordering, payments, refunds, messaging, advanced guest automation, advanced kitchen automation, automatic recipe depletion, order inventory consumption, supplier ordering, invoices, staff invitations, audit logging, self-service password reset flows, billing, domains, CRM, payroll, analytics, email, and WhatsApp automation remain future work.', 'Tenant admin operational modules future note');
  assertNotIncludes(blocker, 'Restaurant staff login is authentication-only for now.', 'Tenant admin doc stale auth-only wording');
  assertNotIncludes(blocker, 'Menu, gallery, orders, reservations, settings, inventory, recipes, staff management, and other tenant admin modules are not enabled yet.', 'Tenant admin doc stale module future wording');
  assertNotIncludes(blocker, 'Blocker status: partially resolved by Batch 49 schema boundary.', 'Tenant admin doc stale Batch 49 blocker status');
  assertNotIncludes(blocker, 'roles cannot be safely separated yet', 'Tenant admin doc stale role separation blocker');
  assertNotIncludes(blocker, 'Tenant admin creation remains future work', 'Tenant admin doc stale tenant creation future wording');

  assertIncludes(page, 'tenant admin access status', 'Client restaurant registry tenant admin access status copy');
  assertIncludes(page, 'tenantOwnerCount', 'Client restaurant registry tenant owner count');
  assertIncludes(page, 'Create first owner access', 'Client restaurant registry first owner button');
  assertIncludes(page, 'Tenant admin login', 'Client restaurant registry tenant admin login link');
  assertIncludes(page, "OWNER {restaurant.tenantOwnerCount > 0 ? 'created' : 'missing'}", 'Client restaurant registry owner created/missing status');
  assertIncludes(page, "Auth {restaurant.tenantOwnerCount > 0 ? 'ready' : 'pending'}", 'Client restaurant registry auth ready/pending status');
  assertIncludes(page, 'Operational modules pending', 'Client restaurant registry operational modules pending status');
  assertNotIncludes(page, 'Admin access blocked', 'Client restaurant registry should not always show admin blocked');
  assertIncludes(page, 'restaurant.hasProfile && restaurant.hasSettings', 'Client restaurant owner creation initialized-only UI guard');
  assertIncludes(page, 'restaurant.slug !== DEMO_RESTAURANT_SLUG', 'Client restaurant owner creation non-demo UI guard');
  assertIncludes(action, 'createTenantOwnerAccess', 'Tenant owner creation action exists');
  const ownerAction = getExportedFunctionSource(action, 'createTenantOwnerAccess');
  assertIncludes(ownerAction, 'getAdminFromRequest(cookies())', 'Tenant owner creation platform admin auth lookup');
  assertIncludes(ownerAction, "admin.role !== 'ADMIN'", 'Tenant owner creation platform ADMIN-only guard');
  assertIncludes(ownerAction, 'restaurant.slug === DEMO_RESTAURANT_SLUG', 'Tenant owner creation rejects Demo Restaurant');
  assertIncludes(ownerAction, "restaurant.status === 'ARCHIVED'", 'Tenant owner creation rejects archived restaurants');
  assertIncludes(ownerAction, 'Archived restaurants cannot receive tenant owner access.', 'Tenant owner creation archived error copy');
  assertIncludes(ownerAction, 'prisma.restaurantProfile.findUnique', 'Tenant owner creation requires profile');
  assertIncludes(ownerAction, 'prisma.restaurantSettings.findUnique', 'Tenant owner creation requires settings');
  assertIncludes(action, 'z.string().email()', 'Tenant owner creation validates email');
  assertIncludes(action, 'z.string().min(10)', 'Tenant owner creation validates password length');
  assertIncludes(ownerAction, 'hashRestaurantStaffPassword', 'Tenant owner creation hashes password');
  assertIncludes(ownerAction, 'prisma.restaurantUser.count', 'Tenant owner creation prevents duplicate owner');
  assertIncludes(ownerAction, 'role: RESTAURANT_STAFF_ROLES.OWNER', 'Tenant owner creation creates OWNER role');
  assertIncludes(ownerAction, 'prisma.restaurantUser.findUnique', 'Tenant owner creation checks duplicate restaurant email');
  assertIncludes(ownerAction, 'prisma.restaurantUser.create', 'Tenant owner creation creates RestaurantUser');
  assertIncludes(ownerAction, 'redirectWithOwner', 'Tenant owner creation redirects with owner message');
  assertNotIncludes(action, 'prisma.adminUser.create', 'Tenant admin blocker should not create AdminUser');
  assertNotIncludes(ownerAction, 'prisma.adminUser', 'Tenant owner creation must not touch AdminUser');
  assertNotIncludes(ownerAction, 'gatewayLead', 'Tenant owner creation must not touch GatewayLead');
  assertNotIncludes(action, 'hashPassword(', 'Tenant owner creation should use staff password helper');
  assertNotIncludes(seed, 'restaurantUser', 'RestaurantUser rows should not be created by seed');

  assertNotIncludes(staffAuth, 'order.create', 'Restaurant staff auth boundary should not create orders');
  assertNotIncludes(staffAuth, 'reservation.create', 'Restaurant staff auth boundary should not create reservations');
  assertNotIncludes(staffAuth, 'inventoryItem.create', 'Restaurant staff auth boundary should not create inventory');
  assertNotIncludes(staffAuth, 'menuItemIngredient.create', 'Restaurant staff auth boundary should not create recipes');
  assertNotIncludes(staffAuth, 'gatewayLead.create', 'Restaurant staff auth boundary should not create GatewayLead rows');
  assertNotIncludes(staffAuth, 'menuCategory.create', 'Restaurant staff auth boundary should not create menu rows');
  assertNotIncludes(staffAuth, 'galleryCategory.create', 'Restaurant staff auth boundary should not create gallery rows');
  assertNotIncludes(staffAuth, 'sendMail', 'Restaurant staff auth boundary should not send email');
  assertNotIncludes(staffAuth, 'sendWhatsApp', 'Restaurant staff auth boundary should not send WhatsApp');

  assert(!fs.existsSync(path.join(root, 'src/app/api/provisioning')), 'Tenant admin blocker should not add provisioning API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/billing')), 'Tenant admin blocker should not add billing API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/payments')), 'Tenant admin blocker should not add payments API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/subscriptions')), 'Tenant admin blocker should not add subscriptions API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/crm')), 'Tenant admin blocker should not add CRM API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/email')), 'Tenant admin blocker should not add email API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/whatsapp')), 'Tenant admin blocker should not add WhatsApp API route');
  assertNotIncludes(packageJson, '"stripe"', 'Tenant admin blocker Stripe dependency');
  assertNotIncludes(packageJson, '"nodemailer"', 'Tenant admin blocker nodemailer dependency');

  assertIncludes(readme, 'Restaurant staff auth schema boundary added.', 'README restaurant staff schema boundary note');
  assertIncludes(readme, 'RestaurantUser is separate from platform AdminUser.', 'README restaurant user separation note');
  assertIncludes(readme, 'Tenant first-owner provisioning and restaurant staff login added.', 'README tenant admin provisioning note');
  assertIncludes(readme, 'Platform ADMIN can create the first OWNER RestaurantUser for initialized non-demo tenants.', 'README tenant owner creation note');
  assertIncludes(readme, 'Tenant staff login uses `/r/[restaurantSlug]/admin/login` and `/api/restaurant-admin/login`.', 'README tenant login route note');
  assertIncludes(readme, 'Staff sessions use `aldayaa_restaurant_staff`, not `aldayaa_admin`, and cannot access `/platform-admin`.', 'README tenant staff platform boundary note');
  assertNotIncludes(readme, 'No tenant admin creation action was added.', 'README stale no tenant admin action note');
  assertNotIncludes(readme, 'Tenant admin creation and login/session wiring remain future work.', 'README stale tenant login future note');
  assertNotIncludes(readme, 'No restaurant-scoped AdminUser or membership model exists yet.', 'README stale missing restaurant user note');
}

function checkTenantMenuGalleryAdmin() {
  const readme = read('README.md');
  const helperPath = path.join(root, 'src/lib/restaurant-staff-access.js');
  const tenantNavPath = path.join(root, 'src/app/r/[restaurantSlug]/admin/TenantAdminNav.jsx');
  const tenantAdminPath = path.join(root, 'src/app/r/[restaurantSlug]/admin/page.js');
  const tenantMenuPagePath = path.join(root, 'src/app/r/[restaurantSlug]/admin/menu/page.js');
  const tenantMenuClientPath = path.join(root, 'src/app/r/[restaurantSlug]/admin/menu/TenantMenuClient.jsx');
  const tenantGalleryPagePath = path.join(root, 'src/app/r/[restaurantSlug]/admin/gallery/page.js');
  const tenantGalleryClientPath = path.join(root, 'src/app/r/[restaurantSlug]/admin/gallery/TenantGalleryClient.jsx');
  const apiPaths = [
    'src/app/api/restaurant-admin/menu/categories/route.js',
    'src/app/api/restaurant-admin/menu/categories/[id]/route.js',
    'src/app/api/restaurant-admin/menu/items/route.js',
    'src/app/api/restaurant-admin/menu/items/[id]/route.js',
    'src/app/api/restaurant-admin/gallery/categories/route.js',
    'src/app/api/restaurant-admin/gallery/categories/[id]/route.js',
    'src/app/api/restaurant-admin/gallery/photos/route.js',
    'src/app/api/restaurant-admin/gallery/photos/[id]/route.js',
  ];

  assert(fs.existsSync(helperPath), 'Restaurant staff access helper is missing');
  assert(fs.existsSync(tenantNavPath), 'Tenant admin navigation is missing');
  assert(fs.existsSync(tenantMenuPagePath), 'Tenant menu admin page is missing');
  assert(fs.existsSync(tenantMenuClientPath), 'Tenant menu admin client is missing');
  assert(fs.existsSync(tenantGalleryPagePath), 'Tenant gallery admin page is missing');
  assert(fs.existsSync(tenantGalleryClientPath), 'Tenant gallery admin client is missing');
  for (const apiPath of apiPaths) {
    assert(fs.existsSync(path.join(root, apiPath)), `${apiPath} is missing`);
  }

  const helper = read('src/lib/restaurant-staff-access.js');
  const tenantNav = read('src/app/r/[restaurantSlug]/admin/TenantAdminNav.jsx');
  const tenantAdmin = read('src/app/r/[restaurantSlug]/admin/page.js');
  const tenantMenuPage = read('src/app/r/[restaurantSlug]/admin/menu/page.js');
  const tenantMenuClient = read('src/app/r/[restaurantSlug]/admin/menu/TenantMenuClient.jsx');
  const tenantGalleryPage = read('src/app/r/[restaurantSlug]/admin/gallery/page.js');
  const tenantGalleryClient = read('src/app/r/[restaurantSlug]/admin/gallery/TenantGalleryClient.jsx');
  const apiSources = apiPaths.map((apiPath) => [apiPath, read(apiPath)]);
  const allTenantApiSource = apiSources.map(([, source]) => source).join('\n');

  assertIncludes(helper, 'getRestaurantStaffFromRequest', 'Tenant staff helper reads restaurant staff session');
  assertIncludes(helper, 'staff.restaurantSlug !== cleanSlug', 'Tenant staff helper enforces route slug boundary');
  assertIncludes(helper, 'prisma.restaurantUser.findUnique', 'Tenant staff helper verifies RestaurantUser from DB');
  assertIncludes(helper, 'include: {', 'Tenant staff helper includes related Restaurant');
  assertIncludes(helper, 'currentStaff.restaurantId !== staff.restaurantId', 'Tenant staff helper verifies DB restaurantId matches token');
  assertIncludes(helper, '!currentStaff.isActive', 'Tenant staff helper rejects inactive RestaurantUser');
  assertIncludes(helper, '!isValidCurrentRestaurantStaffRole(currentStaff.role)', 'Tenant staff helper validates current DB role');
  assertIncludes(helper, '!currentStaff.restaurant', 'Tenant staff helper requires related Restaurant');
  assertIncludes(helper, 'currentStaff.restaurant.slug !== cleanSlug', 'Tenant staff helper verifies Restaurant slug boundary from DB');
  assertIncludes(helper, "currentStaff.restaurant.status === 'ARCHIVED'", 'Tenant staff helper rejects archived restaurants');
  assertIncludes(helper, 'Restaurant staff access is no longer active for this restaurant', 'Tenant staff helper inactive access error');
  assertIncludes(helper, 'return currentSession', 'Tenant staff helper returns DB-backed session');
  assertIncludes(helper, 'RESTAURANT_STAFF_WRITE_ROLES', 'Tenant staff helper defines write roles');
  assertIncludes(helper, 'RESTAURANT_STAFF_ROLES.OWNER', 'Tenant staff write role includes OWNER');
  assertIncludes(helper, 'RESTAURANT_STAFF_ROLES.MANAGER', 'Tenant staff write role includes MANAGER');
  assertIncludes(helper, 'OWNER or MANAGER access is required', 'Tenant staff helper write error copy');
  assertNotIncludes(helper, 'requireAdmin', 'Tenant staff helper must not use platform admin auth');
  assertNotIncludes(helper, 'adminUser', 'Tenant staff helper must not touch AdminUser');
  assertNotIncludes(helper, 'gatewayLead', 'Tenant staff helper must not touch GatewayLead');

  assertIncludes(tenantNav, 'Menu', 'Tenant admin navigation includes Menu');
  assertIncludes(tenantNav, 'Gallery', 'Tenant admin navigation includes Gallery');
  assertIncludes(tenantNav, "label: 'Orders'", 'Tenant admin navigation includes Orders');
  assertIncludes(tenantNav, "label: 'Reservations'", 'Tenant admin navigation includes Reservations route');
  assertIncludes(tenantNav, "href: `/r/${restaurantSlug}/admin/reservations`", 'Tenant admin navigation reservations route');
  assertIncludes(tenantNav, "href: `/r/${restaurantSlug}/admin/settings`", 'Tenant admin navigation includes Settings route');
  assertIncludes(tenantAdmin, 'Open menu', 'Tenant admin dashboard links to menu');
  assertIncludes(tenantAdmin, 'Open gallery', 'Tenant admin dashboard links to gallery');
  assertIncludes(tenantAdmin, 'Open settings', 'Tenant admin dashboard links to settings');
  assertIncludes(tenantAdmin, 'Assisted ordering, payments, advanced kitchen automation, automatic inventory consumption, recipes, advanced staff workflows, billing, domains, email, and WhatsApp automation remain future tenant admin work.', 'Tenant admin dashboard future module boundary');
  assertIncludes(tenantMenuPage, 'getRestaurantStaffFromRequest', 'Tenant menu page verifies staff session');
  assertIncludes(tenantMenuPage, 'staff.restaurantSlug !== params.restaurantSlug', 'Tenant menu page enforces slug boundary');
  assertIncludes(tenantGalleryPage, 'getRestaurantStaffFromRequest', 'Tenant gallery page verifies staff session');
  assertIncludes(tenantGalleryPage, 'staff.restaurantSlug !== params.restaurantSlug', 'Tenant gallery page enforces slug boundary');
  assertIncludes(tenantMenuClient, '/api/restaurant-admin/menu/categories', 'Tenant menu client uses restaurant-admin category API');
  assertIncludes(tenantMenuClient, '/api/restaurant-admin/menu/items', 'Tenant menu client uses restaurant-admin item API');
  assertIncludes(tenantMenuClient, 'updateCategory', 'Tenant menu client supports category edits');
  assertIncludes(tenantMenuClient, 'updateItem', 'Tenant menu client supports item edits');
  assertIncludes(tenantMenuClient, "method: 'PUT'", 'Tenant menu client calls PUT APIs');
  assertIncludes(tenantMenuClient, 'window.confirm', 'Tenant menu client confirms destructive deletes');
  assertIncludes(tenantMenuClient, 'SUPPORT access is read-only', 'Tenant menu client support read-only state');
  assertIncludes(tenantGalleryClient, '/api/restaurant-admin/gallery/categories', 'Tenant gallery client uses restaurant-admin category API');
  assertIncludes(tenantGalleryClient, '/api/restaurant-admin/gallery/photos', 'Tenant gallery client uses restaurant-admin photo API');
  assertIncludes(tenantGalleryClient, 'updateCategory', 'Tenant gallery client supports category edits');
  assertIncludes(tenantGalleryClient, 'updatePhoto', 'Tenant gallery client supports photo edits');
  assertIncludes(tenantGalleryClient, "method: 'PUT'", 'Tenant gallery client calls PUT APIs');
  assertIncludes(tenantGalleryClient, 'window.confirm', 'Tenant gallery client confirms destructive deletes');
  assertIncludes(tenantGalleryClient, 'SUPPORT access is read-only', 'Tenant gallery client support read-only state');

  for (const [apiPath, source] of apiSources) {
    assertIncludes(source, 'requireRestaurantStaffAccess', `${apiPath} uses restaurant staff auth`);
    assertIncludes(source, 'staff.restaurantId', `${apiPath} scopes queries by restaurantId`);
    assertIncludes(source, 'restaurantSlug', `${apiPath} validates restaurantSlug`);
    assertNotIncludes(source, 'requireAdmin', `${apiPath} must not use platform requireAdmin`);
    assertNotIncludes(source, 'getAdminFromRequest', `${apiPath} must not use platform admin session`);
    assertNotIncludes(source, 'prisma.adminUser', `${apiPath} must not touch AdminUser`);
    assertNotIncludes(source, 'prisma.gatewayLead', `${apiPath} must not touch GatewayLead`);
    assertNotIncludes(source, 'stripe', `${apiPath} must not add billing/payment logic`);
    assertNotIncludes(source, 'sendMail', `${apiPath} must not send email`);
    assertNotIncludes(source, 'sendWhatsApp', `${apiPath} must not send WhatsApp`);
  }

  assertIncludes(allTenantApiSource, 'where: { id: params.id, restaurantId: staff.restaurantId }', 'Tenant item/category/photo APIs reject cross-tenant id access');
  assertIncludes(allTenantApiSource, '{ write: true }', 'Tenant write operations require OWNER/MANAGER');
  assertIncludes(allTenantApiSource, 'prisma.menuCategory.create', 'Tenant menu API creates categories');
  assertIncludes(allTenantApiSource, 'prisma.menuItem.create', 'Tenant menu API creates items');
  assertIncludes(allTenantApiSource, 'prisma.galleryCategory.create', 'Tenant gallery API creates categories');
  assertIncludes(allTenantApiSource, 'prisma.photo.create', 'Tenant gallery API creates photos');
  assertNotIncludes(allTenantApiSource, 'restaurantId: undefined', 'Tenant APIs must not write unscoped restaurantId');

  assert(fs.existsSync(path.join(root, 'src/app/admin/(protected)/menu/page.jsx')), 'Demo admin menu page should remain present');
  assert(fs.existsSync(path.join(root, 'src/app/admin/(protected)/gallery/page.jsx')), 'Demo admin gallery page should remain present');
  assert(!fs.existsSync(path.join(root, 'src/app/api/billing')), 'Tenant menu/gallery batch should not add billing API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/payments')), 'Tenant menu/gallery batch should not add payments API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/email')), 'Tenant menu/gallery batch should not add email API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/whatsapp')), 'Tenant menu/gallery batch should not add WhatsApp API route');

  assertIncludes(readme, 'Tenant menu/gallery admin added.', 'README Batch 51 tenant menu/gallery note');
  assertIncludes(readme, 'Restaurant staff access includes tenant-scoped menu, gallery, profile, settings, staff management foundation, reservations management, table management foundation, order status management foundation, kitchen queue operations, inventory management foundation, public tenant order creation when ONLINE_ORDERING is enabled, tenant table QR ordering when TABLE_QR_ORDERING is enabled, tenant public order support actions, and tenant public reservation support actions; assisted ordering, payments, refunds, messaging, advanced guest automation, advanced kitchen automation, automatic inventory consumption, recipes, billing, domains, email, and WhatsApp automation remain future work.', 'README Batch 60 updated tenant staff access note');
  assertIncludes(readme, 'OWNER and MANAGER can write; SUPPORT is read-only.', 'README Batch 51 role boundary note');
  assertIncludes(readme, 'Inventory, recipes, broader staff management, billing, domains, email, and WhatsApp automation remain future work.', 'README Batch 57 future modules note');
  assertNotIncludes(readme, 'Restaurant staff access is authentication-only for now; operational tenant admin modules remain future work.', 'README stale Batch 50 auth-only tenant staff note');
  assertNotIncludes(readme, 'orders, reservations, settings, inventory, recipes, staff management, billing, domains, email, and WhatsApp automation remain future work.', 'README stale settings future work note');
}

function checkTenantProfileSettingsAdmin() {
  const readme = read('README.md');
  const tenantSettingsPagePath = path.join(root, 'src/app/r/[restaurantSlug]/admin/settings/page.js');
  const tenantSettingsClientPath = path.join(root, 'src/app/r/[restaurantSlug]/admin/settings/TenantSettingsClient.jsx');
  const tenantNavPath = path.join(root, 'src/app/r/[restaurantSlug]/admin/TenantAdminNav.jsx');
  const profileRoutePath = path.join(root, 'src/app/api/restaurant-admin/profile/route.js');
  const settingsRoutePath = path.join(root, 'src/app/api/restaurant-admin/settings/route.js');

  assert(fs.existsSync(tenantSettingsPagePath), 'Tenant settings admin page is missing');
  assert(fs.existsSync(tenantSettingsClientPath), 'Tenant settings admin client is missing');
  assert(fs.existsSync(profileRoutePath), 'Tenant profile API route is missing');
  assert(fs.existsSync(settingsRoutePath), 'Tenant settings API route is missing');

  const tenantSettingsPage = read('src/app/r/[restaurantSlug]/admin/settings/page.js');
  const tenantSettingsClient = read('src/app/r/[restaurantSlug]/admin/settings/TenantSettingsClient.jsx');
  const tenantNav = read('src/app/r/[restaurantSlug]/admin/TenantAdminNav.jsx');
  const profileRoute = read('src/app/api/restaurant-admin/profile/route.js');
  const settingsRoute = read('src/app/api/restaurant-admin/settings/route.js');
  const tenantSettingsApiSource = `${profileRoute}\n${settingsRoute}`;
  const tenantSettingsUiSource = `${tenantSettingsPage}\n${tenantSettingsClient}\n${tenantNav}`;

  assertIncludes(tenantSettingsPage, 'getRestaurantStaffFromRequest', 'Tenant settings page verifies staff session');
  assertIncludes(tenantSettingsPage, 'staff.restaurantSlug !== params.restaurantSlug', 'Tenant settings page enforces slug boundary');
  assertIncludes(tenantSettingsPage, '<TenantSettingsClient', 'Tenant settings page renders client');
  assertIncludes(tenantSettingsPage, 'Platform-owned tenant', 'Tenant settings page platform-owned boundary copy');
  assertIncludes(tenantSettingsClient, '/api/restaurant-admin/profile', 'Tenant settings client uses tenant profile API');
  assertIncludes(tenantSettingsClient, '/api/restaurant-admin/settings', 'Tenant settings client uses tenant settings API');
  assertIncludes(tenantSettingsClient, "method: 'PUT'", 'Tenant settings client calls PUT APIs');
  assertIncludes(tenantSettingsClient, 'SUPPORT access is read-only', 'Tenant settings client support read-only state');
  assertIncludes(tenantSettingsClient, 'OWNER or MANAGER access is required', 'Tenant settings client write role copy');
  assertIncludes(tenantSettingsClient, 'Feature modules read-only', 'Tenant settings client keeps feature modules read-only');
  assertIncludes(tenantSettingsClient, 'Ordering activation and feature modules are not editable', 'Tenant settings client ordering activation boundary');
  assertNotIncludes(tenantSettingsClient, 'enabledFeatures: profile', 'Tenant settings client must not submit enabledFeatures updates');
  assertNotIncludes(tenantSettingsClient, 'enabledFeatures: settings', 'Tenant settings client must not submit enabledFeatures settings updates');
  assertIncludes(tenantNav, "label: 'Settings'", 'Tenant navigation includes Settings');
  assertIncludes(tenantNav, "href: `/r/${restaurantSlug}/admin/settings`", 'Tenant navigation settings link');
  assertNotIncludes(tenantNav, "'Settings', 'Inventory'", 'Tenant settings should not remain future nav item');

  for (const [label, source] of [
    ['Tenant profile API', profileRoute],
    ['Tenant settings API', settingsRoute],
  ]) {
    assertIncludes(source, 'requireRestaurantStaffAccess', `${label} uses restaurant staff auth`);
    assertIncludes(source, 'staff.restaurantId', `${label} scopes by restaurantId`);
    assertIncludes(source, '{ write: true }', `${label} requires OWNER/MANAGER for writes`);
    assertIncludes(source, 'restaurantSlug', `${label} validates restaurantSlug`);
    assertIncludes(source, 'findUnique', `${label} loads existing tenant-owned row`);
    assertIncludes(source, 'update', `${label} updates existing tenant-owned row`);
    assertNotIncludes(source, 'requireAdmin', `${label} must not use platform requireAdmin`);
    assertNotIncludes(source, 'getAdminFromRequest', `${label} must not use platform admin session`);
    assertNotIncludes(source, 'prisma.adminUser', `${label} must not touch AdminUser`);
    assertNotIncludes(source, 'prisma.gatewayLead', `${label} must not touch GatewayLead`);
    assertNotIncludes(source, 'stripe', `${label} must not add billing/payment logic`);
    assertNotIncludes(source, 'sendMail', `${label} must not send email`);
    assertNotIncludes(source, 'sendWhatsApp', `${label} must not send WhatsApp`);
    assertNotIncludes(source, 'domain', `${label} must not manage custom domains`);
    assertNotIncludes(source, 'restaurant.create', `${label} must not provision tenants`);
  }

  assertIncludes(profileRoute, 'stripPlatformOwnedProfileFields', 'Tenant profile API strips platform-owned fields');
  assertIncludes(profileRoute, 'delete safeProfile.restaurantSlug', 'Tenant profile API strips restaurant slug');
  assertIncludes(profileRoute, 'delete safeProfile.enabledFeatures', 'Tenant profile API strips enabledFeatures');
  assertIncludes(profileRoute, 'enabledFeatures: existingProfile.enabledFeatures', 'Tenant profile API preserves enabledFeatures');
  assertIncludes(profileRoute, 'where: { restaurantId: staff.restaurantId }', 'Tenant profile API restaurantId unique lookup');
  assertIncludes(settingsRoute, 'where: { restaurantId: staff.restaurantId }', 'Tenant settings API restaurantId unique lookup');
  assertIncludes(settingsRoute, 'normalizeWorkingHoursByDay', 'Tenant settings API normalizes working hours');
  assertNotIncludes(settingsRoute, 'enabledFeatures', 'Tenant settings API must not activate feature modules');
  assertNotIncludes(tenantSettingsApiSource, 'prisma.order', 'Tenant profile/settings APIs must not write order data');
  assertNotIncludes(tenantSettingsApiSource, 'prisma.reservation', 'Tenant profile/settings APIs must not write reservation data');
  assertNotIncludes(tenantSettingsApiSource, 'prisma.menuItem', 'Tenant profile/settings APIs must not write menu data');
  assertNotIncludes(tenantSettingsApiSource, 'prisma.photo', 'Tenant profile/settings APIs must not write gallery data');
  assertNotIncludes(tenantSettingsApiSource, 'upsert', 'Tenant profile/settings APIs should not provision missing rows');

  assertIncludes(readme, 'Tenant profile/settings admin added.', 'README Batch 52 note');
  assertIncludes(readme, 'Restaurant staff can manage tenant-scoped public profile metadata, contact links, brand colors, display hours, and cancellation settings under `/r/[restaurantSlug]/admin/settings`.', 'README Batch 52 scope note');
  assertIncludes(readme, 'OWNER and MANAGER can update profile/settings; SUPPORT remains read-only.', 'README Batch 52 role note');
  assertIncludes(readme, 'Feature/module activation beyond online/table ordering, assisted ordering, payments, advanced kitchen automation, inventory consumption, recipes, broader staff management, billing, domains, email, and WhatsApp automation remain future work.', 'README Batch 58 future boundary note');
  assertNotIncludes(readme, 'orders, reservations, settings, inventory, recipes', 'README should not say settings remain future work after Batch 52');

  assert(fs.existsSync(path.join(root, 'src/app/admin/(protected)/settings/page.jsx')), 'Demo admin settings page should remain present');
  assert(!fs.existsSync(path.join(root, 'src/app/api/billing')), 'Tenant settings batch should not add billing API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/payments')), 'Tenant settings batch should not add payments API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/domains')), 'Tenant settings batch should not add domains API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/email')), 'Tenant settings batch should not add email API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/whatsapp')), 'Tenant settings batch should not add WhatsApp API route');
  assertNotIncludes(tenantSettingsUiSource, '/platform-admin', 'Tenant settings UI must not link to platform admin');
}

function checkTenantStaffManagementFoundation() {
  const readme = read('README.md');
  const migrationDirs = fs.readdirSync(path.join(root, 'prisma/migrations'));
  const accessHelperPath = path.join(root, 'src/lib/restaurant-staff-access.js');
  const managementHelperPath = path.join(root, 'src/lib/restaurant-staff-management.js');
  const collectionRoutePath = path.join(root, 'src/app/api/restaurant-admin/staff/route.js');
  const itemRoutePath = path.join(root, 'src/app/api/restaurant-admin/staff/[id]/route.js');
  const tenantStaffPagePath = path.join(root, 'src/app/r/[restaurantSlug]/admin/staff/page.js');
  const tenantStaffClientPath = path.join(root, 'src/app/r/[restaurantSlug]/admin/staff/TenantStaffClient.jsx');

  assert(fs.existsSync(accessHelperPath), 'Restaurant staff access helper is missing');
  assert(fs.existsSync(managementHelperPath), 'Restaurant staff management helper is missing');
  assert(fs.existsSync(collectionRoutePath), 'Tenant staff collection API route is missing');
  assert(fs.existsSync(itemRoutePath), 'Tenant staff item API route is missing');
  assert(fs.existsSync(tenantStaffPagePath), 'Tenant staff admin page is missing');
  assert(fs.existsSync(tenantStaffClientPath), 'Tenant staff admin client is missing');

  const accessHelper = read('src/lib/restaurant-staff-access.js');
  const managementHelper = read('src/lib/restaurant-staff-management.js');
  const collectionRoute = read('src/app/api/restaurant-admin/staff/route.js');
  const itemRoute = read('src/app/api/restaurant-admin/staff/[id]/route.js');
  const tenantStaffPage = read('src/app/r/[restaurantSlug]/admin/staff/page.js');
  const tenantStaffClient = read('src/app/r/[restaurantSlug]/admin/staff/TenantStaffClient.jsx');
  const tenantNav = read('src/app/r/[restaurantSlug]/admin/TenantAdminNav.jsx');
  const tenantAdmin = read('src/app/r/[restaurantSlug]/admin/page.js');
  const allStaffApiSource = `${collectionRoute}\n${itemRoute}`;

  assertIncludes(accessHelper, 'requireRestaurantStaffOwnerAccess', 'OWNER-only restaurant staff access helper');
  assertIncludes(accessHelper, "role === RESTAURANT_STAFF_ROLES.OWNER", 'OWNER-only helper role check');
  assertIncludes(accessHelper, 'OWNER access is required', 'OWNER-only helper error copy');
  assertIncludes(collectionRoute, 'requireRestaurantStaffAccess(request, restaurantSlug)', 'Tenant staff GET uses restaurant staff auth');
  assertIncludes(collectionRoute, 'requireRestaurantStaffOwnerAccess(request, parsed.data.restaurantSlug)', 'Tenant staff POST requires OWNER');
  assertIncludes(itemRoute, 'requireRestaurantStaffOwnerAccess(request, parsed.data.restaurantSlug)', 'Tenant staff PUT requires OWNER');
  assertIncludes(collectionRoute, 'where: { restaurantId: staff.restaurantId }', 'Tenant staff GET scopes by restaurantId');
  assertIncludes(itemRoute, 'restaurantId: staff.restaurantId', 'Tenant staff PUT scopes by restaurantId');
  assertIncludes(collectionRoute, 'prisma.restaurantUser.findMany', 'Tenant staff GET reads RestaurantUser');
  assertIncludes(collectionRoute, 'prisma.restaurantUser.create', 'Tenant staff POST creates RestaurantUser');
  assertIncludes(itemRoute, 'prisma.$transaction', 'Tenant staff PUT uses Prisma transaction');
  assertIncludes(itemRoute, 'Prisma.TransactionIsolationLevel.Serializable', 'Tenant staff PUT uses serializable transaction isolation');
  assertIncludes(itemRoute, 'tx.restaurantUser.findFirst', 'Tenant staff PUT target lookup happens inside transaction');
  assertIncludes(itemRoute, 'tx.restaurantUser.findUnique', 'Tenant staff PUT duplicate email check happens inside transaction');
  assertIncludes(itemRoute, 'tx.restaurantUser.update', 'Tenant staff PUT updates RestaurantUser inside transaction');
  assertIncludes(itemRoute, 'tx.restaurantUser.count', 'Tenant staff PUT verifies active owners inside transaction');
  assertIncludes(itemRoute, 'findFirst', 'Tenant staff PUT rejects cross-tenant id access');
  assertIncludes(itemRoute, 'id: params.id', 'Tenant staff PUT looks up requested id');
  assertNotIncludes(allStaffApiSource, '{ write: true }', 'Tenant staff writes should not allow MANAGER write role');
  assertNotIncludes(allStaffApiSource, 'requireAdmin', 'Tenant staff APIs must not use platform requireAdmin');
  assertNotIncludes(allStaffApiSource, 'getAdminFromRequest', 'Tenant staff APIs must not use platform admin sessions');
  assertNotIncludes(allStaffApiSource, 'prisma.adminUser', 'Tenant staff APIs must not touch AdminUser');
  assertNotIncludes(allStaffApiSource, 'prisma.gatewayLead', 'Tenant staff APIs must not touch GatewayLead');
  assertNotIncludes(allStaffApiSource, 'prisma.restaurantUser.delete', 'Tenant staff APIs must not hard delete RestaurantUser');
  assertNotIncludes(itemRoute, 'export async function DELETE', 'Tenant staff item API should not expose hard delete');
  assertIncludes(collectionRoute, 'normalizeRestaurantStaffEmail', 'Tenant staff POST normalizes email');
  assertIncludes(itemRoute, 'normalizeRestaurantStaffEmail', 'Tenant staff PUT normalizes email');
  assertIncludes(collectionRoute, 'hashRestaurantStaffPassword', 'Tenant staff POST hashes password');
  assertIncludes(itemRoute, 'hashRestaurantStaffPassword', 'Tenant staff PUT hashes reset password');
  assertIncludes(collectionRoute, 'RESTAURANT_STAFF_ROLE_VALUES', 'Tenant staff POST limits role values');
  assertIncludes(itemRoute, 'RESTAURANT_STAFF_ROLE_VALUES', 'Tenant staff PUT limits role values');
  const staffUpdateIndex = itemRoute.indexOf('const staffUser = await tx.restaurantUser.update');
  const activeOwnerCheckIndex = itemRoute.indexOf('await ensureActiveOwnerRemainsAfterUpdate(tx, staff.restaurantId)', staffUpdateIndex);
  assert(staffUpdateIndex >= 0 && activeOwnerCheckIndex > staffUpdateIndex, 'Tenant staff PUT must verify active OWNER count after the staff update');
  assertIncludes(itemRoute, 'ensureActiveOwnerRemainsAfterUpdate(tx, staff.restaurantId)', 'Tenant staff PUT checks active OWNER invariant after update');
  assertIncludes(itemRoute, 'activeOwnerCount < 1', 'Tenant staff PUT protects against zero active OWNER users');
  assertIncludes(itemRoute, 'At least one active OWNER must remain', 'Tenant staff PUT last active OWNER error');
  assertIncludes(itemRoute, 'data.isActive = Boolean(parsed.data.isActive)', 'Tenant staff PUT deactivates via isActive update');
  assertIncludes(managementHelper, 'normalizeRestaurantStaffUser', 'Tenant staff safe normalizer');
  assertNotIncludes(managementHelper, 'passwordHash', 'Tenant staff normalizer must not return passwordHash');
  assertIncludes(collectionRoute, 'select: staffSelect', 'Tenant staff collection uses safe select');
  assertIncludes(itemRoute, 'select: staffSelect', 'Tenant staff item uses safe select');
  assertNotIncludes(collectionRoute.match(/const staffSelect = \{[\s\S]*?\};/)?.[0] || '', 'passwordHash', 'Tenant staff collection select must not include passwordHash');
  assertNotIncludes(itemRoute.match(/const staffSelect = \{[\s\S]*?\};/)?.[0] || '', 'passwordHash', 'Tenant staff item select must not include passwordHash');
  assertNotIncludes(allStaffApiSource, 'sendMail', 'Tenant staff APIs must not send email invites');
  assertNotIncludes(allStaffApiSource, 'nodemailer', 'Tenant staff APIs must not add email dependency');
  assertNotIncludes(allStaffApiSource, 'sendWhatsApp', 'Tenant staff APIs must not send WhatsApp messages');
  assertNotIncludes(allStaffApiSource, 'stripe', 'Tenant staff APIs must not add billing/payment logic');
  assertNotIncludes(allStaffApiSource, 'billing', 'Tenant staff APIs must not add billing logic');
  assertNotIncludes(allStaffApiSource, 'provision', 'Tenant staff APIs must not provision tenants');

  assertIncludes(tenantStaffPage, 'getRestaurantStaffFromRequest', 'Tenant staff page verifies staff session');
  assertIncludes(tenantStaffPage, 'staff.restaurantSlug !== params.restaurantSlug', 'Tenant staff page enforces slug boundary');
  assertIncludes(tenantStaffPage, '<TenantStaffClient', 'Tenant staff page renders staff client');
  assertIncludes(tenantStaffPage, 'does not create platform AdminUser accounts', 'Tenant staff page platform boundary copy');
  assertIncludes(tenantStaffClient, '/api/restaurant-admin/staff', 'Tenant staff client uses staff API');
  assertIncludes(tenantStaffClient, "role === 'OWNER'", 'Tenant staff client OWNER-only write check');
  assertIncludes(tenantStaffClient, 'MANAGER and SUPPORT users can view staff records', 'Tenant staff client read-only role copy');
  assertIncludes(tenantStaffClient, "method: 'POST'", 'Tenant staff client creates staff via POST');
  assertIncludes(tenantStaffClient, "method: 'PUT'", 'Tenant staff client updates staff via PUT');
  assertIncludes(tenantStaffClient, 'window.confirm', 'Tenant staff client confirms deactivation');
  assertIncludes(tenantStaffClient, 'isActive: false', 'Tenant staff client deactivates through isActive update');
  assertNotIncludes(tenantStaffClient, "method: 'DELETE'", 'Tenant staff client must not hard delete staff');
  assertIncludes(tenantStaffClient, 'New password (optional)', 'Tenant staff client supports manual password reset');
  assertIncludes(tenantStaffClient, 'At least one active OWNER must remain', 'Tenant staff client last owner copy');
  assertIncludes(tenantNav, "label: 'Staff'", 'Tenant admin navigation includes Staff');
  assertIncludes(tenantNav, "href: `/r/${restaurantSlug}/admin/staff`", 'Tenant admin navigation staff route');
  assertIncludes(tenantAdmin, 'Open staff', 'Tenant admin dashboard links to staff');
  assertIncludes(tenantAdmin, 'advanced staff workflows', 'Tenant admin dashboard keeps advanced staff workflows future');
  assertNotIncludes(tenantAdmin, 'staff management, billing', 'Tenant admin dashboard should not keep staff management as future work');

  assertIncludes(readme, 'Tenant staff management foundation added.', 'README Batch 53 note');
  assertIncludes(readme, 'OWNER users can create, edit, deactivate, and manually reset passwords for RestaurantUser records under `/r/[restaurantSlug]/admin/staff`.', 'README Batch 53 staff scope note');
  assertIncludes(readme, 'Staff management is scoped to the current restaurant; MANAGER and SUPPORT are read-only for staff records.', 'README Batch 53 role boundary note');
  assertIncludes(readme, 'No email invites, WhatsApp messages, platform AdminUser changes, billing, domains, or provisioning logic was added.', 'README Batch 53 boundary note');

  assert(!migrationDirs.some((migrationDir) => /staff.management|tenant.staff|restaurant.staff/i.test(migrationDir)), 'Batch 53 should not add a Prisma migration');
}

function checkTenantReservationsManagement() {
  const readme = read('README.md');
  const migrationDirs = fs.readdirSync(path.join(root, 'prisma/migrations'));
  const publicReservationRoute = read('src/app/api/reservations/route.js');
  const publicReservationPost = getExportedFunctionSource(publicReservationRoute, 'POST');
  const publicReservationForm = read('src/components/ReservationForm.jsx');
  const demoReservationCancelRoute = read('src/app/api/reservations/cancel/route.js');
  const tenantReservationTrackRoutePath = path.join(root, 'src/app/api/reservations/tenant-track/route.js');
  const tenantReservationCancelRoutePath = path.join(root, 'src/app/api/reservations/tenant-cancel/route.js');
  const publicDemoReservationsPage = read('src/app/public/reservations/page.js');
  const tenantPublicReservationsPagePath = path.join(root, 'src/app/r/[restaurantSlug]/reservations/page.js');
  const collectionRoutePath = path.join(root, 'src/app/api/restaurant-admin/reservations/route.js');
  const itemRoutePath = path.join(root, 'src/app/api/restaurant-admin/reservations/[id]/route.js');
  const tenantReservationsPagePath = path.join(root, 'src/app/r/[restaurantSlug]/admin/reservations/page.js');
  const tenantReservationsClientPath = path.join(root, 'src/app/r/[restaurantSlug]/admin/reservations/TenantReservationsClient.jsx');

  assert(fs.existsSync(tenantPublicReservationsPagePath), 'Tenant public reservations page is missing');
  assert(fs.existsSync(collectionRoutePath), 'Tenant reservations collection API route is missing');
  assert(fs.existsSync(itemRoutePath), 'Tenant reservations item API route is missing');
  assert(fs.existsSync(tenantReservationsPagePath), 'Tenant reservations admin page is missing');
  assert(fs.existsSync(tenantReservationsClientPath), 'Tenant reservations admin client is missing');
  assert(fs.existsSync(tenantReservationTrackRoutePath), 'Tenant public reservation track API route is missing');
  assert(fs.existsSync(tenantReservationCancelRoutePath), 'Tenant public reservation cancel API route is missing');

  const tenantPublicReservationsPage = read('src/app/r/[restaurantSlug]/reservations/page.js');
  const tenantReservationTrackRoute = read('src/app/api/reservations/tenant-track/route.js');
  const tenantReservationCancelRoute = read('src/app/api/reservations/tenant-cancel/route.js');
  const collectionRoute = read('src/app/api/restaurant-admin/reservations/route.js');
  const itemRoute = read('src/app/api/restaurant-admin/reservations/[id]/route.js');
  const tenantReservationsPage = read('src/app/r/[restaurantSlug]/admin/reservations/page.js');
  const tenantReservationsClient = read('src/app/r/[restaurantSlug]/admin/reservations/TenantReservationsClient.jsx');
  const tenantNav = read('src/app/r/[restaurantSlug]/admin/TenantAdminNav.jsx');
  const tenantAdmin = read('src/app/r/[restaurantSlug]/admin/page.js');
  const reservationsApiSource = `${collectionRoute}\n${itemRoute}`;
  const tenantReservationSupportSource = `${tenantReservationTrackRoute}\n${tenantReservationCancelRoute}`;
  const reservationsUiSource = `${tenantReservationsPage}\n${tenantReservationsClient}\n${tenantNav}\n${tenantAdmin}`;

  assertIncludes(collectionRoute, 'requireRestaurantStaffAccess(request, restaurantSlug)', 'Tenant reservations GET uses restaurant staff auth');
  assertIncludes(itemRoute, 'requireRestaurantStaffAccess(request, parsed.data.restaurantSlug, { write: true })', 'Tenant reservations PUT requires OWNER/MANAGER');
  assertIncludes(collectionRoute, 'where: { restaurantId: staff.restaurantId }', 'Tenant reservations GET scopes by restaurantId');
  assertIncludes(itemRoute, 'where: { id: params.id, restaurantId: staff.restaurantId }', 'Tenant reservations PUT rejects cross-tenant id access');
  assertIncludes(collectionRoute, 'prisma.reservation.findMany', 'Tenant reservations GET reads Reservation');
  assertIncludes(itemRoute, 'prisma.reservation.updateMany', 'Tenant reservations PUT mutation is tenant-scoped');
  assertIncludes(itemRoute, 'updated.count !== 1', 'Tenant reservations PUT checks scoped update count');
  assertIncludes(itemRoute, 'const reservation = await prisma.reservation.findFirst', 'Tenant reservations PUT reads updated reservation with tenant scope');
  assertNotIncludes(itemRoute, 'prisma.reservation.update({', 'Tenant reservations PUT must not update by id only');
  assertIncludes(itemRoute, 'status: z.enum(RESERVATION_STATUSES)', 'Tenant reservations PUT validates status');
  assertIncludes(itemRoute, 'Reservation not found', 'Tenant reservations PUT hides cross-tenant records');
  assertIncludes(reservationsApiSource, 'normalizeReservation', 'Tenant reservations API returns normalized reservations');
  assertNotIncludes(reservationsApiSource, 'requireAdmin', 'Tenant reservations APIs must not use platform requireAdmin');
  assertNotIncludes(reservationsApiSource, 'getAdminFromRequest', 'Tenant reservations APIs must not use platform admin session');
  assertNotIncludes(reservationsApiSource, 'prisma.adminUser', 'Tenant reservations APIs must not touch AdminUser');
  assertNotIncludes(reservationsApiSource, 'prisma.gatewayLead', 'Tenant reservations APIs must not touch GatewayLead');
  assertNotIncludes(reservationsApiSource, 'prisma.order', 'Tenant reservations APIs must not touch Order');
  assertNotIncludes(reservationsApiSource, 'prisma.reservation.create', 'Tenant reservations APIs must not create reservations');
  assertNotIncludes(reservationsApiSource, 'prisma.reservation.delete', 'Tenant reservations APIs must not hard delete reservations');
  assertNotIncludes(itemRoute, 'export async function DELETE', 'Tenant reservations item API should not expose DELETE');
  assertNotIncludes(collectionRoute, 'export async function POST', 'Tenant reservations collection API should not create reservations');
  assertNotIncludes(reservationsApiSource, 'stripe', 'Tenant reservations APIs must not add billing/payment logic');
  assertNotIncludes(reservationsApiSource, 'sendMail', 'Tenant reservations APIs must not send email');
  assertNotIncludes(reservationsApiSource, 'sendWhatsApp', 'Tenant reservations APIs must not send WhatsApp');
  assertNotIncludes(reservationsApiSource, 'provision', 'Tenant reservations APIs must not provision tenants');

  assertIncludes(tenantPublicReservationsPage, 'getTenantRestaurantContext(params)', 'Tenant public reservations page resolves tenant context');
  assertIncludes(tenantPublicReservationsPage, "context.restaurant.status === 'ARCHIVED'", 'Tenant public reservations page rejects archived tenants');
  assertIncludes(tenantPublicReservationsPage, 'restaurantSlug={context.restaurant.slug}', 'Tenant public reservations page passes restaurantSlug to form');
  assertIncludes(tenantPublicReservationsPage, 'showCancellation={true}', 'Tenant public reservations page enables scoped support actions');
  assertIncludes(tenantPublicReservationsPage, '<ReservationForm', 'Tenant public reservations page renders reservation form');
  assertIncludes(publicDemoReservationsPage, '<ReservationForm />', 'Demo public reservations page keeps default demo form');
  assertIncludes(publicReservationForm, 'restaurantSlug = null', 'Reservation form supports optional restaurantSlug');
  assertIncludes(publicReservationForm, 'restaurantSlug ? { ...form, restaurantSlug } : form', 'Reservation form sends tenant slug when present');
  assertIncludes(publicReservationForm, 'isTenantReservationSupport', 'Reservation form distinguishes tenant support actions');
  assertNotIncludes(publicReservationForm, 'Ã—', 'Reservation form close button mojibake');
  assertNotIncludes(publicReservationForm, 'Ã', 'Reservation form mojibake marker');
  assertIncludes(publicReservationForm, '/api/reservations/tenant-track', 'Reservation form uses tenant track endpoint');
  assertIncludes(publicReservationForm, '/api/reservations/tenant-cancel', 'Reservation form uses tenant cancel endpoint');
  assertIncludes(publicReservationForm, 'restaurantSlug, reference: trackForm.reference.trim(), phone: trackForm.phone.trim()', 'Reservation form sends tenant track scope');
  assertIncludes(publicReservationForm, 'restaurantSlug, reference: cancelForm.reference.trim(), phone: cancelForm.phone.trim()', 'Reservation form sends tenant cancel scope');
  assertIncludes(publicReservationForm, '/api/reservations/cancel', 'Reservation form preserves demo cancel endpoint');
  assertIncludes(publicReservationRoute, 'resolveReservationCreationContext', 'Public reservation API resolves tenant context');
  assertIncludes(publicReservationRoute, "restaurant.status === 'ARCHIVED'", 'Public reservation API rejects archived tenants');
  assertIncludes(publicReservationRoute, 'prisma.restaurantProfile.findUnique', 'Public reservation API requires initialized tenant profile');
  assertIncludes(publicReservationRoute, 'prisma.restaurantSettings.findUnique', 'Public reservation API requires initialized tenant settings');
  assertIncludes(publicReservationRoute, 'restaurantId: reservationContext.restaurantId', 'Public reservation API writes resolved tenant restaurantId');
  assertIncludes(publicReservationRoute, "failure('Restaurant is not available for reservations', 404)", 'Public reservation API rejects unavailable tenants');
  assertIncludes(publicReservationRoute, "failure('Restaurant reservations are not initialized yet', 404)", 'Public reservation API rejects uninitialized tenants');
  assertIncludes(publicReservationRoute, 'withDemoRestaurantData', 'Public reservation API preserves demo write behavior');
  assertNotIncludes(publicReservationPost, 'requireAdmin(request', 'Public reservation creation should not require admin auth');
  assertIncludes(demoReservationCancelRoute, 'withDemoRestaurantWhere({ reference })', 'Demo reservation cancel lookup is demo-scoped');
  assertIncludes(demoReservationCancelRoute, 'withDemoRestaurantWhere({ id: reservation.id })', 'Demo reservation cancel mutation is demo-scoped');
  assertIncludes(demoReservationCancelRoute, 'updated.count !== 1', 'Demo reservation cancel checks scoped update count');
  assertNotIncludes(demoReservationCancelRoute, 'findUnique({ where: { reference } })', 'Demo reservation cancel must not use global reference findUnique');

  for (const [route, label] of [
    [tenantReservationTrackRoute, 'Tenant reservation track API'],
    [tenantReservationCancelRoute, 'Tenant reservation cancel API'],
  ]) {
    assertIncludes(route, 'restaurantSlug: z.string().trim().min(1)', `${label} requires restaurantSlug`);
    assertIncludes(route, 'reference: z.string().trim().min(3)', `${label} requires reference`);
    assertIncludes(route, 'phone: z.string().trim().min(4)', `${label} requires phone`);
    assertIncludes(route, 'resolveTenantReservationSupportContext(parsed.data.restaurantSlug)', `${label} resolves tenant context`);
    assertIncludes(route, "normalizedSlug === DEMO_RESTAURANT_SLUG", `${label} rejects demo slug`);
    assertIncludes(route, "restaurant.status === 'ARCHIVED'", `${label} rejects archived tenants`);
    assertIncludes(route, 'Restaurant reservation support is not initialized yet', `${label} rejects uninitialized tenants`);
    assertIncludes(route, 'FEATURE_KEYS.RESERVATIONS', `${label} requires reservations feature`);
    assertIncludes(route, 'where: { restaurantId: context.restaurantId, reference: parsed.data.reference, phone: parsed.data.phone }', `${label} lookup scopes by restaurantId reference phone`);
    assertNotIncludes(route, 'findUnique({ where: { reference', `${label} must not use global reference lookup`);
    assertIncludes(route, 'normalizeTenantPublicReservation', `${label} returns safe normalized reservation`);
    assertIncludes(route, 'reference: reservation.reference', `${label} normalized reference`);
    assertIncludes(route, 'status: reservation.status', `${label} normalized status`);
    assertIncludes(route, 'date: formatDubaiDateOnly(reservation.date)', `${label} normalized date`);
    assertIncludes(route, 'time: reservation.time', `${label} normalized time`);
    assertIncludes(route, 'partySize: reservation.guests', `${label} normalized party size`);
    assertIncludes(route, 'name: reservation.name || null', `${label} normalized public name`);
    assertNotIncludes(route, 'return success({ reservation', `${label} response must not expose raw reservation`);
    assertNotIncludes(route, 'restaurantId: reservation.restaurantId', `${label} response must not expose restaurantId`);
  }
  assertIncludes(tenantReservationCancelRoute, 'prisma.reservation.updateMany', 'Tenant reservation cancel uses scoped updateMany');
  assertIncludes(tenantReservationCancelRoute, 'where: { id: reservation.id, restaurantId: context.restaurantId }', 'Tenant reservation cancel mutation scopes by restaurantId');
  assertIncludes(tenantReservationCancelRoute, 'updated.count !== 1', 'Tenant reservation cancel checks scoped update count');
  assertNotIncludes(tenantReservationSupportSource, 'sendWhatsApp', 'Tenant reservation support must not send WhatsApp');
  assertNotIncludes(tenantReservationSupportSource, 'sendMail', 'Tenant reservation support must not send email');
  assertNotIncludes(tenantReservationSupportSource, 'stripe', 'Tenant reservation support must not add payment logic');
  assertNotIncludes(tenantReservationSupportSource, 'inventoryMovement', 'Tenant reservation support must not consume inventory');
  assertNotIncludes(tenantReservationSupportSource, 'OrderRecipeConsumption', 'Tenant reservation support must not apply recipe consumption');
  assertNotIncludes(tenantReservationSupportSource, 'refund', 'Tenant reservation support must not add refund logic');

  assertIncludes(tenantReservationsPage, 'getRestaurantStaffFromRequest', 'Tenant reservations page verifies staff session');
  assertIncludes(tenantReservationsPage, 'staff.restaurantSlug !== params.restaurantSlug', 'Tenant reservations page enforces slug boundary');
  assertIncludes(tenantReservationsPage, '<TenantReservationsClient', 'Tenant reservations page renders client');
  assertIncludes(tenantReservationsClient, '/api/restaurant-admin/reservations', 'Tenant reservations client uses reservations API');
  assertIncludes(tenantReservationsClient, "method: 'PUT'", 'Tenant reservations client updates status via PUT');
  assertNotIncludes(tenantReservationsClient, "method: 'POST'", 'Tenant reservations client must not create reservations');
  assertNotIncludes(tenantReservationsClient, "method: 'DELETE'", 'Tenant reservations client must not delete reservations');
  assertIncludes(tenantReservationsClient, 'SUPPORT access is read-only', 'Tenant reservations client support read-only state');
  assertIncludes(tenantReservationsClient, 'OWNER or MANAGER access is required', 'Tenant reservations client write role copy');
  assertIncludes(tenantReservationsClient, 'No reservations found', 'Tenant reservations client empty state');
  assertIncludes(tenantReservationsClient, 'PENDING', 'Tenant reservations client supports pending status');
  assertIncludes(tenantReservationsClient, 'CONFIRMED', 'Tenant reservations client supports confirmed status');
  assertIncludes(tenantReservationsClient, 'CANCELLED', 'Tenant reservations client supports cancelled status');
  assertIncludes(tenantReservationsClient, 'NO_SHOW', 'Tenant reservations client supports no-show status');
  assertIncludes(tenantNav, "label: 'Reservations'", 'Tenant admin navigation includes Reservations');
  assertIncludes(tenantAdmin, 'Open reservations', 'Tenant admin dashboard links to reservations');
  assertIncludes(tenantAdmin, 'View bookings and update reservation status', 'Tenant admin dashboard reservations copy');
  assertNotIncludes(tenantAdmin, 'reservations, inventory', 'Tenant admin dashboard should not keep reservations as future work');
  assertNotIncludes(tenantNav, "'Reservations', 'Inventory'", 'Tenant reservations should not remain future nav item');
  assertNotIncludes(reservationsUiSource, '/platform-admin', 'Tenant reservations UI must not link to platform admin');

  assertIncludes(readme, 'Tenant reservations management added.', 'README Batch 54 note');
  assertIncludes(readme, 'Restaurant staff can view tenant-scoped reservations and update reservation status under `/r/[restaurantSlug]/admin/reservations`.', 'README Batch 54 reservations scope note');
  assertIncludes(readme, 'OWNER and MANAGER can update reservation status; SUPPORT remains read-only.', 'README Batch 54 reservations role note');
  assertIncludes(readme, 'Public tenant reservation creation is available at `/r/[restaurantSlug]/reservations` for initialized, non-archived tenants.', 'README Batch 54 public tenant reservations note');
  assertIncludes(readme, 'Demo reservation behavior remains available at `/public/reservations` and `/r/demo-restaurant/reservations`.', 'README Batch 54 demo reservation preservation note');
  assertIncludes(readme, 'Restaurant staff access includes tenant-scoped menu, gallery, profile, settings, staff management foundation, reservations management, table management foundation, order status management foundation, kitchen queue operations, inventory management foundation, public tenant order creation when ONLINE_ORDERING is enabled, tenant table QR ordering when TABLE_QR_ORDERING is enabled, tenant public order support actions, and tenant public reservation support actions; assisted ordering, payments, refunds, messaging, advanced guest automation, advanced kitchen automation, automatic inventory consumption, recipes, billing, domains, email, and WhatsApp automation remain future work.', 'README Batch 60 tenant staff access note');
  assertIncludes(readme, 'Tenant public reservation support actions added.', 'README Batch 60 note');
  assertIncludes(readme, 'Tenant public reservation lookup and cancellation are scoped by restaurantSlug, reference, and phone.', 'README Batch 60 scoped support note');
  assertIncludes(readme, 'Demo reservation cancellation remains demo-scoped at `/api/reservations/cancel`.', 'README Batch 60 demo support preservation note');
  assertIncludes(readme, 'Payments, refunds, messaging, inventory consumption, recipe consumption, billing, domains, CRM, and advanced guest automation remain future work.', 'README Batch 60 future boundary note');
  assertNotIncludes(readme, 'orders, reservations, inventory', 'README should not say reservations remain future work after Batch 54');

  assert(fs.existsSync(path.join(root, 'src/app/admin/(protected)/reservations/page.jsx')), 'Demo admin reservations page should remain present');
  assert(fs.existsSync(path.join(root, 'src/app/api/reservations/route.js')), 'Public/demo reservations API should remain present');
  assert(!fs.existsSync(path.join(root, 'src/app/api/billing')), 'Tenant reservations batch should not add billing API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/payments')), 'Tenant reservations batch should not add payments API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/email')), 'Tenant reservations batch should not add email API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/whatsapp')), 'Tenant reservations batch should not add WhatsApp API route');
  assert(!migrationDirs.some((migrationDir) => /reservation.management|tenant.reservation|reservation.support/i.test(migrationDir)), 'Batch 60 should not add a Prisma migration');
}

function checkTenantTableManagementFoundation() {
  const readme = read('README.md');
  const migrationDirs = fs.readdirSync(path.join(root, 'prisma/migrations'));
  const publicDemoTablePagePath = path.join(root, 'src/app/public/table/[slug]/page.js');
  const tenantDemoTablePagePath = path.join(root, 'src/app/r/[restaurantSlug]/table/[slug]/page.js');
  const collectionRoutePath = path.join(root, 'src/app/api/restaurant-admin/tables/route.js');
  const itemRoutePath = path.join(root, 'src/app/api/restaurant-admin/tables/[id]/route.js');
  const tenantTablesPagePath = path.join(root, 'src/app/r/[restaurantSlug]/admin/tables/page.js');
  const tenantTablesClientPath = path.join(root, 'src/app/r/[restaurantSlug]/admin/tables/TenantTablesClient.jsx');

  assert(fs.existsSync(publicDemoTablePagePath), 'Demo public table route is missing');
  assert(fs.existsSync(tenantDemoTablePagePath), 'Tenant-style demo table route is missing');
  assert(fs.existsSync(collectionRoutePath), 'Tenant tables collection API route is missing');
  assert(fs.existsSync(itemRoutePath), 'Tenant tables item API route is missing');
  assert(fs.existsSync(tenantTablesPagePath), 'Tenant tables admin page is missing');
  assert(fs.existsSync(tenantTablesClientPath), 'Tenant tables admin client is missing');

  const collectionRoute = read('src/app/api/restaurant-admin/tables/route.js');
  const itemRoute = read('src/app/api/restaurant-admin/tables/[id]/route.js');
  const tenantTablesPage = read('src/app/r/[restaurantSlug]/admin/tables/page.js');
  const tenantTablesClient = read('src/app/r/[restaurantSlug]/admin/tables/TenantTablesClient.jsx');
  const tenantNav = read('src/app/r/[restaurantSlug]/admin/TenantAdminNav.jsx');
  const tenantAdmin = read('src/app/r/[restaurantSlug]/admin/page.js');
  const tableApiSource = `${collectionRoute}\n${itemRoute}`;
  const tableUiSource = `${tenantTablesPage}\n${tenantTablesClient}\n${tenantNav}\n${tenantAdmin}`;

  assertIncludes(collectionRoute, 'requireRestaurantStaffAccess(request, restaurantSlug)', 'Tenant tables GET uses restaurant staff auth');
  assertIncludes(collectionRoute, 'requireRestaurantStaffAccess(request, parsed.data.restaurantSlug, { write: true })', 'Tenant tables POST requires OWNER/MANAGER');
  assertIncludes(itemRoute, 'requireRestaurantStaffAccess(request, parsed.data.restaurantSlug, { write: true })', 'Tenant tables PUT requires OWNER/MANAGER');
  assertIncludes(itemRoute, 'requireRestaurantStaffAccess(request, restaurantSlug, { write: true })', 'Tenant tables deactivate requires OWNER/MANAGER');
  assertIncludes(collectionRoute, 'where: { restaurantId: staff.restaurantId }', 'Tenant tables GET scopes by restaurantId');
  assertIncludes(collectionRoute, 'restaurantId: staff.restaurantId', 'Tenant tables POST stamps restaurantId');
  assertIncludes(collectionRoute, 'prisma.restaurantTable.findMany', 'Tenant tables GET reads RestaurantTable');
  assertIncludes(collectionRoute, 'prisma.restaurantTable.create', 'Tenant tables POST creates RestaurantTable');
  assertIncludes(collectionRoute, 'generateUniqueSlug', 'Tenant tables POST generates a table slug');
  assertIncludes(collectionRoute, 'generateUniqueQrToken', 'Tenant tables POST generates a QR token');
  assertIncludes(collectionRoute, 'Table label already exists for this restaurant', 'Tenant tables POST prevents duplicate tenant labels');
  assertIncludes(collectionRoute, 'function normalizeTenantTable(table, restaurantSlug)', 'Tenant tables collection API uses tenant-safe serializer');
  assertIncludes(collectionRoute, 'function buildTenantTableOrderUrl(table, restaurantSlug)', 'Tenant tables collection API builds tenant order URL');
  assertIncludes(collectionRoute, 'return table.isActive && table.slug', 'Tenant tables collection API only exposes active table order URLs');
  assertIncludes(collectionRoute, 'qrToken: normalized.qrToken', 'Tenant tables collection API keeps QR token reference');
  assertIncludes(collectionRoute, 'orderUrl: buildTenantTableOrderUrl(normalized, restaurantSlug)', 'Tenant tables collection API exposes tenant-safe order URL');
  assertIncludes(itemRoute, 'where: { id: params.id, restaurantId: staff.restaurantId }', 'Tenant tables item route scopes mutations by restaurantId');
  assertIncludes(itemRoute, 'prisma.restaurantTable.updateMany', 'Tenant tables item mutation is tenant-scoped');
  assertIncludes(itemRoute, 'updated.count !== 1', 'Tenant tables item route checks scoped update count');
  assertIncludes(itemRoute, 'const table = await prisma.restaurantTable.findFirst', 'Tenant tables item route reads updated table with tenant scope');
  assertIncludes(itemRoute, 'data: { isActive: false }', 'Tenant tables deactivate uses inactive state');
  assertIncludes(itemRoute, 'function normalizeTenantTable(table, restaurantSlug)', 'Tenant tables item API uses tenant-safe serializer');
  assertIncludes(itemRoute, 'function buildTenantTableOrderUrl(table, restaurantSlug)', 'Tenant tables item API builds tenant order URL');
  assertIncludes(itemRoute, 'return table.isActive && table.slug', 'Tenant tables item API only exposes active table order URLs');
  assertIncludes(itemRoute, 'qrToken: normalized.qrToken', 'Tenant tables item API keeps QR token reference');
  assertIncludes(itemRoute, 'orderUrl: buildTenantTableOrderUrl(normalized, restaurantSlug)', 'Tenant tables item API exposes tenant-safe order URL');
  assertNotIncludes(tableApiSource, '/public/table', 'Tenant tables APIs must not expose demo public table orderUrl');
  assertNotIncludes(itemRoute, 'prisma.restaurantTable.update({', 'Tenant tables PUT must not update by id only');
  assertNotIncludes(tableApiSource, 'prisma.restaurantTable.delete', 'Tenant tables APIs must not hard delete tables');
  assertNotIncludes(tableApiSource, 'prisma.order', 'Tenant tables APIs must not create or update orders');
  assertNotIncludes(tableApiSource, 'order.create', 'Tenant tables APIs must not activate table ordering writes');
  assertNotIncludes(tableApiSource, 'requireAdmin', 'Tenant tables APIs must not use platform requireAdmin');
  assertNotIncludes(tableApiSource, 'getAdminFromRequest', 'Tenant tables APIs must not use platform admin session');
  assertNotIncludes(tableApiSource, 'prisma.adminUser', 'Tenant tables APIs must not touch AdminUser');
  assertNotIncludes(tableApiSource, 'prisma.gatewayLead', 'Tenant tables APIs must not touch GatewayLead');
  assertNotIncludes(tableApiSource, 'inventory', 'Tenant tables APIs must not touch inventory');
  assertNotIncludes(tableApiSource, 'recipe', 'Tenant tables APIs must not touch recipes');
  assertNotIncludes(tableApiSource, 'stripe', 'Tenant tables APIs must not add payment logic');
  assertNotIncludes(tableApiSource, 'sendMail', 'Tenant tables APIs must not send email');
  assertNotIncludes(tableApiSource, 'sendWhatsApp', 'Tenant tables APIs must not send WhatsApp');
  assertNotIncludes(tableApiSource, 'provision', 'Tenant tables APIs must not provision tenants');

  assertIncludes(tenantTablesPage, 'getRestaurantStaffFromRequest', 'Tenant tables page verifies staff session');
  assertIncludes(tenantTablesPage, 'staff.restaurantSlug !== params.restaurantSlug', 'Tenant tables page enforces slug boundary');
  assertIncludes(tenantTablesPage, '<TenantTablesClient', 'Tenant tables page renders client');
  assertIncludes(tenantTablesClient, '/api/restaurant-admin/tables', 'Tenant tables client uses tables API');
  assertIncludes(tenantTablesClient, "'POST'", 'Tenant tables client creates tables via POST');
  assertIncludes(tenantTablesClient, "'PUT'", 'Tenant tables client updates tables via PUT');
  assertIncludes(tenantTablesClient, "method: 'DELETE'", 'Tenant tables client deactivates tables via DELETE');
  assertIncludes(tenantTablesClient, 'window.confirm', 'Tenant tables client confirms destructive deactivate action');
  assertIncludes(tenantTablesClient, 'SUPPORT access is read-only', 'Tenant tables client support read-only state');
  assertIncludes(tenantTablesClient, 'OWNER or MANAGER access is required', 'Tenant tables client write role copy');
  assertIncludes(tenantTablesClient, 'No tables created yet', 'Tenant tables client empty state');
  assertIncludes(tenantTablesClient, 'Tenant table QR ordering is active when ONLINE_ORDERING and TABLE_QR_ORDERING are enabled.', 'Tenant tables client ordering activation copy');
  assertIncludes(tenantTablesClient, 'copyOrderUrl', 'Tenant tables client can copy order URL');
  assertIncludes(tenantTablesClient, 'table.orderUrl', 'Tenant tables client displays tenant order URL');
  assertIncludes(tenantNav, "label: 'Tables'", 'Tenant admin navigation includes Tables');
  assertIncludes(tenantNav, "href: `/r/${restaurantSlug}/admin/tables`", 'Tenant admin navigation tables route');
  assertIncludes(tenantAdmin, 'Open tables', 'Tenant admin dashboard links to tables');
  assertIncludes(tenantAdmin, 'Create and manage table labels', 'Tenant admin dashboard tables copy');
  assertNotIncludes(tenantNav, "'Tables', 'Orders'", 'Tenant tables should not remain future nav item');
  assertNotIncludes(tableUiSource, '/platform-admin', 'Tenant tables UI must not link to platform admin');

  assertIncludes(readme, 'Tenant table management foundation added.', 'README Batch 55 note');
  assertIncludes(readme, 'Restaurant staff can create, edit, and deactivate tenant-scoped tables under `/r/[restaurantSlug]/admin/tables`.', 'README Batch 55 table scope note');
  assertIncludes(readme, 'OWNER and MANAGER can write table records; SUPPORT remains read-only.', 'README Batch 55 table role note');
  assertIncludes(readme, 'Tenant table QR ordering activation added.', 'README Batch 58 note');
  assertIncludes(readme, 'Tenant table URLs use `/r/[restaurantSlug]/table/[tableSlug]` and never the demo `/public/table` path.', 'README Batch 58 tenant table URL note');
  assertIncludes(readme, 'Demo table behavior remains available at `/public/table/[slug]` and `/r/demo-restaurant/table/[slug]`.', 'README Batch 55 demo table preservation note');

  assert(!fs.existsSync(path.join(root, 'src/app/api/billing')), 'Tenant tables batch should not add billing API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/payments')), 'Tenant tables batch should not add payments API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/email')), 'Tenant tables batch should not add email API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/whatsapp')), 'Tenant tables batch should not add WhatsApp API route');
  assert(!migrationDirs.some((migrationDir) => /table.management|tenant.table|qr.ordering/i.test(migrationDir)), 'Batch 58 should not add a Prisma migration');
}

function checkTenantOrderApiBoundaryFoundation() {
  const readme = read('README.md');
  const migrationDirs = fs.readdirSync(path.join(root, 'prisma/migrations'));
  const publicOrderRoute = read('src/app/api/orders/route.js');
  const publicOrderPost = getExportedFunctionSource(publicOrderRoute, 'POST');
  const publicOrderTrackRoute = read('src/app/api/orders/track/route.js');
  const publicOrderCancelRoute = read('src/app/api/orders/cancel/route.js');
  const tenantOrderTrackRoutePath = path.join(root, 'src/app/api/orders/tenant-track/route.js');
  const tenantOrderCancelRoutePath = path.join(root, 'src/app/api/orders/tenant-cancel/route.js');
  const tenantOrderPage = read('src/app/r/[restaurantSlug]/order/page.js');
  const tenantTablePage = read('src/app/r/[restaurantSlug]/table/[slug]/page.js');
  const publicDemoOrderPagePath = path.join(root, 'src/app/public/order/page.js');
  const tenantOrderPagePath = path.join(root, 'src/app/r/[restaurantSlug]/order/page.js');
  const helperPath = path.join(root, 'src/lib/tenant-orders.js');
  const collectionRoutePath = path.join(root, 'src/app/api/restaurant-admin/orders/route.js');
  const itemRoutePath = path.join(root, 'src/app/api/restaurant-admin/orders/[id]/route.js');
  const tenantOrdersPagePath = path.join(root, 'src/app/r/[restaurantSlug]/admin/orders/page.js');
  const tenantOrdersClientPath = path.join(root, 'src/app/r/[restaurantSlug]/admin/orders/TenantOrdersClient.jsx');

  assert(fs.existsSync(publicDemoOrderPagePath), 'Demo public order page is missing');
  assert(fs.existsSync(tenantOrderPagePath), 'Tenant order page is missing');
  assert(fs.existsSync(helperPath), 'Tenant order helper is missing');
  assert(fs.existsSync(collectionRoutePath), 'Tenant orders collection API route is missing');
  assert(fs.existsSync(itemRoutePath), 'Tenant orders item API route is missing');
  assert(fs.existsSync(tenantOrdersPagePath), 'Tenant orders admin page is missing');
  assert(fs.existsSync(tenantOrdersClientPath), 'Tenant orders admin client is missing');
  assert(fs.existsSync(tenantOrderTrackRoutePath), 'Tenant public order track API route is missing');
  assert(fs.existsSync(tenantOrderCancelRoutePath), 'Tenant public order cancel API route is missing');

  const helper = read('src/lib/tenant-orders.js');
  const collectionRoute = read('src/app/api/restaurant-admin/orders/route.js');
  const itemRoute = read('src/app/api/restaurant-admin/orders/[id]/route.js');
  const tenantOrderTrackRoute = read('src/app/api/orders/tenant-track/route.js');
  const tenantOrderCancelRoute = read('src/app/api/orders/tenant-cancel/route.js');
  const tenantOrdersPage = read('src/app/r/[restaurantSlug]/admin/orders/page.js');
  const tenantOrdersClient = read('src/app/r/[restaurantSlug]/admin/orders/TenantOrdersClient.jsx');
  const tenantNav = read('src/app/r/[restaurantSlug]/admin/TenantAdminNav.jsx');
  const tenantAdmin = read('src/app/r/[restaurantSlug]/admin/page.js');
  const orderApiSource = `${collectionRoute}\n${itemRoute}`;
  const tenantOrderSupportSource = `${tenantOrderTrackRoute}\n${tenantOrderCancelRoute}`;
  const orderUiSource = `${tenantOrdersPage}\n${tenantOrdersClient}\n${tenantNav}\n${tenantAdmin}`;

  assertIncludes(helper, 'normalizeTenantOrder', 'Tenant order helper normalizer');
  assertIncludes(helper, 'normalizeTenantOrders', 'Tenant order helper list normalizer');
  assertIncludes(helper, 'TENANT_ORDER_INCLUDE', 'Tenant order helper include shape');
  assertNotIncludes(helper, 'restaurantId:', 'Tenant order normalizer should not expose restaurantId');

  assertIncludes(collectionRoute, 'requireRestaurantStaffAccess(request, restaurantSlug)', 'Tenant orders GET uses restaurant staff auth');
  assertIncludes(itemRoute, 'requireRestaurantStaffAccess(request, parsed.data.restaurantSlug, { write: true })', 'Tenant orders PUT requires OWNER/MANAGER');
  assertIncludes(collectionRoute, 'where: { restaurantId: staff.restaurantId }', 'Tenant orders GET scopes by restaurantId');
  assertIncludes(itemRoute, 'where: { id: params.id, restaurantId: staff.restaurantId }', 'Tenant orders PUT reads by restaurantId');
  assertIncludes(collectionRoute, 'prisma.order.findMany', 'Tenant orders GET reads Order');
  assertIncludes(itemRoute, 'prisma.$transaction', 'Tenant orders PUT uses transaction for scoped status update');
  assertIncludes(itemRoute, 'tx.order.updateMany', 'Tenant orders PUT mutation is tenant-scoped');
  assertIncludes(itemRoute, 'restaurantId: staff.restaurantId', 'Tenant orders PUT mutation includes restaurantId');
  assertIncludes(itemRoute, 'updated.count !== 1', 'Tenant orders PUT checks scoped update count');
  assertIncludes(itemRoute, 'const order = await tx.order.findFirst', 'Tenant orders PUT reads updated order with tenant scope');
  assertIncludes(itemRoute, 'status: z.string().refine(isValidOrderStatus', 'Tenant orders PUT validates status');
  assertIncludes(itemRoute, 'canTransitionOrderStatus', 'Tenant orders PUT validates status transition');
  assertIncludes(itemRoute, 'Cannot move order from', 'Tenant orders PUT returns transition error');
  assertIncludes(orderApiSource, 'normalizeTenantOrder', 'Tenant orders API returns normalized orders');
  assertNotIncludes(orderApiSource, 'requireAdmin', 'Tenant orders APIs must not use platform requireAdmin');
  assertNotIncludes(orderApiSource, 'getAdminFromRequest', 'Tenant orders APIs must not use platform admin session');
  assertNotIncludes(orderApiSource, 'prisma.adminUser', 'Tenant orders APIs must not touch AdminUser');
  assertNotIncludes(orderApiSource, 'prisma.gatewayLead', 'Tenant orders APIs must not touch GatewayLead');
  assertNotIncludes(orderApiSource, 'prisma.order.create', 'Tenant orders APIs must not create orders');
  assertNotIncludes(orderApiSource, 'prisma.order.delete', 'Tenant orders APIs must not delete orders');
  assertNotIncludes(itemRoute, 'export async function DELETE', 'Tenant orders item API should not expose DELETE');
  assertNotIncludes(collectionRoute, 'export async function POST', 'Tenant orders collection API should not create orders');
  assertNotIncludes(orderApiSource, 'sendWhatsApp', 'Tenant orders APIs must not send WhatsApp');
  assertNotIncludes(orderApiSource, 'sendWhatsAppMessage', 'Tenant orders APIs must not send WhatsApp message helper');
  assertNotIncludes(orderApiSource, 'sendMail', 'Tenant orders APIs must not send email');
  assertNotIncludes(orderApiSource, 'stripe', 'Tenant orders APIs must not add payment logic');
  assertNotIncludes(orderApiSource, 'inventoryMovement', 'Tenant orders APIs must not consume inventory');
  assertNotIncludes(orderApiSource, 'OrderRecipeConsumption', 'Tenant orders APIs must not apply recipe consumption');
  assertNotIncludes(orderApiSource, 'provision', 'Tenant orders APIs must not provision tenants');
  if (orderApiSource.includes('orderStatusHistory.create')) {
    assertIncludes(orderApiSource, 'restaurantId: staff.restaurantId', 'Tenant order status history writes must include restaurantId');
  }

  assertIncludes(tenantOrdersPage, 'getRestaurantStaffFromRequest', 'Tenant orders page verifies staff session');
  assertIncludes(tenantOrdersPage, 'staff.restaurantSlug !== params.restaurantSlug', 'Tenant orders page enforces slug boundary');
  assertIncludes(tenantOrdersPage, '<TenantOrdersClient', 'Tenant orders page renders client');
  assertIncludes(tenantOrdersClient, '/api/restaurant-admin/orders', 'Tenant orders client uses orders API');
  assertIncludes(tenantOrdersClient, "'PUT'", 'Tenant orders client updates status via PUT');
  assertNotIncludes(tenantOrdersClient, "'POST'", 'Tenant orders client must not create orders');
  assertNotIncludes(tenantOrdersClient, "'DELETE'", 'Tenant orders client must not delete orders');
  assertIncludes(tenantOrdersClient, 'SUPPORT access is read-only', 'Tenant orders client support read-only state');
  assertIncludes(tenantOrdersClient, 'OWNER or MANAGER access is required', 'Tenant orders client write role copy');
  assertIncludes(tenantOrdersClient, 'No orders found', 'Tenant orders client empty state');
  assertIncludes(tenantOrdersClient, 'public tenant ordering creates orders only when ONLINE_ORDERING is enabled', 'Tenant orders client public ordering boundary copy');
  assertIncludes(tenantNav, "label: 'Orders'", 'Tenant admin navigation includes Orders');
  assertIncludes(tenantNav, "href: `/r/${restaurantSlug}/admin/orders`", 'Tenant admin navigation orders route');
  assertIncludes(tenantAdmin, 'Open orders', 'Tenant admin dashboard links to orders');
  assertIncludes(tenantAdmin, 'read/status management foundation', 'Tenant admin dashboard orders foundation copy');
  assertNotIncludes(tenantNav, "const futureModules = ['Orders'", 'Tenant orders should not remain future nav item');
  assertNotIncludes(orderUiSource, '/platform-admin', 'Tenant orders UI must not link to platform admin');

  assertIncludes(tenantOrderPage, 'if (context.isDemoRestaurant)', 'Tenant order page preserves demo behavior');
  assertIncludes(tenantOrderPage, '<PublicOrderPage', 'Tenant order page renders public order page for demo');
  assertIncludes(tenantOrderPage, 'isFeatureEnabled(context.profile.enabledFeatures, FEATURE_KEYS.ONLINE_ORDERING)', 'Tenant order page requires ONLINE_ORDERING');
  assertIncludes(tenantOrderPage, '<OrderClient', 'Tenant order page renders tenant order client when enabled');
  assertIncludes(tenantOrderPage, 'restaurantSlug={context.restaurant.slug}', 'Tenant order page passes restaurantSlug to order client');
  assertIncludes(tenantOrderPage, 'showOrderSupportActions={true}', 'Tenant order page enables tenant-scoped support actions');
  assertNotIncludes(tenantOrderPage, 'showOrderSupportActions={false}', 'Tenant order page should not hide tenant support actions');
  assertIncludes(tenantOrderPage, 'const tableOrderingEnabled = isFeatureEnabled(context.profile.enabledFeatures, FEATURE_KEYS.TABLE_QR_ORDERING);', 'Tenant order page checks table ordering feature');
  assertIncludes(tenantOrderPage, 'getActiveTenantTable(context, tableSlug, tableToken)', 'Tenant order page resolves active tenant table context');
  assertIncludes(tenantOrderPage, 'table={table}', 'Tenant order page passes tenant table context to order client');
  assertIncludes(tenantOrderPage, 'Table ordering link is unavailable for this restaurant.', 'Tenant order page has unavailable table-link state');
  assertIncludes(tenantOrderPage, 'Online ordering is not available yet for this restaurant.', 'Tenant order page keeps unavailable state');
  assertIncludes(tenantTablePage, 'getTenantRestaurantContext(params)', 'Tenant table route resolves tenant context by slug');
  assertIncludes(tenantTablePage, 'if (context.isDemoRestaurant)', 'Tenant table route preserves demo behavior');
  assertIncludes(tenantTablePage, '<PublicTablePage', 'Tenant table route keeps demo public table behavior');
  assertIncludes(tenantTablePage, 'FEATURE_KEYS.ONLINE_ORDERING', 'Tenant table route requires online ordering');
  assertIncludes(tenantTablePage, 'FEATURE_KEYS.TABLE_QR_ORDERING', 'Tenant table route requires table QR ordering');
  assertIncludes(tenantTablePage, 'where: { restaurantId: context.restaurant.id, slug, qrToken: token, isActive: true }', 'Tenant table route scopes table lookup by restaurantId slug token active');
  assertIncludes(tenantTablePage, '`/r/${context.restaurant.slug}/order?table=${encodeURIComponent(table.slug)}&tableToken=${encodeURIComponent(token)}`', 'Tenant table route links into tenant order flow');
  assertNotIncludes(tenantTablePage, 'requireDemoTenantRestaurant', 'Tenant table route must not reject non-demo tenants');
  assertIncludes(publicOrderRoute, 'withDemoRestaurantData', 'Public order API preserves demo restaurant writes');
  assertIncludes(publicOrderRoute, 'withDemoRestaurantWhere', 'Public order API preserves demo restaurant reads');
  assertIncludes(publicOrderPost, 'resolveOrderCreationContext(parsed.data.restaurantSlug)', 'Public order POST resolves tenant context');
  assertIncludes(publicOrderRoute, 'restaurantSlug: z.string().trim().optional().nullable()', 'Public order POST accepts optional restaurantSlug');
  assertIncludes(publicOrderRoute, "restaurant.status === 'ARCHIVED'", 'Public order POST rejects archived tenants');
  assertIncludes(publicOrderRoute, 'Restaurant online ordering is not initialized yet', 'Public order POST rejects uninitialized tenants');
  assertIncludes(publicOrderRoute, 'FEATURE_KEYS.ONLINE_ORDERING', 'Public order POST requires online ordering feature');
  assertNotIncludes(publicOrderPost, 'Tenant table ordering is not available yet', 'Public order POST should no longer reject non-demo table context');
  assertIncludes(publicOrderPost, 'isFeatureEnabled(orderContext.profile.enabledFeatures, FEATURE_KEYS.TABLE_QR_ORDERING)', 'Public order POST requires table QR ordering feature');
  assertIncludes(publicOrderPost, 'where: orderContext.isDemoRestaurant', 'Public order POST keeps demo/tenant table lookup branch');
  assertIncludes(publicOrderPost, 'restaurantId: orderContext.restaurantId, slug: requestedTableSlug, qrToken: requestedTableToken, isActive: true', 'Public order POST scopes tenant table lookup by restaurantId slug token active');
  assertIncludes(publicOrderPost, 'restaurantId: orderContext.restaurantId', 'Public order POST writes resolved tenant restaurantId');
  assertIncludes(publicOrderPost, 'const paidOnline = orderContext.isDemoRestaurant ? Boolean(parsed.data.paidOnline) : false;', 'Public order POST forces non-demo tenant paidOnline false');
  assertIncludes(publicOrderPost, 'const orderNotifyWhenReady = orderContext.isDemoRestaurant && !hasTableContext ? notifyWhenReady : false;', 'Public order POST forces non-demo tenant notifyWhenReady false');
  assertIncludes(publicOrderPost, 'paidOnline,', 'Public order POST uses sanitized paidOnline value');
  assertIncludes(publicOrderPost, 'notifyWhenReady: orderNotifyWhenReady', 'Public order POST uses sanitized notifyWhenReady value');
  assertIncludes(publicOrderPost, 'tableId: tableContext?.id || null', 'Public order POST writes tenant tableId');
  assertIncludes(publicOrderPost, 'tableLabel: tableContext?.label || null', 'Public order POST writes tenant tableLabel');
  assertIncludes(publicOrderPost, 'tableSlug: tableContext?.slug || null', 'Public order POST writes tenant tableSlug');
  assertIncludes(publicOrderPost, 'orderContext: tableContext ? ORDER_CONTEXTS.TABLE : ORDER_CONTEXTS.STANDARD', 'Public order POST marks table order context');
  assertIncludes(publicOrderPost, 'orderSource: ORDER_SOURCES.CUSTOMER', 'Public order POST marks customer source');
  assertIncludes(publicOrderPost, 'Boolean(parsed.data.paidOnline)', 'Public order POST preserves demo paidOnline path');
  assertIncludes(publicOrderPost, '? notifyWhenReady : false', 'Public order POST preserves demo notifyWhenReady path');
  assertIncludes(publicOrderPost, 'where: orderContext.isDemoRestaurant', 'Public order POST keeps demo/tenant menu lookup branch');
  assertIncludes(publicOrderPost, 'id: { in: itemIds }, restaurantId: orderContext.restaurantId', 'Public order POST scopes tenant menu items by restaurantId');
  assertIncludes(publicOrderPost, 'orderItems.map((item) => ({', 'Public order POST maps nested tenant order items');
  assertIncludes(publicOrderPost, '...item, restaurantId: orderContext.restaurantId', 'Public order POST stamps nested order items');
  assertIncludes(publicOrderPost, 'item.quantity', 'Public order POST preserves quantity validation data flow');
  assertIncludes(publicOrderTrackRoute, 'withDemoRestaurantWhere({ reference })', 'Public order track lookup is demo-scoped');
  assertIncludes(publicOrderTrackRoute, 'prisma.order.findFirst', 'Public order track should not use global unique reference lookup');
  assertNotIncludes(publicOrderTrackRoute, 'findUnique({ where: { reference } })', 'Public order track must not lookup global reference');
  assertIncludes(publicOrderCancelRoute, 'withDemoRestaurantWhere({ reference: id })', 'Public order cancel lookup is demo-scoped');
  assertIncludes(publicOrderCancelRoute, 'prisma.order.findFirst', 'Public order cancel should not use global unique reference lookup');
  assertNotIncludes(publicOrderCancelRoute, 'findUnique({\n      where: { reference: id },\n    })', 'Public order cancel must not lookup global reference');
  assertIncludes(publicOrderCancelRoute, 'prisma.order.updateMany', 'Public order cancel mutation is demo-scoped');
  assertIncludes(publicOrderCancelRoute, 'withDemoRestaurantWhere({ id: order.id })', 'Public order cancel mutation uses demo restaurant scope');
  assertIncludes(publicOrderCancelRoute, 'updated.count !== 1', 'Public order cancel checks scoped mutation count');
  for (const [route, label] of [
    [tenantOrderTrackRoute, 'Tenant order track API'],
    [tenantOrderCancelRoute, 'Tenant order cancel API'],
  ]) {
    assertIncludes(route, 'restaurantSlug: z.string().trim().min(1)', `${label} requires restaurantSlug`);
    assertIncludes(route, 'reference: z.string().trim().min(3)', `${label} requires reference`);
    assertIncludes(route, 'phone: z.string().trim().min(4)', `${label} requires phone`);
    assertIncludes(route, 'resolveTenantOrderSupportContext(parsed.data.restaurantSlug)', `${label} resolves tenant context`);
    assertIncludes(route, "normalizedSlug === DEMO_RESTAURANT_SLUG", `${label} rejects demo slug`);
    assertIncludes(route, "restaurant.status === 'ARCHIVED'", `${label} rejects archived tenants`);
    assertIncludes(route, 'Restaurant order support is not initialized yet', `${label} rejects uninitialized tenants`);
    assertIncludes(route, 'FEATURE_KEYS.ONLINE_ORDERING', `${label} requires online ordering`);
    assertIncludes(route, 'where: { restaurantId: context.restaurantId, reference: parsed.data.reference, phone: parsed.data.phone }', `${label} lookup scopes by restaurantId reference phone`);
    assertNotIncludes(route, 'findUnique({ where: { reference', `${label} must not use global reference lookup`);
    assertIncludes(route, 'normalizeTenantPublicOrder', `${label} returns safe normalized order`);
    assertIncludes(route, 'reference: order.reference', `${label} normalized reference`);
    assertIncludes(route, 'status: order.status', `${label} normalized status`);
    assertIncludes(route, 'createdAt: order.createdAt', `${label} normalized createdAt`);
    assertIncludes(route, 'deliveryType: order.deliveryType', `${label} normalized deliveryType`);
    assertIncludes(route, 'tableLabel: order.tableLabel || null', `${label} normalized tableLabel`);
    assertIncludes(route, 'tableSlug: order.tableSlug || null', `${label} normalized tableSlug`);
    assertNotIncludes(route, 'return success({ order', `${label} response must not expose raw order`);
    assertNotIncludes(route, 'restaurantId: order.restaurantId', `${label} response must not expose restaurantId`);
  }
  assertIncludes(tenantOrderCancelRoute, 'prisma.order.updateMany', 'Tenant order cancel uses scoped updateMany');
  assertIncludes(tenantOrderCancelRoute, 'where: { id: order.id, restaurantId: context.restaurantId }', 'Tenant order cancel mutation scopes by restaurantId');
  assertIncludes(tenantOrderCancelRoute, 'updated.count !== 1', 'Tenant order cancel checks scoped update count');
  assertNotIncludes(tenantOrderSupportSource, 'sendWhatsApp', 'Tenant order support must not send WhatsApp');
  assertNotIncludes(tenantOrderSupportSource, 'sendMail', 'Tenant order support must not send email');
  assertNotIncludes(tenantOrderSupportSource, 'stripe', 'Tenant order support must not add payment logic');
  assertNotIncludes(tenantOrderSupportSource, 'inventoryMovement', 'Tenant order support must not consume inventory');
  assertNotIncludes(tenantOrderSupportSource, 'OrderRecipeConsumption', 'Tenant order support must not apply recipe consumption');
  assertNotIncludes(tenantOrderSupportSource, 'refund', 'Tenant order support must not add refund logic');
  assertNotIncludes(publicOrderPost, 'requireAdmin', 'Public order POST must not use platform admin auth');
  assertNotIncludes(publicOrderPost, 'sendWhatsAppMessage', 'Public order POST must not send WhatsApp');
  assertNotIncludes(publicOrderPost, 'sendMail', 'Public order POST must not send email');
  assertNotIncludes(publicOrderPost, 'inventoryMovement', 'Public order POST must not consume inventory');
  assertNotIncludes(publicOrderPost, 'OrderRecipeConsumption', 'Public order POST must not apply recipe consumption');
  assertNotIncludes(publicOrderPost, 'stripe', 'Public order POST must not add payment logic');
  assertNotIncludes(publicOrderPost, 'getTenantRestaurantContext', 'Public order POST should not resolve non-demo tenant context yet');
  const orderClient = read('src/components/OrderClient.jsx');
  assertIncludes(orderClient, 'restaurantSlug = null', 'Order client supports optional restaurantSlug');
  assertIncludes(orderClient, 'restaurantSlug ? { restaurantSlug } : {}', 'Order client sends tenant restaurantSlug only when present');
  assertIncludes(orderClient, '/api/orders/tenant-track', 'Order client uses tenant track endpoint');
  assertIncludes(orderClient, '/api/orders/tenant-cancel', 'Order client uses tenant cancel endpoint');
  assertIncludes(orderClient, 'trackPhone', 'Order client collects tenant track phone');
  assertIncludes(orderClient, 'cancelPhone', 'Order client collects tenant cancel phone');
  assertIncludes(orderClient, 'restaurantSlug, reference: trimmed, phone: trackPhone.trim()', 'Order client sends tenant track scope');
  assertIncludes(orderClient, 'restaurantSlug, reference: trimmed, phone: cancelPhone.trim()', 'Order client sends tenant cancel scope');

  assertIncludes(readme, 'Tenant order API boundary foundation added.', 'README Batch 56 note');
  assertIncludes(readme, 'Restaurant staff can view tenant-scoped orders and update order status under `/r/[restaurantSlug]/admin/orders`.', 'README Batch 56 order admin scope note');
  assertIncludes(readme, 'OWNER and MANAGER can update order status; SUPPORT remains read-only.', 'README Batch 56 order role note');
  assertIncludes(readme, 'Tenant public order creation activation added.', 'README Batch 57 note');
  assertIncludes(readme, 'Initialized, non-archived non-demo tenants can accept public orders at `/r/[restaurantSlug]/order` when ONLINE_ORDERING is enabled.', 'README Batch 57 public tenant ordering note');
  assertIncludes(readme, 'Orders and order items are stamped with the tenant restaurantId.', 'README Batch 57 restaurantId write note');
  assertIncludes(readme, 'Tenant table QR ordering activation added.', 'README Batch 58 table ordering activation note');
  assertIncludes(readme, 'Tenant table orders still force unpaid/no-notification flags and do not add payments, messaging, inventory, recipes, billing, domains, or provisioning.', 'README Batch 58 table order boundary note');
  assertIncludes(readme, 'Tenant public order support actions added.', 'README Batch 59 note');
  assertIncludes(readme, 'Tenant public order tracking and cancellation are scoped by restaurantSlug, reference, and phone.', 'README Batch 59 scoped support note');
  assertIncludes(readme, 'Demo order tracking/cancellation remains demo-scoped at `/api/orders/track` and `/api/orders/cancel`.', 'README Batch 59 demo support preservation note');
  assertIncludes(readme, 'Payments, refunds, messaging, inventory consumption, recipe consumption, billing, domains, and CRM remain future work.', 'README Batch 59 future boundary note');
  assertIncludes(readme, 'Demo order behavior remains available at `/public/order` and `/r/demo-restaurant/order`.', 'README Batch 56 demo order preservation note');

  assert(fs.existsSync(path.join(root, 'src/app/admin/(protected)/orders/page.jsx')), 'Demo admin orders page should remain present');
  assert(!fs.existsSync(path.join(root, 'src/app/api/billing')), 'Tenant orders batch should not add billing API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/payments')), 'Tenant orders batch should not add payments API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/email')), 'Tenant orders batch should not add email API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/whatsapp')), 'Tenant orders batch should not add WhatsApp API route');
  assert(!migrationDirs.some((migrationDir) => /order.boundary|tenant.order|order.admin|public.order/i.test(migrationDir)), 'Batch 57 should not add a Prisma migration');
}

function checkTenantKitchenQueueOperations() {
  const readme = read('README.md');
  const blocker = read('docs/TENANT_ADMIN_ACCESS_FOUNDATION_BLOCKER.md');
  const migrationDirs = fs.readdirSync(path.join(root, 'prisma/migrations'));
  const collectionRoutePath = path.join(root, 'src/app/api/restaurant-admin/kitchen/route.js');
  const itemRoutePath = path.join(root, 'src/app/api/restaurant-admin/kitchen/[id]/route.js');
  const tenantKitchenPagePath = path.join(root, 'src/app/r/[restaurantSlug]/admin/kitchen/page.js');
  const tenantKitchenClientPath = path.join(root, 'src/app/r/[restaurantSlug]/admin/kitchen/TenantKitchenClient.jsx');

  assert(fs.existsSync(collectionRoutePath), 'Tenant kitchen collection API route is missing');
  assert(fs.existsSync(itemRoutePath), 'Tenant kitchen item API route is missing');
  assert(fs.existsSync(tenantKitchenPagePath), 'Tenant kitchen admin page is missing');
  assert(fs.existsSync(tenantKitchenClientPath), 'Tenant kitchen admin client is missing');

  const collectionRoute = read('src/app/api/restaurant-admin/kitchen/route.js');
  const itemRoute = read('src/app/api/restaurant-admin/kitchen/[id]/route.js');
  const tenantKitchenPage = read('src/app/r/[restaurantSlug]/admin/kitchen/page.js');
  const tenantKitchenClient = read('src/app/r/[restaurantSlug]/admin/kitchen/TenantKitchenClient.jsx');
  const tenantNav = read('src/app/r/[restaurantSlug]/admin/TenantAdminNav.jsx');
  const tenantAdmin = read('src/app/r/[restaurantSlug]/admin/page.js');
  const kitchenApiSource = `${collectionRoute}\n${itemRoute}`;
  const kitchenUiSource = `${tenantKitchenPage}\n${tenantKitchenClient}\n${tenantNav}\n${tenantAdmin}`;

  assertIncludes(collectionRoute, 'requireRestaurantStaffAccess(request, restaurantSlug)', 'Tenant kitchen GET uses restaurant staff auth');
  assertIncludes(itemRoute, 'requireRestaurantStaffAccess(request, parsed.data.restaurantSlug, { write: true })', 'Tenant kitchen PUT requires OWNER/MANAGER');
  assertIncludes(collectionRoute, 'restaurantId: staff.restaurantId', 'Tenant kitchen GET scopes reads by restaurantId');
  assertIncludes(collectionRoute, 'notIn: [ORDER_STATUSES.COMPLETED, ORDER_STATUSES.CANCELLED]', 'Tenant kitchen queue excludes completed/cancelled orders');
  assertIncludes(collectionRoute, 'prisma.order.findMany', 'Tenant kitchen GET reads Order');
  assertIncludes(collectionRoute, 'TENANT_ORDER_INCLUDE', 'Tenant kitchen GET includes order items/table');
  assertIncludes(collectionRoute, 'statusFilter', 'Tenant kitchen GET supports status filter');
  assertIncludes(collectionRoute, 'orderContextFilter', 'Tenant kitchen GET supports order context filter');
  assertIncludes(collectionRoute, 'getKitchenQueueCounters', 'Tenant kitchen GET returns lightweight counters');
  assertIncludes(collectionRoute, 'normalizeTenantOrders', 'Tenant kitchen GET returns normalized orders');
  assertIncludes(tenantAdmin, 'requireRestaurantStaffAccess(cookies(), params.restaurantSlug)', 'Tenant admin overview uses DB-backed staff access before kitchen counters');
  assertIncludes(tenantAdmin, 'redirect(`/r/${params.restaurantSlug}/admin/login`)', 'Tenant admin overview redirects failed staff validation');
  assertIncludes(tenantAdmin, 'prisma.order.findMany({', 'Tenant admin overview reads kitchen counter orders');
  assertIncludes(tenantAdmin, 'restaurantId: staff.restaurantId', 'Tenant admin overview kitchen counters scope by restaurantId');

  assertIncludes(itemRoute, 'prisma.$transaction', 'Tenant kitchen PUT uses transaction');
  assertIncludes(itemRoute, 'tx.order.findFirst', 'Tenant kitchen PUT reads by scoped order lookup');
  assertIncludes(itemRoute, 'where: { id: params.id, restaurantId: staff.restaurantId }', 'Tenant kitchen PUT scopes lookup by restaurantId');
  assertIncludes(itemRoute, 'tx.order.updateMany', 'Tenant kitchen PUT mutation is tenant-scoped');
  assertIncludes(itemRoute, 'restaurantId: staff.restaurantId', 'Tenant kitchen PUT mutation includes restaurantId');
  assertIncludes(itemRoute, 'updated.count !== 1', 'Tenant kitchen PUT checks scoped update count');
  assertIncludes(itemRoute, 'const order = await tx.order.findFirst', 'Tenant kitchen PUT reads updated order with tenant scope');
  assertIncludes(itemRoute, 'status: z.string().refine(isValidOrderStatus', 'Tenant kitchen PUT validates status');
  assertIncludes(itemRoute, 'canTransitionOrderStatus', 'Tenant kitchen PUT validates status transitions');
  assertIncludes(itemRoute, 'Cannot move kitchen order from', 'Tenant kitchen PUT returns transition error');
  assertNotIncludes(itemRoute, 'prisma.order.update({', 'Tenant kitchen PUT must not mutate by id only');

  assertNotIncludes(kitchenApiSource, 'requireAdmin', 'Tenant kitchen APIs must not use platform requireAdmin');
  assertNotIncludes(kitchenApiSource, 'getAdminFromRequest', 'Tenant kitchen APIs must not use platform admin session');
  assertNotIncludes(kitchenApiSource, 'prisma.adminUser', 'Tenant kitchen APIs must not touch AdminUser');
  assertNotIncludes(kitchenApiSource, 'prisma.gatewayLead', 'Tenant kitchen APIs must not touch GatewayLead');
  assertNotIncludes(kitchenApiSource, 'prisma.order.create', 'Tenant kitchen APIs must not create orders');
  assertNotIncludes(kitchenApiSource, 'export async function DELETE', 'Tenant kitchen APIs must not expose DELETE');
  assertNotIncludes(kitchenApiSource, 'sendWhatsApp', 'Tenant kitchen APIs must not send WhatsApp');
  assertNotIncludes(kitchenApiSource, 'sendMail', 'Tenant kitchen APIs must not send email');
  assertNotIncludes(kitchenApiSource, 'stripe', 'Tenant kitchen APIs must not add payment logic');
  assertNotIncludes(kitchenApiSource, 'inventoryMovement', 'Tenant kitchen APIs must not consume inventory');
  assertNotIncludes(kitchenApiSource, 'OrderRecipeConsumption', 'Tenant kitchen APIs must not apply recipe consumption');
  assertNotIncludes(kitchenApiSource, 'billing', 'Tenant kitchen APIs must not add billing logic');
  assertNotIncludes(kitchenApiSource, 'domain', 'Tenant kitchen APIs must not add domain logic');
  assertNotIncludes(kitchenApiSource, 'crm', 'Tenant kitchen APIs must not add CRM logic');
  assertNotIncludes(kitchenApiSource, 'payroll', 'Tenant kitchen APIs must not add payroll logic');
  if (kitchenApiSource.includes('orderStatusHistory.create')) {
    assertIncludes(kitchenApiSource, 'restaurantId: staff.restaurantId', 'Tenant kitchen status history writes must include restaurantId');
  }

  assertIncludes(tenantKitchenPage, 'requireRestaurantStaffAccess(cookies(), params.restaurantSlug)', 'Tenant kitchen page uses DB-backed staff access');
  assertIncludes(tenantKitchenPage, 'redirect(`/r/${params.restaurantSlug}/admin/login`)', 'Tenant kitchen page redirects failed staff validation');
  assertIncludes(tenantKitchenPage, '<TenantKitchenClient', 'Tenant kitchen page renders client');
  assertIncludes(tenantKitchenClient, '/api/restaurant-admin/kitchen', 'Tenant kitchen client uses kitchen API');
  assertIncludes(tenantKitchenClient, "'PUT'", 'Tenant kitchen client updates status via PUT');
  assertNotIncludes(tenantKitchenClient, "'POST'", 'Tenant kitchen client must not create orders');
  assertNotIncludes(tenantKitchenClient, "'DELETE'", 'Tenant kitchen client must not delete orders');
  assertIncludes(tenantKitchenClient, 'SUPPORT access is read-only', 'Tenant kitchen client support read-only state');
  assertIncludes(tenantKitchenClient, 'OWNER or MANAGER access is required', 'Tenant kitchen client write role copy');
  assertIncludes(tenantKitchenClient, 'No active kitchen orders', 'Tenant kitchen client empty state');
  assertIncludes(tenantKitchenClient, 'Table order', 'Tenant kitchen client shows table order context');
  assertIncludes(tenantKitchenClient, 'tableLabel', 'Tenant kitchen client shows table label');
  assertIncludes(tenantKitchenClient, 'Refresh', 'Tenant kitchen client manual refresh');
  assertIncludes(tenantKitchenClient, 'No payment, messaging, inventory, or recipe workflow is triggered.', 'Tenant kitchen client boundary copy');
  assertIncludes(tenantNav, "label: 'Kitchen'", 'Tenant admin navigation includes Kitchen');
  assertIncludes(tenantNav, "href: `/r/${restaurantSlug}/admin/kitchen`", 'Tenant admin navigation kitchen route');
  assertIncludes(tenantAdmin, 'Open kitchen', 'Tenant admin dashboard links to kitchen');
  assertIncludes(tenantAdmin, 'active prep queue', 'Tenant admin dashboard kitchen copy');
  assertIncludes(tenantAdmin, 'kitchenCounters', 'Tenant admin dashboard includes kitchen counters');
  assertNotIncludes(kitchenUiSource, '/platform-admin', 'Tenant kitchen UI must not link to platform admin');

  assertIncludes(readme, 'Tenant kitchen queue operations added.', 'README Batch 61 note');
  assertIncludes(readme, 'Restaurant staff can view active tenant orders and update prep status under `/r/[restaurantSlug]/admin/kitchen`.', 'README Batch 61 kitchen scope note');
  assertIncludes(readme, 'Kitchen queue excludes completed and cancelled orders and remains scoped to the staff restaurantId.', 'README Batch 61 active queue note');
  assertIncludes(readme, 'No payment, messaging, inventory consumption, recipe consumption, billing, domain, CRM, payroll, or analytics behavior was added.', 'README Batch 61 boundary note');
  assertIncludes(blocker, 'Batch 61 adds tenant-scoped kitchen queue and active order prep status management.', 'Tenant admin doc Batch 61 note');
  assertIncludes(blocker, 'Tenant kitchen queue reads and status updates are scoped by restaurantId.', 'Tenant admin doc kitchen scoping boundary');
  assertIncludes(blocker, 'automatic recipe depletion, order inventory consumption, supplier ordering, invoices, staff invitations, audit logging, self-service password reset flows, billing, domains, CRM, payroll, analytics, email, and WhatsApp automation remain future work.', 'Tenant admin doc future work boundary');

  assert(!fs.existsSync(path.join(root, 'src/app/api/billing')), 'Tenant kitchen batch should not add billing API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/payments')), 'Tenant kitchen batch should not add payments API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/email')), 'Tenant kitchen batch should not add email API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/whatsapp')), 'Tenant kitchen batch should not add WhatsApp API route');
  assert(!migrationDirs.some((migrationDir) => /kitchen.queue|tenant.kitchen|operations.dashboard/i.test(migrationDir)), 'Batch 61 should not add a Prisma migration');
}

function checkTenantInventoryManagementFoundation() {
  const readme = read('README.md');
  const blocker = read('docs/TENANT_ADMIN_ACCESS_FOUNDATION_BLOCKER.md');
  const migrationDirs = fs.readdirSync(path.join(root, 'prisma/migrations'));
  const itemsRoutePath = path.join(root, 'src/app/api/restaurant-admin/inventory/items/route.js');
  const itemRoutePath = path.join(root, 'src/app/api/restaurant-admin/inventory/items/[id]/route.js');
  const movementsRoutePath = path.join(root, 'src/app/api/restaurant-admin/inventory/movements/route.js');
  const tenantInventoryPagePath = path.join(root, 'src/app/r/[restaurantSlug]/admin/inventory/page.js');
  const tenantInventoryClientPath = path.join(root, 'src/app/r/[restaurantSlug]/admin/inventory/TenantInventoryClient.jsx');

  assert(fs.existsSync(itemsRoutePath), 'Tenant inventory items collection API route is missing');
  assert(fs.existsSync(itemRoutePath), 'Tenant inventory item API route is missing');
  assert(fs.existsSync(movementsRoutePath), 'Tenant inventory movements API route is missing');
  assert(fs.existsSync(tenantInventoryPagePath), 'Tenant inventory admin page is missing');
  assert(fs.existsSync(tenantInventoryClientPath), 'Tenant inventory admin client is missing');

  const itemsRoute = read('src/app/api/restaurant-admin/inventory/items/route.js');
  const itemRoute = read('src/app/api/restaurant-admin/inventory/items/[id]/route.js');
  const movementsRoute = read('src/app/api/restaurant-admin/inventory/movements/route.js');
  const tenantInventoryPage = read('src/app/r/[restaurantSlug]/admin/inventory/page.js');
  const tenantInventoryClient = read('src/app/r/[restaurantSlug]/admin/inventory/TenantInventoryClient.jsx');
  const tenantNav = read('src/app/r/[restaurantSlug]/admin/TenantAdminNav.jsx');
  const tenantAdmin = read('src/app/r/[restaurantSlug]/admin/page.js');
  const inventoryApiSource = `${itemsRoute}\n${itemRoute}\n${movementsRoute}`;
  const inventoryUiSource = `${tenantInventoryPage}\n${tenantInventoryClient}\n${tenantNav}\n${tenantAdmin}`;

  assertIncludes(itemsRoute, 'requireRestaurantStaffAccess(request, restaurantSlug)', 'Tenant inventory items GET uses restaurant staff auth');
  assertIncludes(itemsRoute, 'requireRestaurantStaffAccess(request, parsed.data.restaurantSlug, { write: true })', 'Tenant inventory item create requires OWNER/MANAGER');
  assertIncludes(itemRoute, 'requireRestaurantStaffAccess(request, parsed.data.restaurantSlug, { write: true })', 'Tenant inventory item update requires OWNER/MANAGER');
  assertIncludes(itemRoute, 'requireRestaurantStaffAccess(request, restaurantSlug, { write: true })', 'Tenant inventory item deactivate requires OWNER/MANAGER');
  assertIncludes(movementsRoute, 'requireRestaurantStaffAccess(request, restaurantSlug)', 'Tenant inventory movement GET uses restaurant staff auth');
  assertIncludes(movementsRoute, 'requireRestaurantStaffAccess(request, parsed.data.restaurantSlug, { write: true })', 'Tenant inventory movement POST requires OWNER/MANAGER');
  assertIncludes(itemsRoute, 'restaurantId: staff.restaurantId', 'Tenant inventory items collection scopes by restaurantId');
  assertIncludes(itemRoute, 'where: { id: params.id, restaurantId: staff.restaurantId }', 'Tenant inventory item route scopes mutations by restaurantId');
  assertIncludes(itemRoute, 'prisma.inventoryItem.updateMany', 'Tenant inventory item update/deactivate uses scoped updateMany');
  assertIncludes(itemRoute, 'updated.count !== 1', 'Tenant inventory item route checks scoped update count');
  assertIncludes(itemRoute, 'const item = await prisma.inventoryItem.findFirst', 'Tenant inventory item route reads updated item with tenant scope');
  assertIncludes(itemsRoute, 'where: { sku: data.sku, restaurantId: staff.restaurantId }', 'Tenant inventory create SKU check is tenant-scoped');
  assertIncludes(itemRoute, 'sku: data.sku', 'Tenant inventory update SKU check includes SKU');
  assertIncludes(itemRoute, 'restaurantId: staff.restaurantId', 'Tenant inventory update SKU check includes restaurantId');
  assertIncludes(itemRoute, 'NOT: { id: params.id }', 'Tenant inventory update SKU check excludes current item');
  assertIncludes(itemsRoute, 'isPrismaUniqueConstraintError(error)', 'Tenant inventory create handles global SKU unique constraint safely');
  assertIncludes(itemRoute, 'isPrismaUniqueConstraintError(error)', 'Tenant inventory update handles global SKU unique constraint safely');
  assertIncludes(itemsRoute, 'Inventory SKU is unavailable', 'Tenant inventory create unique constraint response is generic');
  assertIncludes(itemRoute, 'Inventory SKU is unavailable', 'Tenant inventory update unique constraint response is generic');
  assertNotIncludes(itemsRoute, 'findUnique({\n        where: { sku: data.sku }', 'Tenant inventory create must not use global SKU findUnique');
  assertNotIncludes(itemRoute, 'findUnique({\n        where: { sku: data.sku }', 'Tenant inventory update must not use global SKU findUnique');
  assertNotIncludes(itemRoute, 'prisma.inventoryItem.update({', 'Tenant inventory item route must not update by id only');
  assertNotIncludes(inventoryApiSource, 'prisma.inventoryItem.delete', 'Tenant inventory APIs must not hard delete inventory items');
  assertNotIncludes(inventoryApiSource, 'prisma.inventoryMovement.delete', 'Tenant inventory APIs must not hard delete inventory movements');

  assertIncludes(itemsRoute, 'search', 'Tenant inventory items support search filter');
  assertIncludes(itemsRoute, 'lowStock', 'Tenant inventory items support low-stock filter');
  assertIncludes(itemsRoute, 'categoryFilter', 'Tenant inventory items support category filter');
  assertIncludes(itemsRoute, 'statusFilter', 'Tenant inventory items support status filter');
  assertIncludes(itemsRoute, 'normalizeInventoryItem', 'Tenant inventory items normalize output');
  assertNotIncludes(itemsRoute, 'restaurantId: item.restaurantId', 'Tenant inventory item normalizer must not expose restaurantId');

  assertIncludes(movementsRoute, 'isValidInventoryMovementType(parsed.data.type)', 'Tenant inventory movement validates type');
  assertIncludes(movementsRoute, 'tx.inventoryItem.findFirst', 'Tenant inventory movement validates item in transaction');
  assertIncludes(movementsRoute, 'where: { id: parsed.data.itemId, restaurantId: staff.restaurantId, isActive: true }', 'Tenant inventory movement validates item belongs to staff restaurant');
  assertIncludes(movementsRoute, 'tx.inventoryItem.updateMany', 'Tenant inventory movement stock adjustment uses scoped updateMany');
  assertIncludes(movementsRoute, 'updated.count !== 1', 'Tenant inventory movement checks scoped stock update count');
  assertIncludes(movementsRoute, 'tx.inventoryMovement.create', 'Tenant inventory movement records manual movement');
  assertIncludes(movementsRoute, 'restaurantId: staff.restaurantId', 'Tenant inventory movement writes restaurantId');
  assertIncludes(movementsRoute, 'createdByAdminEmail: staff.email', 'Tenant inventory movement records staff email');
  assertNotIncludes(movementsRoute, 'orderId', 'Tenant inventory movement must not link to orders');
  assertNotIncludes(movementsRoute, 'recipeConsumption', 'Tenant inventory movement must not link recipe consumption');

  assertNotIncludes(inventoryApiSource, 'requireAdmin', 'Tenant inventory APIs must not use platform requireAdmin');
  assertNotIncludes(inventoryApiSource, 'getAdminFromRequest', 'Tenant inventory APIs must not use platform admin session');
  assertNotIncludes(inventoryApiSource, 'prisma.adminUser', 'Tenant inventory APIs must not touch AdminUser');
  assertNotIncludes(inventoryApiSource, 'prisma.gatewayLead', 'Tenant inventory APIs must not touch GatewayLead');
  assertNotIncludes(inventoryApiSource, 'prisma.order', 'Tenant inventory APIs must not touch orders');
  assertNotIncludes(inventoryApiSource, 'OrderRecipeConsumption', 'Tenant inventory APIs must not apply recipe consumption');
  assertNotIncludes(inventoryApiSource, 'supplier', 'Tenant inventory APIs must not add supplier automation');
  assertNotIncludes(inventoryApiSource, 'invoice', 'Tenant inventory APIs must not add invoice automation');
  assertNotIncludes(inventoryApiSource, 'stripe', 'Tenant inventory APIs must not add payment logic');
  assertNotIncludes(inventoryApiSource, 'sendWhatsApp', 'Tenant inventory APIs must not send WhatsApp');
  assertNotIncludes(inventoryApiSource, 'sendMail', 'Tenant inventory APIs must not send email');
  assertNotIncludes(inventoryApiSource, 'billing', 'Tenant inventory APIs must not add billing logic');
  assertNotIncludes(inventoryApiSource, 'domain', 'Tenant inventory APIs must not add domain logic');
  assertNotIncludes(inventoryApiSource, 'crm', 'Tenant inventory APIs must not add CRM logic');
  assertNotIncludes(inventoryApiSource, 'payroll', 'Tenant inventory APIs must not add payroll logic');
  assertNotIncludes(inventoryApiSource, 'analytics', 'Tenant inventory APIs must not add analytics engine logic');

  assertIncludes(tenantInventoryPage, 'requireRestaurantStaffAccess(cookies(), params.restaurantSlug)', 'Tenant inventory page uses DB-backed staff access');
  assertIncludes(tenantInventoryPage, 'redirect(`/r/${params.restaurantSlug}/admin/login`)', 'Tenant inventory page redirects failed staff validation');
  assertIncludes(tenantInventoryPage, '<TenantInventoryClient', 'Tenant inventory page renders client');
  assertIncludes(tenantInventoryClient, '/api/restaurant-admin/inventory/items', 'Tenant inventory client uses items API');
  assertIncludes(tenantInventoryClient, '/api/restaurant-admin/inventory/movements', 'Tenant inventory client uses movements API');
  assertIncludes(tenantInventoryClient, "'POST'", 'Tenant inventory client creates items/movements via POST');
  assertIncludes(tenantInventoryClient, "'PUT'", 'Tenant inventory client updates items via PUT');
  assertIncludes(tenantInventoryClient, "method: 'DELETE'", 'Tenant inventory client deactivates items via DELETE');
  assertIncludes(tenantInventoryClient, 'SUPPORT access is read-only', 'Tenant inventory client support read-only state');
  assertIncludes(tenantInventoryClient, 'OWNER or MANAGER access is required', 'Tenant inventory client write role copy');
  assertIncludes(tenantInventoryClient, 'Low stock', 'Tenant inventory client shows low-stock state');
  assertIncludes(tenantInventoryClient, 'Manual stock adjustment', 'Tenant inventory client manual movement form');
  assertIncludes(tenantInventoryClient, 'Movement history', 'Tenant inventory client movement history');
  assertIncludes(tenantInventoryClient, 'No inventory items yet', 'Tenant inventory client empty state');
  assertIncludes(tenantInventoryClient, 'Refresh', 'Tenant inventory client manual refresh');
  assertNotIncludes(inventoryUiSource, '/platform-admin', 'Tenant inventory UI must not link to platform admin');
  assertNotIncludes(inventoryUiSource, 'Supplier', 'Tenant inventory UI must not add supplier controls');
  assertNotIncludes(inventoryUiSource, 'Invoice', 'Tenant inventory UI must not add invoice controls');
  assertIncludes(tenantNav, "label: 'Inventory'", 'Tenant admin navigation includes Inventory');
  assertIncludes(tenantNav, "href: `/r/${restaurantSlug}/admin/inventory`", 'Tenant admin navigation inventory route');
  assertIncludes(tenantAdmin, 'inventoryCounters', 'Tenant admin dashboard includes inventory counters');
  assertIncludes(tenantAdmin, 'Open inventory', 'Tenant admin dashboard links to inventory');
  assertIncludes(tenantAdmin, 'Manual inventory movements', 'Tenant admin dashboard inventory movement copy');
  assertIncludes(tenantAdmin, 'restaurantId: staff.restaurantId', 'Tenant admin inventory counters scope by restaurantId');

  assertIncludes(readme, 'Tenant inventory management foundation added.', 'README Batch 62 note');
  assertIncludes(readme, 'Restaurant staff can manage tenant-scoped inventory items and manual stock movements under `/r/[restaurantSlug]/admin/inventory`.', 'README Batch 62 scope note');
  assertIncludes(readme, 'OWNER and MANAGER can create, update, deactivate, and adjust inventory; SUPPORT remains read-only.', 'README Batch 62 role note');
  assertIncludes(readme, 'Automatic recipe depletion, order inventory consumption, supplier ordering, invoices, payments, billing, domains, CRM, payroll, analytics, email, and WhatsApp automation remain future work.', 'README Batch 62 boundary note');
  assertIncludes(blocker, 'Batch 62 adds tenant-scoped inventory item management and manual inventory movement tracking.', 'Tenant admin doc Batch 62 note');
  assertIncludes(blocker, 'Tenant inventory reads, item updates, soft deactivation, and manual movements are scoped by restaurantId.', 'Tenant admin doc inventory scoping boundary');
  assertIncludes(blocker, 'Assisted ordering, payments, refunds, messaging, advanced guest automation, advanced kitchen automation, automatic recipe depletion, order inventory consumption, supplier ordering, invoices, staff invitations, audit logging, self-service password reset flows, billing, domains, CRM, payroll, analytics, email, and WhatsApp automation remain future work.', 'Tenant admin doc inventory future boundary');

  assert(!fs.existsSync(path.join(root, 'src/app/api/billing')), 'Tenant inventory batch should not add billing API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/payments')), 'Tenant inventory batch should not add payments API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/email')), 'Tenant inventory batch should not add email API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/whatsapp')), 'Tenant inventory batch should not add WhatsApp API route');
  assert(!migrationDirs.some((migrationDir) => /tenant.inventory|inventory.management|202606.*inventory/i.test(migrationDir)), 'Batch 62 should not add a Prisma migration');
}

function checkGatewayLeadAdminManagement() {
  const packageJson = read('package.json');
  const schema = read('prisma/schema.prisma');
  const readme = read('README.md');
  const helperPath = path.join(root, 'src/lib/gateway-leads.js');
  const adminPagePath = path.join(root, 'src/app/admin/(protected)/gateway-leads/page.jsx');
  const platformPagePath = path.join(root, 'src/app/platform-admin/(protected)/leads/page.jsx');
  const adminClientPath = path.join(root, 'src/app/platform-admin/(protected)/leads/GatewayLeadsClient.jsx');
  const collectionRoutePath = path.join(root, 'src/app/api/admin/gateway-leads/route.js');
  const itemRoutePath = path.join(root, 'src/app/api/admin/gateway-leads/[id]/route.js');

  assert(fs.existsSync(helperPath), 'Gateway lead helper is missing');
  assert(fs.existsSync(adminPagePath), 'Gateway lead admin page is missing');
  assert(fs.existsSync(platformPagePath), 'Gateway lead platform admin page is missing');
  assert(fs.existsSync(adminClientPath), 'Gateway lead platform admin client is missing');
  assert(fs.existsSync(collectionRoutePath), 'Gateway lead admin collection API route is missing');
  assert(fs.existsSync(itemRoutePath), 'Gateway lead admin item API route is missing');

  const helper = read('src/lib/gateway-leads.js');
  const adminShell = read('src/app/admin/components/AdminShell.jsx');
  const platformShell = read('src/app/platform-admin/components/PlatformAdminShell.jsx');
  const adminPage = read('src/app/admin/(protected)/gateway-leads/page.jsx');
  const platformPage = read('src/app/platform-admin/(protected)/leads/page.jsx');
  const adminClient = read('src/app/platform-admin/(protected)/leads/GatewayLeadsClient.jsx');
  const collectionRoute = read('src/app/api/admin/gateway-leads/route.js');
  const itemRoute = read('src/app/api/admin/gateway-leads/[id]/route.js');
  const gatewayAdminSource = [helper, adminPage, adminClient, collectionRoute, itemRoute].join('\n');

  for (const status of ['NEW', 'CONTACTED', 'QUALIFIED', 'ARCHIVED']) {
    assertIncludes(helper, status, `Gateway lead helper status ${status}`);
    assertIncludes(adminClient, status, `Gateway lead UI status ${status}`);
  }

  assertIncludes(helper, 'GATEWAY_LEAD_STATUSES', 'Gateway lead status constants');
  assertIncludes(helper, 'getGatewayLeadStatusLabel', 'Gateway lead status label helper');
  assertIncludes(helper, 'normalizeGatewayLead', 'Gateway lead normalizer');
  assertIncludes(helper, 'isValidGatewayLeadStatus', 'Gateway lead status validator');
  assertIncludes(helper, 'JSON.parse', 'Gateway lead interested modules parsing');

  assertNotIncludes(adminShell, "href: '/admin/gateway-leads'", 'Gateway Leads restaurant admin navigation href');
  assertNotIncludes(adminShell, "label: 'Gateway Leads'", 'Gateway Leads restaurant admin navigation label');
  assertIncludes(platformShell, "href: '/platform-admin/leads'", 'Gateway Leads platform admin navigation href');
  assertIncludes(platformShell, "label: 'Gateway Leads'", 'Gateway Leads platform admin navigation label');
  assertIncludes(adminPage, "redirect('/platform-admin/leads')", 'Gateway Leads old admin route redirect');
  assertIncludes(platformPage, '<GatewayLeadsClient />', 'Gateway Leads platform page client render');

  assertIncludes(collectionRoute, "await requireAdmin(request, ['ADMIN'])", 'Gateway lead collection API role guard');
  assertIncludes(collectionRoute, 'prisma.gatewayLead.findMany', 'Gateway lead collection API list query');
  assertIncludes(collectionRoute, "orderBy: { createdAt: 'desc' }", 'Gateway lead collection API newest first');
  assertIncludes(collectionRoute, 'searchParams.get', 'Gateway lead collection API filters');
  assertIncludes(collectionRoute, 'restaurantName', 'Gateway lead collection API restaurant search');
  assertIncludes(collectionRoute, 'contactName', 'Gateway lead collection API contact search');
  assertIncludes(collectionRoute, 'phone', 'Gateway lead collection API phone search');
  assertIncludes(collectionRoute, 'email', 'Gateway lead collection API email search');
  assertIncludes(collectionRoute, 'normalizeGatewayLead', 'Gateway lead collection API safe normalization');

  assertIncludes(itemRoute, "await requireAdmin(request, ['ADMIN'])", 'Gateway lead item API role guard');
  assertIncludes(itemRoute, 'z.object', 'Gateway lead item API Zod schema');
  assertIncludes(itemRoute, 'status: z.enum(GATEWAY_LEAD_STATUSES)', 'Gateway lead status update validation');
  assertIncludes(itemRoute, 'updateSchema.safeParse', 'Gateway lead update validation usage');
  assertIncludes(itemRoute, 'prisma.gatewayLead.update', 'Gateway lead status persistence');
  assertNotIncludes(itemRoute, 'message:', 'Gateway lead item API message editing');
  assertNotIncludes(itemRoute, 'interestedModules:', 'Gateway lead item API module editing');

  assertIncludes(adminClient, '/api/admin/gateway-leads', 'Gateway lead admin UI API usage');
  assertIncludes(adminClient, 'Total leads', 'Gateway lead admin total count');
  assertIncludes(adminClient, 'countByStatus', 'Gateway lead admin status counts');
  assertIncludes(adminClient, 'restaurantName', 'Gateway lead admin restaurant display');
  assertIncludes(adminClient, 'contactName', 'Gateway lead admin contact display');
  assertIncludes(adminClient, 'interestedModules', 'Gateway lead admin interested modules display');
  assertIncludes(adminClient, 'message', 'Gateway lead admin message display');
  assertIncludes(adminClient, 'createdAt', 'Gateway lead admin createdAt display');

  assertNotIncludes(packageJson, '"stripe"', 'Gateway lead admin Stripe dependency');
  assert(!fs.existsSync(path.join(root, 'src/app/api/billing')), 'Gateway lead admin should not add billing API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/payments')), 'Gateway lead admin should not add payments API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/provisioning')), 'Gateway lead admin should not add provisioning API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/crm')), 'Gateway lead admin should not add CRM API route');
  assertOperationalTablesAreNotRestaurantScoped(schema, 'Gateway lead admin operational tenant scope');
  assertNotIncludes(gatewayAdminSource, 'sendMail', 'Gateway lead admin email sending');
  assertNotIncludes(gatewayAdminSource, 'nodemailer', 'Gateway lead admin nodemailer usage');
  assertNotIncludes(gatewayAdminSource, 'sendWhatsApp', 'Gateway lead admin WhatsApp sending');
  assertNotIncludes(gatewayAdminSource, 'whatsapp', 'Gateway lead admin WhatsApp automation');
  assertNotIncludes(gatewayAdminSource, 'subscription', 'Gateway lead admin subscription logic');
  assertNotIncludes(gatewayAdminSource, 'payment', 'Gateway lead admin payment logic');
  assertNotIncludes(gatewayAdminSource, 'provision', 'Gateway lead admin provisioning logic');
  assertNotIncludes(gatewayAdminSource, 'crm', 'Gateway lead admin CRM automation');

  assertIncludes(readme, 'Gateway lead admin management added.', 'README gateway lead admin note');
  assertIncludes(readme, 'No CRM automation yet', 'README gateway lead no CRM note');
  assertIncludes(readme, 'No email/WhatsApp sending yet', 'README gateway lead no sending note');
  assertIncludes(readme, 'No subscription/payment logic yet', 'README gateway lead no payments note');
  assertIncludes(readme, 'No automatic restaurant provisioning yet', 'README gateway lead no provisioning note');
}

function checkGatewayLeadWorkflowPolish() {
  const packageJson = read('package.json');
  const schema = read('prisma/schema.prisma');
  const helper = read('src/lib/gateway-leads.js');
  const collectionRoute = read('src/app/api/admin/gateway-leads/route.js');
  const itemRoute = read('src/app/api/admin/gateway-leads/[id]/route.js');
  const adminClient = read('src/app/platform-admin/(protected)/leads/GatewayLeadsClient.jsx');
  const readme = read('README.md');
  const migrationPath = path.join(root, 'prisma/migrations/20260602142500_add_gateway_lead_workflow_fields/migration.sql');
  const workflowSource = [helper, collectionRoute, itemRoute, adminClient].join('\n');

  assert(fs.existsSync(migrationPath), 'Gateway lead workflow migration is missing');
  assertIncludes(schema, 'internalNotes', 'GatewayLead internalNotes field');
  assertIncludes(schema, 'lastContactedAt', 'GatewayLead lastContactedAt field');
  assertIncludes(schema, '@updatedAt', 'GatewayLead updatedAt field');
  assertIncludes(schema, '@@index([lastContactedAt])', 'GatewayLead lastContactedAt index');

  assertIncludes(helper, 'internalNotes', 'Gateway lead helper internalNotes normalization');
  assertIncludes(helper, 'lastContactedAt', 'Gateway lead helper lastContactedAt normalization');
  assertIncludes(helper, 'updatedAt', 'Gateway lead helper updatedAt normalization');
  assertIncludes(helper, 'getGatewayLeadFollowUpState', 'Gateway lead follow-up state helper');
  assertIncludes(helper, 'normalizeGatewayLeadInternalNotes', 'Gateway lead internal notes input helper');

  assertIncludes(collectionRoute, 'followUpState', 'Gateway lead collection follow-up filter');
  assertIncludes(collectionRoute, 'getGatewayLeadFollowUpState', 'Gateway lead collection follow-up helper');
  assertIncludes(collectionRoute, 'normalizeGatewayLead', 'Gateway lead collection returns normalized fields');

  assertIncludes(itemRoute, 'status: z.enum(GATEWAY_LEAD_STATUSES).optional()', 'Gateway lead update status optional validation');
  assertIncludes(itemRoute, 'internalNotes: z.string()', 'Gateway lead update internalNotes validation');
  assertIncludes(itemRoute, 'lastContactedAt', 'Gateway lead update lastContactedAt validation');
  assertIncludes(itemRoute, 'markContactedNow', 'Gateway lead update mark contacted now validation');
  assertIncludes(itemRoute, 'normalizeGatewayLeadInternalNotes', 'Gateway lead update notes trimming');
  assertIncludes(itemRoute, 'data.internalNotes =', 'Gateway lead update notes persistence');
  assertIncludes(itemRoute, 'data.lastContactedAt = new Date()', 'Gateway lead update mark contacted now persistence');
  assertNotIncludes(itemRoute, 'restaurantName:', 'Gateway lead update submitted restaurant editing');
  assertNotIncludes(itemRoute, 'contactName:', 'Gateway lead update submitted contact editing');
  assertNotIncludes(itemRoute, 'phone:', 'Gateway lead update submitted phone editing');
  assertNotIncludes(itemRoute, 'email:', 'Gateway lead update submitted email editing');
  assertNotIncludes(itemRoute, 'message:', 'Gateway lead update submitted message editing');
  assertNotIncludes(itemRoute, 'interestedModules:', 'Gateway lead update submitted modules editing');

  assertIncludes(adminClient, 'selectedLeadId', 'Gateway lead admin selected detail state');
  assertIncludes(adminClient, 'Lead details', 'Gateway lead admin detail card');
  assertIncludes(adminClient, 'Private internal notes', 'Gateway lead admin private notes copy');
  assertIncludes(adminClient, 'markContactedNow', 'Gateway lead admin mark contacted action payload');
  assertIncludes(adminClient, 'Mark contacted now', 'Gateway lead admin mark contacted button');
  assertIncludes(adminClient, 'Needs follow-up', 'Gateway lead admin follow-up indicator');
  assertIncludes(adminClient, 'New lead', 'Gateway lead admin new indicator');
  assertIncludes(adminClient, 'Contacted', 'Gateway lead admin contacted indicator');
  assertIncludes(adminClient, 'Archived', 'Gateway lead admin archived indicator');

  assertNotIncludes(packageJson, '"stripe"', 'Gateway lead workflow Stripe dependency');
  assert(!fs.existsSync(path.join(root, 'src/app/api/billing')), 'Gateway lead workflow should not add billing API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/payments')), 'Gateway lead workflow should not add payments API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/provisioning')), 'Gateway lead workflow should not add provisioning API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/crm')), 'Gateway lead workflow should not add CRM API route');
  assertOperationalTablesAreNotRestaurantScoped(schema, 'Gateway lead workflow operational tenant scope');
  assertNotIncludes(workflowSource, 'sendMail', 'Gateway lead workflow email sending');
  assertNotIncludes(workflowSource, 'nodemailer', 'Gateway lead workflow nodemailer usage');
  assertNotIncludes(workflowSource, 'sendWhatsApp', 'Gateway lead workflow WhatsApp sending');
  assertNotIncludes(workflowSource, 'reminder', 'Gateway lead workflow reminders');
  assertNotIncludes(workflowSource, 'notification', 'Gateway lead workflow notifications');
  assertNotIncludes(workflowSource, 'subscription', 'Gateway lead workflow subscription logic');
  assertNotIncludes(workflowSource, 'payment', 'Gateway lead workflow payment logic');
  assertNotIncludes(workflowSource, 'provision', 'Gateway lead workflow provisioning logic');
  assertNotIncludes(workflowSource, 'crm', 'Gateway lead workflow CRM automation');

  assertIncludes(readme, 'Gateway lead workflow polish added.', 'README gateway lead workflow note');
  assertIncludes(readme, 'Private internal notes only', 'README gateway lead private notes note');
  assertIncludes(readme, 'Manual follow-up tracking only', 'README gateway lead manual follow-up note');
  assertIncludes(readme, 'No reminders/notifications', 'README gateway lead no reminders note');
  assertIncludes(readme, 'No CRM/email/WhatsApp automation', 'README gateway lead no automation note');
  assertIncludes(readme, 'No payments/subscriptions/provisioning', 'README gateway lead no payments note');
}

function checkAdminSeparationAndDemoBranding() {
  const packageJson = read('package.json');
  const schema = read('prisma/schema.prisma');
  const readme = read('README.md');
  const rootPage = read('src/app/page.js');
  const adminShell = read('src/app/admin/components/AdminShell.jsx');
  const adminLayout = read('src/app/admin/layout.js');
  const platformShellPath = path.join(root, 'src/app/platform-admin/components/PlatformAdminShell.jsx');
  const platformLayoutPath = path.join(root, 'src/app/platform-admin/(protected)/layout.js');
  const platformIndexPath = path.join(root, 'src/app/platform-admin/(protected)/page.js');
  const platformLeadsPath = path.join(root, 'src/app/platform-admin/(protected)/leads/page.jsx');
  const oldGatewayLeadsPath = path.join(root, 'src/app/admin/(protected)/gateway-leads/page.jsx');
  const publicPagePath = path.join(root, 'src/app/public/page.js');
  const adminPagePath = path.join(root, 'src/app/admin/page.js');
  const restaurantProfile = read('src/lib/restaurant-profile.js');
  const strings = read('src/lib/strings.js');
  const collectionRoute = read('src/app/api/admin/gateway-leads/route.js');
  const itemRoute = read('src/app/api/admin/gateway-leads/[id]/route.js');
  const platformSource = [
    fs.existsSync(platformShellPath) ? read('src/app/platform-admin/components/PlatformAdminShell.jsx') : '',
    fs.existsSync(platformLayoutPath) ? read('src/app/platform-admin/(protected)/layout.js') : '',
    fs.existsSync(platformIndexPath) ? read('src/app/platform-admin/(protected)/page.js') : '',
    fs.existsSync(platformLeadsPath) ? read('src/app/platform-admin/(protected)/leads/page.jsx') : '',
  ].join('\n');
  const restaurantAdminSource = [adminShell, adminLayout].join('\n');
  const publicDemoSource = [restaurantProfile, strings, read('src/components/Header.jsx')].join('\n');

  assert(fs.existsSync(platformShellPath), 'Platform admin shell is missing');
  assert(fs.existsSync(platformLayoutPath), 'Platform admin protected layout is missing');
  assert(fs.existsSync(platformIndexPath), '/platform-admin page is missing');
  assert(fs.existsSync(platformLeadsPath), '/platform-admin/leads page is missing');
  assert(fs.existsSync(publicPagePath), '/public restaurant demo page is missing');
  assert(fs.existsSync(adminPagePath), '/admin restaurant admin entry page is missing');
  assert(fs.existsSync(oldGatewayLeadsPath), '/admin/gateway-leads redirect page is missing');

  assertIncludes(platformSource, 'PlatformAdminShell', 'Platform admin shell usage');
  assertIncludes(platformSource, 'Platform Dashboard', 'Platform dashboard navigation');
  assertIncludes(platformSource, 'Gateway Leads', 'Platform gateway leads navigation');
  assertIncludes(platformSource, 'Gateway Website', 'Platform gateway website placeholder navigation');
  assertIncludes(platformSource, 'Packages', 'Platform packages placeholder navigation');
  assertIncludes(platformSource, 'Client Restaurants', 'Platform client restaurants placeholder navigation');
  assertIncludes(platformSource, 'Platform Settings', 'Platform settings placeholder navigation');
  assertIncludes(platformSource, "admin.role !== 'ADMIN'", 'Platform admin ADMIN-only guard');
  assertIncludes(platformSource, 'This is the platform owner admin', 'Platform admin purpose copy');

  assertNotIncludes(adminShell, "href: '/admin/gateway-leads'", 'Restaurant admin gateway lead nav');
  assertNotIncludes(adminShell, "label: 'Gateway Leads'", 'Restaurant admin gateway lead nav label');
  assertNotIncludes(restaurantAdminSource, 'Al Dayaa Admin', 'Restaurant admin Al Dayaa admin branding');
  assertIncludes(restaurantAdminSource, 'Demo Restaurant Admin', 'Restaurant admin neutral shell branding');
  assertIncludes(adminShell, "label: 'Restaurant Settings'", 'Restaurant admin settings label');
  assertIncludes(adminShell, "label: 'Restaurant Admins'", 'Restaurant admin users label');
  assertIncludes(read('src/app/admin/(protected)/gateway-leads/page.jsx'), "redirect('/platform-admin/leads')", '/admin/gateway-leads redirect target');

  assertIncludes(publicDemoSource, 'Demo Restaurant', 'Public demo neutral default name');
  assertNotIncludes(publicDemoSource, 'Al Dayaa Al Shamiah Restaurant', 'Public demo Al Dayaa default name');
  assertIncludes(rootPage, '`/` is the platform/business gateway', 'Gateway architecture copy root');
  assertIncludes(rootPage, '`/public` is the demo restaurant website', 'Gateway architecture copy public');
  assertIncludes(rootPage, '`/admin` is the demo restaurant admin', 'Gateway architecture copy admin');
  assertIncludes(rootPage, '`/platform-admin` is the platform owner admin', 'Gateway architecture copy platform admin');
  assertIncludes(rootPage, 'Demo Restaurant is the live demo', 'Gateway neutral live demo copy');
  assertIncludes(rootPage, 'example packages', 'Gateway package placeholder copy retained');
  assertIncludes(rootPage, 'not final pricing', 'Gateway pricing placeholder copy retained');

  assertIncludes(collectionRoute, "await requireAdmin(request, ['ADMIN'])", 'Gateway lead collection ADMIN-only platform API');
  assertIncludes(itemRoute, "await requireAdmin(request, ['ADMIN'])", 'Gateway lead item ADMIN-only platform API');

  assert(!fs.existsSync(path.join(root, 'src/app/api/billing')), 'Admin separation should not add billing API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/payments')), 'Admin separation should not add payments API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/provisioning')), 'Admin separation should not add provisioning API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/crm')), 'Admin separation should not add CRM API route');
  assertOperationalTablesAreNotRestaurantScoped(schema, 'Admin separation operational tenant scope');
  assertNotIncludes(packageJson, '"stripe"', 'Admin separation Stripe dependency');
  assertNotIncludes(platformSource, 'sendMail', 'Platform admin email sending');
  assertNotIncludes(platformSource, 'nodemailer', 'Platform admin nodemailer usage');
  assertNotIncludes(platformSource, 'sendWhatsApp', 'Platform admin WhatsApp sending');
  assertNotIncludes(platformSource, 'provision', 'Platform admin provisioning logic');

  assertIncludes(readme, 'Platform admin and restaurant admin separation added.', 'README admin separation note');
  assertIncludes(readme, '`/platform-admin` is for gateway/business owner workflows', 'README platform admin note');
  assertIncludes(readme, '`/admin` is for restaurant/demo operations', 'README restaurant admin note');
  assertIncludes(readme, '`/public` remains the restaurant demo', 'README public demo note');
  assertIncludes(readme, 'No full multi-tenancy yet', 'README no full multi-tenancy note');
  assertIncludes(readme, 'No payments/subscriptions/provisioning yet', 'README no payments/provisioning note');
}

function checkDemoRestaurantProfileResetControls() {
  const packageJson = read('package.json');
  const schema = read('prisma/schema.prisma');
  const readme = read('README.md');
  const helper = read('src/lib/restaurant-profile.js');
  const platformShell = read('src/app/platform-admin/components/PlatformAdminShell.jsx');
  const pagePath = path.join(root, 'src/app/platform-admin/(protected)/demo-restaurant/page.jsx');
  const clientPath = path.join(root, 'src/app/platform-admin/(protected)/demo-restaurant/DemoRestaurantProfileClient.jsx');
  const resetRoutePath = path.join(root, 'src/app/api/platform/demo-profile/reset/route.js');
  const adminSettingsPath = path.join(root, 'src/app/admin/(protected)/settings/page.jsx');
  const publicPagePath = path.join(root, 'src/app/public/page.js');

  assert(fs.existsSync(pagePath), '/platform-admin/demo-restaurant page is missing');
  assert(fs.existsSync(clientPath), 'Demo profile reset client is missing');
  assert(fs.existsSync(resetRoutePath), 'Demo profile reset API route is missing');
  assert(fs.existsSync(adminSettingsPath), 'Restaurant admin settings page is missing');
  assert(fs.existsSync(publicPagePath), '/public restaurant demo page is missing');

  const page = read('src/app/platform-admin/(protected)/demo-restaurant/page.jsx');
  const client = read('src/app/platform-admin/(protected)/demo-restaurant/DemoRestaurantProfileClient.jsx');
  const resetRoute = read('src/app/api/platform/demo-profile/reset/route.js');
  const pageSource = [page, client].join('\n');
  const resetSource = [helper, page, client, resetRoute].join('\n');
  const strings = read('src/lib/strings.js');

  assertIncludes(helper, 'getNeutralDemoRestaurantProfile', 'Neutral demo profile helper');
  assertIncludes(helper, 'restaurantName: strings.restaurantName', 'Neutral demo restaurant name default');
  assertIncludes(strings, 'A configurable restaurant demo for modern digital operations', 'Neutral demo tagline default');
  assertIncludes(helper, 'https://example.com/demo-restaurant', 'Neutral demo social/link defaults');

  assertIncludes(platformShell, "href: '/platform-admin/demo-restaurant'", 'Platform demo restaurant nav href');
  assertIncludes(platformShell, "label: 'Demo Restaurant'", 'Platform demo restaurant nav label');

  assertIncludes(pageSource, 'Reset demo profile to neutral defaults', 'Demo profile reset button');
  assertIncludes(pageSource, 'reset will replace current demo profile settings with neutral demo defaults', 'Demo profile reset warning');
  assertIncludes(pageSource, 'enabledFeatures.length', 'Demo profile enabled feature count');
  assertIncludes(pageSource, 'View demo restaurant', 'Demo profile public link');
  assertIncludes(pageSource, 'href="/public"', 'Demo profile public href');
  assertIncludes(pageSource, 'Open restaurant admin settings', 'Demo profile admin settings link');
  assertIncludes(pageSource, 'href="/admin/settings"', 'Demo profile admin settings href');
  assertIncludes(pageSource, '/api/platform/demo-profile/reset', 'Demo profile reset API usage');
  assertIncludes(pageSource, 'confirm(', 'Demo profile reset confirmation');

  assertIncludes(resetRoute, "await requireAdmin(request, ['ADMIN'])", 'Demo profile reset ADMIN-only guard');
  assertIncludes(resetRoute, 'getNeutralDemoRestaurantProfile', 'Demo profile reset neutral defaults usage');
  assertIncludes(resetRoute, 'prisma.restaurantProfile.upsert', 'Demo profile reset singleton upsert');
  assertIncludes(resetRoute, 'enabledFeatures: existingProfile.enabledFeatures', 'Demo profile reset preserves enabledFeatures');
  assertIncludes(resetRoute, 'setRestaurantProfileCache', 'Demo profile reset cache refresh');
  assertIncludes(resetRoute, 'return success({ profile:', 'Demo profile reset normalized response');

  for (const unexpected of [
    'prisma.menu',
    'prisma.order',
    'prisma.inventory',
    'prisma.gatewayLead',
    'prisma.adminUser',
    'prisma.reservation',
    'deleteMany',
    'delete(',
  ]) {
    assertNotIncludes(resetRoute, unexpected, `Demo profile reset unrelated data mutation ${unexpected}`);
  }

  assert(!fs.existsSync(path.join(root, 'src/app/api/billing')), 'Demo profile reset should not add billing API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/payments')), 'Demo profile reset should not add payments API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/provisioning')), 'Demo profile reset should not add provisioning API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/crm')), 'Demo profile reset should not add CRM API route');
  assertOperationalTablesAreNotRestaurantScoped(schema, 'Demo profile reset operational tenant scope');
  assertNotIncludes(packageJson, '"stripe"', 'Demo profile reset Stripe dependency');
  assertNotIncludes(resetSource, 'sendMail', 'Demo profile reset email sending');
  assertNotIncludes(resetSource, 'nodemailer', 'Demo profile reset nodemailer usage');
  assertNotIncludes(resetSource, 'sendWhatsApp', 'Demo profile reset WhatsApp sending');
  assertNotIncludes(resetSource, 'provision', 'Demo profile reset provisioning logic');

  assertIncludes(readme, 'Demo restaurant profile reset controls added.', 'README demo profile reset note');
  assertIncludes(readme, 'Platform owner can reset demo profile branding/contact values', 'README demo profile reset owner note');
  assertIncludes(readme, 'Restaurant feature flags are preserved', 'README demo profile reset feature flag note');
  assertIncludes(readme, 'No multi-tenancy/provisioning/payments yet', 'README demo profile reset scope note');
}

function checkPlatformDashboardPolish() {
  const packageJson = read('package.json');
  const schema = read('prisma/schema.prisma');
  const readme = read('README.md');
  const pagePath = path.join(root, 'src/app/platform-admin/(protected)/page.js');
  const layout = read('src/app/platform-admin/(protected)/layout.js');

  assert(fs.existsSync(pagePath), '/platform-admin dashboard page is missing');
  const dashboard = read('src/app/platform-admin/(protected)/page.js');

  assertIncludes(dashboard, 'prisma.gatewayLead.groupBy', 'Platform dashboard GatewayLead count read');
  assertIncludes(dashboard, 'prisma.gatewayLead.findMany', 'Platform dashboard recent GatewayLead read');
  assertIncludes(dashboard, 'take: 5', 'Platform dashboard recent lead limit');
  assertIncludes(dashboard, "orderBy: { createdAt: 'desc' }", 'Platform dashboard recent lead ordering');
  assertIncludes(dashboard, 'getRestaurantProfile', 'Platform dashboard demo profile read');
  assertIncludes(dashboard, 'normalizeGatewayLead', 'Platform dashboard safe recent lead normalization');

  for (const label of [
    'Total gateway leads',
    'New leads',
    'Contacted leads',
    'Qualified leads',
    'Archived leads',
    'Demo profile status',
    'Enabled demo modules',
    'Recent gateway leads',
    'No gateway leads yet',
    'submit a lead from the gateway form',
  ]) {
    assertIncludes(dashboard, label, `Platform dashboard copy ${label}`);
  }

  assertIncludes(dashboard, 'enabledFeatures.length', 'Platform dashboard enabled module count');
  assertIncludes(dashboard, 'href="/platform-admin/leads"', 'Platform dashboard Gateway Leads link');
  assertIncludes(dashboard, "href: '/platform-admin/demo-restaurant'", 'Platform dashboard demo profile link');
  assertIncludes(dashboard, "href: '/public'", 'Platform dashboard demo restaurant link');
  assertIncludes(dashboard, "href: '/admin'", 'Platform dashboard restaurant admin link');
  assertIncludes(dashboard, "href: '/'", 'Platform dashboard public gateway link');
  assertIncludes(dashboard, 'View gateway leads', 'Platform dashboard view leads action');
  assertIncludes(dashboard, 'Open demo restaurant', 'Platform dashboard demo restaurant action');
  assertIncludes(dashboard, 'Reset demo profile', 'Platform dashboard reset demo action');
  assertIncludes(dashboard, 'Open restaurant admin', 'Platform dashboard restaurant admin action');
  assertIncludes(dashboard, 'View public gateway', 'Platform dashboard public gateway action');
  assertIncludes(layout, "admin.role !== 'ADMIN'", 'Platform admin remains ADMIN-only');

  const dashboardSource = [dashboard, layout].join('\n');
  assert(!fs.existsSync(path.join(root, 'src/app/api/billing')), 'Platform dashboard should not add billing API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/payments')), 'Platform dashboard should not add payments API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/provisioning')), 'Platform dashboard should not add provisioning API route');
  assert(!fs.existsSync(path.join(root, 'src/app/api/crm')), 'Platform dashboard should not add CRM API route');
  assertOperationalTablesAreNotRestaurantScoped(schema, 'Platform dashboard operational tenant scope');
  assertNotIncludes(packageJson, '"stripe"', 'Platform dashboard Stripe dependency');
  assertNotIncludes(dashboardSource, 'sendMail', 'Platform dashboard email sending');
  assertNotIncludes(dashboardSource, 'nodemailer', 'Platform dashboard nodemailer usage');
  assertNotIncludes(dashboardSource, 'sendWhatsApp', 'Platform dashboard WhatsApp sending');
  assertNotIncludes(dashboardSource, 'subscription', 'Platform dashboard subscription logic');
  assertNotIncludes(dashboardSource, 'payment', 'Platform dashboard payment logic');
  assertNotIncludes(dashboardSource, 'provision', 'Platform dashboard provisioning logic');
  assertNotIncludes(dashboardSource, 'crm', 'Platform dashboard CRM automation');

  assertIncludes(readme, 'Platform dashboard polish added.', 'README platform dashboard polish note');
  assertIncludes(readme, 'Dashboard summarizes gateway leads and demo profile', 'README platform dashboard summary note');
  assertIncludes(readme, 'No billing/provisioning/CRM automation yet', 'README platform dashboard scope note');
}

function checkRestaurantProfileFoundation() {
  const schema = read('prisma/schema.prisma');
  const helper = read('src/lib/restaurant-profile.js');
  const apiRoute = read('src/app/api/admin/restaurant-profile/route.js');

  assertIncludes(schema, 'model RestaurantProfile', 'RestaurantProfile Prisma model');
  assertIncludes(schema, 'enabledFeatures', 'RestaurantProfile enabledFeatures field');
  assertIncludes(helper, 'getRestaurantProfile', 'Restaurant profile helper');
  assertIncludes(helper, 'restaurantProfile.findFirst', 'Restaurant profile tenant read lookup');
  assertNotIncludes(helper, 'restaurantProfile.upsert', 'Restaurant profile helper normal read path');
  assertIncludes(helper, 'ensureRestaurantProfile', 'Restaurant profile controlled default creation helper');
  assertIncludes(helper, 'pendingProfileLoad', 'Restaurant profile concurrent read guard');
  assertIncludes(helper, 'pendingDefaultProfileCreate', 'Restaurant profile concurrent create guard');
  assertIncludes(helper, 'fallbackOnError = true', 'Restaurant profile public fallback option');
  assertIncludes(helper, 'return normalizeRestaurantProfile();', 'Restaurant profile default fallback behavior');
  assertIncludes(apiRoute, "await requireAdmin(request, ['ADMIN'", 'Restaurant profile admin API auth');
  assertIncludes(apiRoute, 'getRestaurantProfile({ fallbackOnError: false })', 'Restaurant profile admin API surfaces load errors');
  assertIncludes(apiRoute, 'prisma.restaurantProfile.upsert', 'Restaurant profile admin update persistence');
  assertIncludes(apiRoute, 'setRestaurantProfileCache', 'Restaurant profile admin update cache refresh');
  assertIncludes(apiRoute, 'profileSchema.safeParse', 'Restaurant profile API validation');

  const adminProfileGuardRoutes = [
    ['src/app/api/admin/inventory/items/route.js', 'Inventory items API'],
    ['src/app/api/admin/inventory/items/[id]/route.js', 'Inventory item API'],
    ['src/app/api/admin/inventory/movements/route.js', 'Inventory movements API'],
    ['src/app/api/admin/kitchen/orders/route.js', 'Kitchen orders API'],
    ['src/app/api/admin/orders/assisted/route.js', 'Assisted orders API'],
    ['src/app/api/admin/orders/[id]/apply-recipe-consumption/route.js', 'Recipe consumption apply API'],
    ['src/app/api/admin/orders/[id]/recipe-consumption-preview/route.js', 'Recipe consumption preview API'],
    ['src/app/api/admin/recipes/ingredients/route.js', 'Recipe ingredients API'],
    ['src/app/api/admin/recipes/ingredients/[id]/route.js', 'Recipe ingredient API'],
    ['src/app/api/admin/recipes/menu-items/route.js', 'Recipe menu-items API'],
  ];

  for (const [routePath, label] of adminProfileGuardRoutes) {
    assertIncludes(read(routePath), 'getRestaurantProfile({ fallbackOnError: false })', `${label} profile errors surface`);
  }
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
  const restaurantTableBlock = getModelBlock(schema, 'RestaurantTable');

  assertIncludes(schema, 'model RestaurantTable', 'RestaurantTable Prisma model');
  assertIncludes(restaurantTableBlock, 'slug', 'RestaurantTable slug field');
  assertIncludes(restaurantTableBlock, 'qrToken', 'RestaurantTable QR token field');
  assertIncludes(restaurantTableBlock, '@unique', 'RestaurantTable unique slug/QR token markers');
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
  assertIncludes(ingredientsRoute, 'prisma.menuItem.findFirst', 'Recipe ingredient menu item existence check');
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
  assertNotIncludes(helper, 'linesByKey', 'Recipe consumption dry-run mapped line aggregation map');

  assert(fs.existsSync(routePath), 'Recipe consumption preview API route is missing');
  const route = read('src/app/api/admin/orders/[id]/recipe-consumption-preview/route.js');

  assertIncludes(route, "await requireAdmin(request, ['ADMIN', 'MANAGER', 'SUPPORT'])", 'Recipe preview API role guard');
  assertIncludes(route, 'FEATURE_KEYS.RECIPE_CONSUMPTION', 'Recipe preview API feature key');
  assertIncludes(route, 'getRestaurantProfile', 'Recipe preview API profile loading');
  assertIncludes(route, 'requireFeatureEnabled', 'Recipe preview API feature enforcement');
  assertIncludes(route, 'prisma.order.findFirst', 'Recipe preview API order lookup');
  assertIncludes(route, 'items: { where: getDemoRestaurantFilter() }', 'Recipe preview API order items include');
  assertIncludes(route, 'item.menuItemId || item.itemId', 'Recipe preview API historical itemId fallback');
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

function checkManualRecipeConsumptionApply() {
  const schema = read('prisma/schema.prisma');
  const applyRoutePath = path.join(root, 'src/app/api/admin/orders/[id]/apply-recipe-consumption/route.js');
  const previewRoute = read('src/app/api/admin/orders/[id]/recipe-consumption-preview/route.js');
  const ordersClient = read('src/app/admin/(protected)/orders/OrdersClient.jsx');
  const orderRoute = read('src/app/api/orders/route.js');
  const readme = read('README.md');

  assertIncludes(schema, 'model OrderRecipeConsumption', 'OrderRecipeConsumption Prisma model');
  assertIncludes(schema, 'recipeConsumptions', 'Order recipe consumption relation field');
  assertIncludes(schema, 'OrderRecipeConsumption[]', 'Order recipe consumption relation type');
  assertIncludes(schema, 'appliedByAdminId', 'OrderRecipeConsumption admin id audit field');
  assertIncludes(schema, 'appliedByAdminEmail', 'OrderRecipeConsumption admin email audit field');
  assertIncludes(schema, '@@index([orderId])', 'OrderRecipeConsumption order index');
  assertIncludes(schema, '@@index([createdAt])', 'OrderRecipeConsumption createdAt index');

  assert(fs.existsSync(applyRoutePath), 'Apply recipe consumption API route is missing');
  const applyRoute = read('src/app/api/admin/orders/[id]/apply-recipe-consumption/route.js');
  assertIncludes(applyRoute, "await requireAdmin(request, ['ADMIN', 'MANAGER'])", 'Apply recipe consumption role guard');
  assertIncludes(applyRoute, 'FEATURE_KEYS.RECIPE_CONSUMPTION', 'Apply recipe consumption recipe feature guard');
  assertIncludes(applyRoute, 'FEATURE_KEYS.INVENTORY', 'Apply recipe consumption inventory feature guard');
  assertIncludes(applyRoute, 'requireFeatureEnabled', 'Apply recipe consumption feature enforcement');
  assertIncludes(applyRoute, 'orderRecipeConsumption.findFirst', 'Apply recipe consumption duplicate check');
  assertIncludes(applyRoute, 'Recipe consumption has already been applied', 'Apply recipe consumption duplicate error');
  assertIncludes(applyRoute, 'hasMissingMappings', 'Apply recipe consumption missing mapping check');
  assertIncludes(applyRoute, 'Recipe mappings are incomplete', 'Apply recipe consumption incomplete mapping error');
  assertIncludes(applyRoute, 'prisma.$transaction(async', 'Apply recipe consumption interactive transaction');
  assertIncludes(applyRoute, 'tx.inventoryItem.findMany', 'Apply recipe consumption transaction inventory reread');
  assertIncludes(applyRoute, 'tx.inventoryItem.updateMany', 'Apply recipe consumption atomic stock update');
  assertIncludes(applyRoute, 'currentStock: { gte: requiredQuantity }', 'Apply recipe consumption stock floor update guard');
  assertIncludes(applyRoute, 'currentStock: { decrement: requiredQuantity }', 'Apply recipe consumption atomic stock decrement');
  assertIncludes(applyRoute, 'updateResult.count !== 1', 'Apply recipe consumption atomic update count guard');
  assertNotIncludes(applyRoute, 'data: { currentStock: resultingStock }', 'Apply recipe consumption stale absolute stock write');
  assertIncludes(applyRoute, 'tx.inventoryMovement.create', 'Apply recipe consumption movement creation');
  assertIncludes(applyRoute, 'INVENTORY_MOVEMENT_TYPES.STOCK_OUT', 'Apply recipe consumption STOCK_OUT movement type');
  assertIncludes(applyRoute, 'ORDER_RECIPE_CONSUMPTION', 'Apply recipe consumption movement source');
  assertIncludes(applyRoute, 'tx.inventoryItem.update', 'Apply recipe consumption inventory stock update');
  assertIncludes(applyRoute, 'tx.orderRecipeConsumption.create', 'Apply recipe consumption audit log creation');

  assertNotIncludes(previewRoute, 'inventoryMovement.create', 'Recipe preview API inventory movement creation');
  assertNotIncludes(previewRoute, 'inventoryItem.update', 'Recipe preview API inventory stock update');
  assertIncludes(ordersClient, 'Apply recipe consumption', 'Admin orders UI apply recipe consumption button');
  assertIncludes(ordersClient, 'This will deduct inventory stock.', 'Admin orders UI apply warning copy');
  assertIncludes(ordersClient, 'apply-recipe-consumption', 'Admin orders UI apply API usage');
  assertNotIncludes(orderRoute, 'OrderRecipeConsumption', 'Customer order route automatic recipe consumption log');
  assertNotIncludes(orderRoute, 'inventoryMovement.create', 'Customer order route automatic inventory movement creation');
  assertNotIncludes(orderRoute, 'MenuItemIngredient', 'Customer order route automatic recipe mapping usage');

  assertIncludes(readme, 'Manual recipe consumption application added.', 'README manual recipe consumption note');
  assertIncludes(readme, 'manual/admin-triggered only', 'README manual deduction limitation');
  assertIncludes(readme, 'no automatic deduction on status change', 'README status change limitation');
  assertIncludes(readme, 'no supplier automation', 'README manual recipe supplier limitation');
}

const checks = [
  checkOrderHardening,
  checkReservationCancellationHardening,
  checkAdminUserHardening,
  checkEnvExample,
  checkBusinessGatewayFoundation,
  checkGatewayLeadFormUxPolish,
  checkGatewayPackagePricingPolish,
  checkProductionRouteQaVerification,
  checkPlatformPlaceholderPagePolish,
  checkMultitenantArchitecturePlan,
  checkRestaurantTenantAnchorModel,
  checkRestaurantIdContentConfigBackfill,
  checkRestaurantIdOperationalBackfill,
  checkRestaurantContextHelper,
  checkPublicDemoReadTenantScoping,
  checkRestaurantAdminDemoOperationTenantScoping,
  checkPublicDemoWriteTenantScoping,
  checkTenantPublicRouteAlias,
  checkPlatformClientRestaurantRegistry,
  checkPlatformClientRestaurantCreate,
  checkTenantSafeProfileSettingsSchema,
  checkTenantStarterContentProvisioning,
  checkRestaurantStaffAuthSchemaBoundary,
  checkTenantMenuGalleryAdmin,
  checkTenantProfileSettingsAdmin,
  checkTenantStaffManagementFoundation,
  checkTenantReservationsManagement,
  checkTenantTableManagementFoundation,
  checkTenantOrderApiBoundaryFoundation,
  checkTenantKitchenQueueOperations,
  checkTenantInventoryManagementFoundation,
  checkGatewayLeadAdminManagement,
  checkGatewayLeadWorkflowPolish,
  checkAdminSeparationAndDemoBranding,
  checkDemoRestaurantProfileResetControls,
  checkPlatformDashboardPolish,
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
  checkManualRecipeConsumptionApply,
];

for (const check of checks) {
  check();
}

console.log(`Smoke hardening checks passed (${checks.length} groups).`);
