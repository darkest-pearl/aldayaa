# Tenant Admin Access Foundation Blocker

Blocker status: partially resolved by Batch 49 schema boundary.

Batch 48 inspected the current schema and authentication boundary before adding restaurant-scoped tenant admin access. The safe implementation was blocked because AdminUser has no restaurantId or membership relation.

Batch 49 adds a separate RestaurantUser model. This creates the schema/auth boundary needed for future restaurant-scoped staff access without overloading the platform `AdminUser` model.

Batch 50 adds first-owner provisioning and restaurant staff login. Platform ADMIN users can create the first OWNER RestaurantUser for initialized non-demo tenants, and restaurant staff can sign in through `/r/[restaurantSlug]/admin/login` using the separate restaurant staff cookie.

The current admin model is still global:

- `AdminUser.email` is globally unique.
- `AdminUser.role` is a global role string.
- The admin session token contains only `id`, `email`, and `role`.
- `/platform-admin` allows access when `admin.role === 'ADMIN'`.

That means platform ADMIN and tenant admin roles cannot be safely separated yet. If a tenant admin were created with the existing `ADMIN` role, tenant admins could accidentally satisfy the existing ADMIN role checks and access `/platform-admin`. If a tenant admin were created with `MANAGER` or `SUPPORT`, the user still would not have a reliable restaurant scope in the session or database relationship.

Platform AdminUser remains separate from RestaurantUser. RestaurantUser sessions must not use the platform admin cookie.

Additional tenant admin creation remains future work beyond the first OWNER account. Do not add broader staff management until the login/session/route boundary is extended and smoke-covered.

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

## Batch 50 outcome

Batch 50 uses the authentication-foundation path only:

- first OWNER RestaurantUser creation is available only from platform admin for initialized non-demo tenants
- restaurant staff login uses `aldayaa_restaurant_staff`, not the platform admin cookie
- tenant staff sessions include restaurantId and restaurantSlug
- tenant staff sessions are blocked from `/platform-admin`
- no menu, gallery, order, reservation, inventory, recipe, or GatewayLead rows created
- no email or WhatsApp sending
- no billing, subscription, payment, provisioning, custom domain, or subdomain logic
- Operational tenant admin modules remain future work.
