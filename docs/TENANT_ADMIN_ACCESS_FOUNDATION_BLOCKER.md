# Tenant Admin Access Foundation Blocker

Blocker status: partially resolved by Batch 49 schema boundary.

Batch 48 inspected the current schema and authentication boundary before adding restaurant-scoped tenant admin access. The safe implementation was blocked because AdminUser has no restaurantId or membership relation.

Batch 49 adds a separate RestaurantUser model. This creates the schema/auth boundary needed for future restaurant-scoped staff access without overloading the platform `AdminUser` model.

The current admin model is still global:

- `AdminUser.email` is globally unique.
- `AdminUser.role` is a global role string.
- The admin session token contains only `id`, `email`, and `role`.
- `/platform-admin` allows access when `admin.role === 'ADMIN'`.

That means platform ADMIN and tenant admin roles cannot be safely separated yet. If a tenant admin were created with the existing `ADMIN` role, tenant admins could accidentally satisfy the existing ADMIN role checks and access `/platform-admin`. If a tenant admin were created with `MANAGER` or `SUPPORT`, the user still would not have a reliable restaurant scope in the session or database relationship.

Platform AdminUser remains separate from RestaurantUser. RestaurantUser sessions must not use the platform admin cookie.

Tenant admin creation remains future work. Do not create tenant admin users until the login/session/route boundary is implemented and smoke-covered.

## Needed schema/auth boundary

A safe tenant-admin implementation batch can now build on this explicit ownership model:

- `RestaurantUser` for restaurant-scoped staff accounts.

The next implementation should include:

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

Batch 49 uses the schema-boundary path only:

- no tenant admin creation action
- no password collection
- no AdminUser or RestaurantUser rows created
- no menu, gallery, order, reservation, inventory, recipe, or GatewayLead rows created
- no email or WhatsApp sending
- no billing, subscription, payment, provisioning, custom domain, or subdomain logic
