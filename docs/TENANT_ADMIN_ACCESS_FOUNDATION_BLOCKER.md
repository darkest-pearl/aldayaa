# Tenant Admin Access Foundation Blocker

Blocker status: active for Batch 48.

Batch 48 inspected the current schema and authentication boundary before adding restaurant-scoped tenant admin access. The safe implementation is blocked because AdminUser has no restaurantId or membership relation.

The current admin model is still global:

- `AdminUser.email` is globally unique.
- `AdminUser.role` is a global role string.
- The admin session token contains only `id`, `email`, and `role`.
- `/platform-admin` allows access when `admin.role === 'ADMIN'`.

That means platform ADMIN and tenant admin roles cannot be safely separated yet. If a tenant admin were created with the existing `ADMIN` role, tenant admins could accidentally satisfy the existing ADMIN role checks and access `/platform-admin`. If a tenant admin were created with `MANAGER` or `SUPPORT`, the user still would not have a reliable restaurant scope in the session or database relationship.

Do not create tenant admin users until the schema/auth boundary is added.

## Needed schema/auth boundary

A safe next batch should add one of these explicit ownership models:

- `RestaurantUser` for restaurant-scoped staff accounts.
- `AdminUserRestaurantMembership` if reusing `AdminUser` as the login identity.

Recommended model direction: RestaurantUser or AdminUserRestaurantMembership.

The chosen model should include:

- restaurant ownership through `restaurantId`
- a tenant-scoped role such as OWNER, MANAGER, or SUPPORT
- a clear distinction between platform roles and restaurant roles
- unique constraints that prevent ambiguous duplicate access
- indexes for `restaurantId` and user lookup

The auth layer should then include restaurantId or membership scope in the authenticated session, or resolve it server-side for every restaurant admin request before authorizing access.

## Required route boundary

Future tenant admin work must preserve these boundaries:

- platform ADMIN can access `/platform-admin`
- tenant admins cannot access `/platform-admin`
- tenant admin sessions cannot grant platform owner privileges
- Demo Restaurant data is not modified by tenant admin setup
- GatewayLead remains platform-owned

## Batch 48 outcome

Batch 48 uses the blocker path only:

- no tenant admin creation action
- no password collection
- no AdminUser rows created
- no menu, gallery, order, reservation, inventory, recipe, or GatewayLead rows created
- no email or WhatsApp sending
- no billing, subscription, payment, provisioning, custom domain, or subdomain logic
