# Multi-Tenant Architecture Plan

This document is planning only. It describes how the current platform plus single demo restaurant can become a true multi-tenant restaurant SaaS system in later batches. Do not implement in this batch.

## Current state summary

The app currently has four clear product surfaces:

- `/` is the public business gateway for the restaurant automation platform.
- `/public` is the demo restaurant website.
- `/admin` is the demo restaurant operations admin.
- `/platform-admin` is the platform owner admin.

The platform admin and restaurant admin are already separated at the route and shell level. Platform admin is protected by the existing `ADMIN` role in `src/app/platform-admin/(protected)/layout.js`. Restaurant admin continues to use the existing admin session and restaurant roles through `src/app/admin/(protected)/layout.js` and `src/lib/auth.js`.

The data model is still a single-demo restaurant architecture. `RestaurantProfile` is a singleton with `id = 1`, and `RestaurantSettings` is also a singleton with `id = 1`. Restaurant operations tables are not scoped to a tenant. Public restaurant pages and APIs read directly from global tables such as `MenuItem`, `Reservation`, `Order`, `RestaurantTable`, `InventoryItem`, and `Announcement`.

Gateway leads are already platform-owned. `GatewayLead` represents restaurant prospects submitted from the business gateway and is managed under `/platform-admin/leads`. It should remain platform data, not restaurant tenant data.

## Target architecture

The target architecture should introduce an explicit tenant boundary while preserving the demo experience and avoiding a risky all-at-once rewrite.

Recommended future models:

- `Restaurant`: the tenant/client restaurant record. Suggested fields include `id`, `slug`, `name`, `status`, `timezone`, `locale`, `currency`, `createdAt`, and `updatedAt`.
- `RestaurantProfile`: move from singleton to restaurant-owned profile data with `restaurantId`. It should keep configurable branding/contact fields and become unique per restaurant.
- `RestaurantSettings`: restaurant-owned operational settings, including working hours and cancellation settings.
- `RestaurantUser` or `RestaurantMembership`: scoped relationship between a user identity and a restaurant role. This avoids using one global `AdminUser.role` for every restaurant.
- `PlatformUser` or platform-scoped use of `AdminUser`: platform owner accounts should stay distinct from restaurant staff accounts.
- `RestaurantFeature` or `RestaurantModuleSetting`: restaurant-specific enabled modules such as website, menu, reservations, ordering, QR table ordering, inventory, and recipe consumption.
- `RestaurantDomain`: optional domain and subdomain mapping with `restaurantId`, `hostname`, `isPrimary`, `status`, `createdAt`, and `updatedAt`.
- `Plan`, `Package`, `Subscription`, and billing-related records later. These are future platform concerns and should not be implemented until tenant scoping is safe.

The most important design rule is that every restaurant-owned query must include a restaurant context. Platform-owned data can remain global, but restaurant operations must never be fetched only by public ids once multiple tenants exist.

## Route strategy

There are several viable route strategies.

### Option 1: `/r/[restaurantSlug]`

Pros:

- Smallest routing change for a first multi-tenant public surface.
- Keeps `/public` as the stable demo restaurant route.
- Easy to test locally and on Vercel without wildcard domains.
- Makes tenant context explicit in code and URLs.

Cons:

- Less branded than client subdomains or custom domains.
- Admin route strategy still needs a decision.

### Option 2: `/restaurants/[restaurantSlug]`

Pros:

- Very explicit and readable.
- Avoids short ambiguous route names.

Cons:

- Longer customer-facing URL.
- Feels more like an internal listing than a restaurant website URL.

### Option 3: Subdomains such as `[restaurant].domain.com`

Pros:

- Strongest SaaS/customer-facing shape.
- Better for real client branding.

Cons:

- Requires wildcard domain and deployment configuration.
- More complex local development and preview behavior.
- Needs careful host parsing, canonical redirects, and domain ownership checks.

### Option 4: Keep `/public` as the only restaurant route

Pros:

- No immediate route churn.
- Demo remains stable.

Cons:

- Cannot serve multiple restaurants by itself.
- Encourages continuing the singleton restaurant assumption.

Recommended first route strategy:

Keep `/public` as the demo restaurant route and introduce `/r/[restaurantSlug]` when restaurant-scoped reads are ready. This gives the team an explicit tenant path without requiring subdomain infrastructure. Subdomains and custom domains can be layered on after slug routing, data scoping, and access control are proven.

For admin routes, keep `/admin` as the demo restaurant admin during the transition. Later, introduce a tenant-aware admin context such as `/r/[restaurantSlug]/admin` or an admin restaurant selector after scoped memberships exist. Do not overload `/platform-admin`; it should remain platform owner only.

## Data ownership mapping

The following existing models need restaurant scoping before true multi-tenancy:

- `RestaurantProfile`: belongs to one `Restaurant`. Replace singleton lookup with `restaurantId` lookup after migration.
- `RestaurantSettings`: belongs to one `Restaurant`. Working hours and cancellation rules should be restaurant-specific.
- `MenuCategory`: belongs to one `Restaurant`. Category names and sort order must not be shared across tenants.
- `MenuItem`: belongs to one `Restaurant`, either directly and through `MenuCategory`, or directly for simpler guard checks. Direct `restaurantId` is recommended for query safety and indexes.
- `GalleryCategory`: belongs to one `Restaurant`.
- `Photo`: belongs to one `Restaurant`, either directly and through category, or directly for safer filtering.
- `Reservation`: belongs to one `Restaurant`. Public creation and admin listing must be scoped.
- `Order`: belongs to one `Restaurant`. Public ordering, admin listing, kitchen queue, status updates, and assisted ordering must all be scoped.
- `OrderItem`: belongs to an `Order`, but should preserve item snapshots. Direct `restaurantId` is optional but useful for reporting and guard checks.
- `OrderRecipeConsumption`: belongs to an `Order`; direct `restaurantId` is optional but useful for admin queries and audit integrity.
- `RestaurantTable`: belongs to one `Restaurant`. Table slug and QR token uniqueness should be per restaurant unless globally unique links are required.
- `InventoryItem`: belongs to one `Restaurant`. SKU uniqueness should become per restaurant if client restaurants can share SKU formats.
- `InventoryMovement`: belongs to one `Restaurant` and one inventory item. Direct `restaurantId` helps audit and reporting.
- `MenuItemIngredient`: belongs to one `Restaurant` through menu item and inventory item. Direct `restaurantId` helps prevent cross-tenant recipe links.
- `Announcement`: belongs to one `Restaurant`.
- `AdminUser`: current global admin user model needs a scoped membership strategy before users can safely manage multiple restaurants.

Additional code paths that need restaurant context:

- `src/app/public` and nested public restaurant routes.
- `src/app/admin` restaurant operations pages.
- Menu, order, reservation, table, inventory, recipe, gallery, settings, announcement, and user APIs.
- Helpers such as `getRestaurantProfile`, `getRestaurantSettings`, feature checks, table helpers, inventory helpers, and recipe helpers.

## Platform-owned data

The following data should remain platform-level:

- `GatewayLead`: prospect submissions from the public business gateway.
- Platform package presentation and future package definitions.
- Future client restaurant records before they become provisioned restaurants.
- Future billing/subscription records.
- Future platform settings for gateway copy, platform brand, notification preferences, and operational defaults.
- Platform owner/admin accounts.

Platform-owned data can reference a `Restaurant` later when a lead converts, but it should not be mixed into restaurant operations tables.

## Migration strategy

Use a phased migration so production data and the demo route remain stable.

### Phase 1: Add `Restaurant` model and seed Demo Restaurant

- Add a `Restaurant` model only.
- Seed one `Demo Restaurant` row.
- Do not change runtime reads or writes yet.
- Add smoke checks proving the demo restaurant seed exists in development/production migration flow.

### Phase 2: Add nullable `restaurantId` to restaurant-owned tables

- Add nullable `restaurantId` fields to restaurant-owned tables.
- Add indexes on `restaurantId` and common compound access patterns.
- Do not make fields required yet.
- Do not change public route behavior yet.

Candidate tables:

- `RestaurantProfile`
- `RestaurantSettings`
- `MenuCategory`
- `MenuItem`
- `GalleryCategory`
- `Photo`
- `Reservation`
- `Order`
- `OrderItem` if direct reporting scope is desired
- `OrderRecipeConsumption` if direct audit scope is desired
- `RestaurantTable`
- `InventoryItem`
- `InventoryMovement`
- `MenuItemIngredient`
- `Announcement`

### Phase 3: Backfill existing demo data to Demo Restaurant

- Set all existing restaurant-owned rows to the Demo Restaurant id.
- Convert singleton profile/settings rows into demo-owned rows while preserving current values.
- Preserve existing ids where possible to reduce runtime churn.
- Verify counts before and after backfill.

### Phase 4: Make `restaurantId` required where safe

- Make `restaurantId` required on tables that have been fully backfilled.
- Update unique constraints to include `restaurantId` where appropriate, such as table slug, inventory SKU, and category sort/name rules.
- Keep a rollback plan for any table with uncertain historical data.

### Phase 5: Update queries and API route guards to scope by restaurant

- Introduce a single helper that resolves restaurant context from a slug, domain, or demo route.
- Update public routes to load data through that context.
- Update admin APIs to require both authenticated user and restaurant access.
- Add tests or smoke checks for unscoped Prisma calls in restaurant-owned APIs.

### Phase 6: Add restaurant slug routing

- Add `/r/[restaurantSlug]` for public restaurant pages.
- Keep `/public` as a demo alias to Demo Restaurant.
- Add canonical link/redirect behavior later after production domains are planned.

### Phase 7: Add platform client restaurant creation

- Add platform admin flows to create and manage `Restaurant` records.
- Create the first restaurant owner membership manually or through a guarded platform action.
- Keep provisioning manual until the tenant boundary is stable.

### Phase 8: Add future subscription/provisioning

- Add package entitlements and billing only after restaurant scoping is fully enforced.
- Add automated provisioning only after the platform can create restaurants, users, domains, features, and seed content safely.

## Auth and role strategy

Current `AdminUser` records are global and have one role: `ADMIN`, `MANAGER`, or `SUPPORT`. That works for the demo, but it is not enough for multi-tenancy because the same person may be a platform admin, a restaurant owner, or staff for one or more restaurants.

Recommended direction:

- Keep platform owner access separate from restaurant operations access.
- Introduce a scoped membership model such as `RestaurantUser` or `RestaurantMembership`.
- Store restaurant roles on the membership, not only on the user.
- Use role names such as `OWNER`, `MANAGER`, and `SUPPORT` for restaurant-level access.
- Keep platform roles such as `PLATFORM_ADMIN` or continue to treat selected `AdminUser` accounts as platform admins during a transition.

Suggested long-term shape:

- `User`: identity and credentials.
- `PlatformMembership`: platform access and platform role.
- `RestaurantMembership`: `userId`, `restaurantId`, restaurant role, status, createdAt, updatedAt.

Safer transitional shape:

- Keep `AdminUser` for current login/session compatibility.
- Add `RestaurantMembership` later and map existing demo admins to Demo Restaurant.
- Only after route guards are scoped, decide whether to split `AdminUser` into a general `User` model.

The platform admin should never grant restaurant access implicitly unless a matching restaurant membership exists.

## Risk list

Primary risks:

- Data leakage between tenants from unscoped Prisma queries.
- Public ids being used without verifying restaurant ownership.
- Admin role confusion between platform owner roles and restaurant staff roles.
- Route confusion between `/admin`, `/platform-admin`, `/public`, and future restaurant slug routes.
- Migration/backfill mistakes that leave rows without `restaurantId`.
- Broken demo route if `/public` stops resolving the Demo Restaurant correctly.
- Unique constraint mistakes, especially for table slugs, inventory SKUs, category names, and QR tokens.
- Performance regressions if `restaurantId` indexes are missing on high-traffic tables.
- Cache leakage if singleton profile caching is reused without tenant keys.
- Feature flag leakage if module checks still read one global profile.
- Future billing/provisioning flows accidentally creating partially configured restaurants.

Mitigations:

- Add tenant context helpers before touching many routes.
- Add source smoke checks that flag restaurant-owned Prisma queries without restaurant scope.
- Backfill and verify counts before making constraints required.
- Keep `/public` as a stable demo alias until slug routing is proven.
- Add indexes with every restaurant-owned foreign key.
- Keep platform and restaurant route shells visually and logically distinct.

## Recommended first implementation batch

Batch 33: Add Restaurant model and seed Demo Restaurant without changing runtime behavior.

Scope for Batch 33:

- Add a `Restaurant` model with minimal fields: `id`, `slug`, `name`, `status`, `createdAt`, and `updatedAt`.
- Create a migration.
- Seed or upsert one `Demo Restaurant` record with slug `demo-restaurant`.
- Do not add `restaurantId` to existing operation tables yet.
- Do not change `/public`, `/admin`, `/platform-admin`, or API runtime behavior yet.
- Add smoke checks proving the model exists, the seed path exists, no restaurant-owned tables are scoped yet, and no provisioning/billing logic was added.
- Update README with a narrow note that the tenant root record exists but multi-tenancy is not live yet.

What Batch 33 should not include:

- No public slug route yet.
- No tenant-scoped queries yet.
- No platform client restaurant creation UI yet.
- No payments, subscriptions, billing, provisioning, CRM automation, email sending, or WhatsApp sending.
- No migration that makes existing restaurant data required to have a restaurant id.

This keeps the first implementation batch reversible, easy to verify, and small enough to review carefully.
