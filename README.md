# RestaurantOps Gateway Demo

Production-ready Next.js (App Router) restaurant automation demo with Tailwind CSS, Prisma + PostgreSQL, a public business gateway, a restaurant demo, and separated admin areas.

## Getting Started

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Environment variables**
   Create `.env` from `.env.example` and fill in deployment-specific values. Secrets must never be committed.

3. **Prisma**
   ```bash
   npx prisma generate
   npx prisma db push
   npx prisma db seed
   ```

4. **Run dev server**
   ```bash
   npm run dev
   ```

5. **Verify locally**
   ```bash
   npm run lint
   npm run smoke:hardening
   ```

## Features

- Business gateway foundation at `/` for the restaurant automation product.
- Public demo restaurant pages for home, menu, reservations, ordering, gallery, about, and contact.
- Menu, orders, reservations, gallery, settings, announcements, and WhatsApp integration.
- Restaurant admin dashboard at `/admin/login` for demo restaurant operational management.
- Role-based admin access with ADMIN, MANAGER, and SUPPORT roles.
- Responsive Tailwind UI with Prisma-backed API routes.
- Non-interactive Next.js linting and a focused production-hardening smoke check.
- Restaurant profile/config foundation for one restaurant profile, with admin API support.

## Business Gateway Foundation

- Business gateway foundation added at `/`.
- `/public` remains the live demo restaurant website.
- Gateway leads can be submitted through a small DB-backed request form.
- No payments, subscriptions, automatic restaurant provisioning, or multi-tenant database model has been added yet.
- Gateway lead admin management added.
- ADMIN users can view, search, filter, and update gateway lead status under `/platform-admin/leads`.
- Gateway lead form UX polish and anti-spam foundation added.
- Honeypot only; no captcha or third-party anti-spam service has been added.
- Gateway lead workflow polish added.
- Private internal notes only.
- Manual follow-up tracking only.
- No reminders/notifications.
- No CRM/email/WhatsApp automation.
- No payments/subscriptions/provisioning.
- No CRM automation yet.
- No email/WhatsApp sending yet.
- No subscription/payment logic yet.
- No automatic restaurant provisioning yet.
- No payments/subscriptions/provisioning yet.
- Platform admin and restaurant admin separation added.
- `/platform-admin` is for gateway/business owner workflows.
- `/admin` is for restaurant/demo operations.
- `/public` remains the restaurant demo.
- No full multi-tenancy yet.
- No payments/subscriptions/provisioning yet.
- Demo restaurant profile reset controls added.
- Platform owner can reset demo profile branding/contact values.
- Restaurant feature flags are preserved.
- No multi-tenancy/provisioning/payments yet.
- Platform dashboard polish added.
- Dashboard summarizes gateway leads and demo profile.
- No billing/provisioning/CRM automation yet.
- Gateway package/pricing presentation polish added.
- Packages are presentation/lead-capture only.
- No payment/subscription/billing logic yet.
- No automatic provisioning yet.
- Production route QA smoke coverage added.
- Source/runtime verification hardening only.
- No new product feature.
- No billing/provisioning/multi-tenancy.
- Platform placeholder pages polished.
- Roadmap placeholders only.
- No DB models/billing/provisioning/multi-tenancy added.
- Multi-tenant architecture planning document added.
- Batch 32 was planning only.
- At that step, no schema/runtime changes were made.
- Multi-tenancy was not implemented in Batch 32.
- Restaurant tenant anchor model added.
- Demo Restaurant seed exists.
- Existing restaurant operations are not tenant-scoped yet.
- No provisioning or multi-tenant routing yet.
- Nullable restaurantId added to content/config tables.
- Existing rows are backfilled to Demo Restaurant.
- Runtime queries are not tenant-scoped yet.
- Operational transaction tables are not scoped yet.
- restaurantId is not required yet.
- Nullable restaurantId added to operational tables.
- Existing operational rows are backfilled to Demo Restaurant.
- Runtime queries are still not tenant-scoped.
- AdminUser and GatewayLead are not scoped yet.
- Operational restaurantId is not required yet.
- Restaurant context helper added.
- Helper resolves Demo Restaurant tenant identity.
- Runtime route behavior is not broadly tenant-scoped yet.
- No client restaurant provisioning yet.
- Public demo reads are tenant-scoped to Demo Restaurant.
- Public demo read scoping keeps current routes unchanged.
- Current routes are unchanged.
- Null restaurantId fallback is transitional.
- Restaurant admin demo operations are tenant-scoped to Demo Restaurant.
- Current URLs are unchanged.
- Transitional null restaurantId fallback remains.
- New restaurant-owned admin records write restaurantId = demo-restaurant.
- AdminUser and GatewayLead remain platform/global for now.
- Public demo writes are tenant-scoped to Demo Restaurant.
- Public orders and reservations now write restaurantId = demo-restaurant.
- Current URLs are unchanged.
- AdminUser and GatewayLead remain global/platform-owned.
- No client restaurant provisioning yet.
- Tenant-style public route alias added.
- `/r/demo-restaurant` works as a tenant-style alias.
- `/public` remains the demo shortcut.
- Only the Demo Restaurant slug is supported for now.
- No provisioning/custom domains yet.
- Platform client restaurant registry added.
- Backed by the Restaurant table.
- Shows the Demo Restaurant tenant anchor.
- Links to the tenant public route.
- No billing/subscriptions/custom domains yet.
- Platform client restaurant tenant creation added.
- Creates only Restaurant tenant anchor records.
- No full provisioning yet.
- No profile/settings/menu/admin user creation yet.
- Non-demo public routes are not active yet.
- No billing/subscriptions/custom domains yet.
- Client restaurant profile/settings initialization blocked by singleton RestaurantProfile schema.
- Next safe step is a schema migration that makes RestaurantProfile and RestaurantSettings tenant-safe.
- RestaurantProfile/RestaurantSettings tenant-safe schema migration added.
- Profile/settings id defaults no longer use singleton constants.
- One profile/settings row per restaurant is now possible.
- Client restaurant profile/settings initialization added.
- Creates only missing RestaurantProfile and RestaurantSettings rows.
- No full provisioning/menu/admin user/order activation yet.
- Initialized tenant public reads activated.
- `/r/[slug]` works after profile/settings initialization.
- Non-demo tenants use their own profile/settings.
- Menu/gallery/order content still require later provisioning.
- `/public` remains the Demo Restaurant shortcut.
- No custom domains/billing/provisioning yet.
- Initialized tenants can now receive starter menu/gallery content.
- Starter content is platform-admin provisioned.
- Tenant public menu/gallery pages read tenant-scoped content.
- Ordering, billing, custom domains, and broader tenant staff management are still future work.
- Restaurant staff auth schema boundary added.
- RestaurantUser is separate from platform AdminUser.
- Tenant first-owner provisioning and restaurant staff login added.
- Platform ADMIN can create the first OWNER RestaurantUser for initialized non-demo tenants.
- Tenant staff login uses `/r/[restaurantSlug]/admin/login` and `/api/restaurant-admin/login`.
- Staff sessions use `aldayaa_restaurant_staff`, not `aldayaa_admin`, and cannot access `/platform-admin`.
- Restaurant staff access now includes tenant-scoped menu/gallery management; orders, reservations, settings, inventory, recipes, staff management, billing, domains, email, and WhatsApp automation remain future work.
- Tenant menu/gallery admin added.
- Restaurant staff can manage tenant-scoped menu categories, menu items, gallery categories, and photos under `/r/[restaurantSlug]/admin`.
- OWNER and MANAGER can write; SUPPORT is read-only.
- Orders, reservations, settings, inventory, recipes, broader staff management, billing, domains, email, and WhatsApp automation remain future work.

## Feature Modules Foundation

- `src/lib/features.js` defines stable module keys, labels, categories, and helper functions for future package logic.
- `RestaurantProfile.enabledFeatures` stores enabled module keys as JSON text for the single restaurant profile.
- This is a foundation for future subscription packages and module gating. It does not add billing, SaaS gateway, inventory, payroll, AI ordering, or tenant logic yet.

## QR/Table Ordering Foundation

- `RestaurantTable` supports QR-ready table labels, slugs, tokens, zones, seats, active status, and notes.
- Admin users can manage tables under `/admin/tables`; SUPPORT users can view links in read-only mode.
- Public QR links use `/public/table/[slug]` and hand off to `/public/order?table=...`.
- Table order context can now be persisted on orders for admin visibility.
- Table-order UX and admin visibility refined for clearer customer checkout and easier order scanning.
- This is a foundation only. It does not add full waiter-assisted ordering, POS behavior, kitchen workflow, payments, inventory, or dine-in order records yet.

## Waiter-Assisted Ordering Foundation

- Waiter-assisted ordering foundation added for ADMIN/MANAGER staff order entry from the admin area.
- Staff-created orders use the same server-side menu pricing snapshots as customer orders and can optionally include table context.
- This is not full POS, kitchen display, payment processing, inventory, payroll, AI ordering, or advanced staff shift logic.

## Order Status Workflow

- Order status workflow helpers added.
- Admin order updates now use a small centralized status transition rule set for NEW, IN_PROGRESS, COMPLETED, and CANCELLED.
- This is still not a kitchen display or POS workflow.

## Kitchen Queue Foundation

- Kitchen queue foundation added. ADMIN/MANAGER staff can review active NEW and IN_PROGRESS orders.
- The queue reuses the existing order status workflow and excludes completed/cancelled orders.
- This is not a full kitchen display, POS, printing, or realtime system yet.

## Module Access Polish

- Module disabled-state UX added for admin features.
- Disabled table QR ordering, waiter-assisted ordering, and kitchen queue modules now show clearer admin states instead of relying only on API failures.
- No billing or subscription system has been added.

## Inventory Foundation

- Inventory foundation added.
- This module is disabled by default for operations setup.
- ADMIN/MANAGER users can create stock items and record manual stock movements when the module is enabled; SUPPORT users can view inventory data.
- No recipe consumption, no automatic stock deduction, and no supplier request automation has been added yet.
- Inventory low-stock UX and filters added.
- Still no recipe consumption, automatic deduction, or supplier automation has been added.
- Inventory unit/category polish added.
- No recipe consumption or automatic deduction has been added.

## Recipe Mapping Foundation

- Recipe ingredient mapping foundation added.
- ADMIN/MANAGER users can map menu items to inventory items when the recipe consumption module is enabled; SUPPORT users can view mappings.
- No automatic inventory deduction, no supplier automation, and no costing analytics have been added yet.
- Recipe mapping UX and coverage summary added.
- No automatic deduction, no supplier automation, and no costing analytics have been added yet.
- Recipe consumption dry-run added.
- No automatic stock deduction, no inventory movement creation, and no supplier automation has been added yet.
- Manual recipe consumption application added.
- Deduction is manual/admin-triggered only; there is no automatic deduction on status change and no supplier automation.

## Production Notes

- Rotate leaked credentials immediately if this repo history contained secrets.
- Use a strong `ADMIN_JWT_SECRET` with at least 32 random characters.
- Use a separate strong `RESTAURANT_STAFF_JWT_SECRET` for restaurant staff sessions.
- Use a PostgreSQL `DATABASE_URL`.
- Run `npx prisma generate` and either `npx prisma db push` or your migration workflow before deployment.
- Configure WhatsApp only through environment variables.
- Do not commit real secrets, API keys, database URLs, or production passwords.

## Admin System

- Admin area lives under `src/app/admin` with route groups for authentication and protected pages. Shared UI lives in `src/app/admin/components`.
- Role-based access:
  - **ADMIN**: full control including managing other admin users.
  - **MANAGER**: manage menu, gallery, orders, and reservations, without admin user creation.
  - **SUPPORT**: read-only access to data.
- All admin API routes return a consistent `{ success, data, error }` shape. Validation uses Zod and RBAC checks via `requireAdmin`.
- CRUD coverage includes menu categories/items, gallery categories/photos, orders, reservations, settings, and admin users.
