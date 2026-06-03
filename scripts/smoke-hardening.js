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
  assert(!/model\s+Restaurant\s*\{/.test(schema), 'Multi-tenant Restaurant model should not exist yet');
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
  assert(!/model\s+Restaurant\s*\{/.test(schema), 'Gateway lead polish should not add multi-tenant Restaurant model');
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
  assert(!/model\s+Restaurant\s*\{/.test(schema), 'Gateway package pricing should not add multi-tenant Restaurant model');
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
  assert(!/model\s+Restaurant\s*\{/.test(schema), 'Production route QA should not add multi-tenant Restaurant model');
  assertNotIncludes(routeQaSource, 'stripe.checkout', 'Production route QA checkout logic');
  assertNotIncludes(routeQaSource, 'createRestaurant', 'Production route QA provisioning logic');
  assertNotIncludes(routeQaSource, 'sendMail', 'Production route QA email sending');
  assertNotIncludes(routeQaSource, 'sendWhatsApp', 'Production route QA WhatsApp sending');

  assertIncludes(readme, 'Production route QA smoke coverage added.', 'README production route QA note');
  assertIncludes(readme, 'Source/runtime verification hardening only', 'README production route QA verification-only note');
  assertIncludes(readme, 'No new product feature', 'README production route QA no feature note');
  assertIncludes(readme, 'No billing/provisioning/multi-tenancy', 'README production route QA scope note');
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
  assert(!/model\s+Restaurant\s*\{/.test(schema), 'Gateway lead admin should not add multi-tenant Restaurant model');
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
  assert(!/model\s+Restaurant\s*\{/.test(schema), 'Gateway lead workflow should not add multi-tenant Restaurant model');
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
  assert(!/model\s+Restaurant\s*\{/.test(schema), 'Admin separation should not add multi-tenant Restaurant model');
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
  assert(!/model\s+Restaurant\s*\{/.test(schema), 'Demo profile reset should not add multi-tenant Restaurant model');
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
  assert(!/model\s+Restaurant\s*\{/.test(schema), 'Platform dashboard should not add multi-tenant Restaurant model');
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
  assertIncludes(helper, 'restaurantProfile.findUnique', 'Restaurant profile read-first lookup');
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
  assertNotIncludes(helper, 'linesByKey', 'Recipe consumption dry-run mapped line aggregation map');

  assert(fs.existsSync(routePath), 'Recipe consumption preview API route is missing');
  const route = read('src/app/api/admin/orders/[id]/recipe-consumption-preview/route.js');

  assertIncludes(route, "await requireAdmin(request, ['ADMIN', 'MANAGER', 'SUPPORT'])", 'Recipe preview API role guard');
  assertIncludes(route, 'FEATURE_KEYS.RECIPE_CONSUMPTION', 'Recipe preview API feature key');
  assertIncludes(route, 'getRestaurantProfile', 'Recipe preview API profile loading');
  assertIncludes(route, 'requireFeatureEnabled', 'Recipe preview API feature enforcement');
  assertIncludes(route, 'prisma.order.findUnique', 'Recipe preview API order lookup');
  assertIncludes(route, 'items: true', 'Recipe preview API order items include');
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
