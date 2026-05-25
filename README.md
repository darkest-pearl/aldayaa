# Al Dayaa Al Shamiah Restaurant

Production-ready Next.js (App Router) site for Al Dayaa Al Shamiah Restaurant with Tailwind CSS, Prisma + PostgreSQL, and an admin dashboard.

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

- Public website pages for home, menu, reservations, ordering, gallery, about, and contact.
- Menu, orders, reservations, gallery, settings, announcements, and WhatsApp integration.
- Admin dashboard at `/admin/login` for operational management.
- Role-based admin access with ADMIN, MANAGER, and SUPPORT roles.
- Responsive Tailwind UI with Prisma-backed API routes.
- Non-interactive Next.js linting and a focused production-hardening smoke check.
- Restaurant profile/config foundation for one restaurant profile, with admin API support.

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

## Production Notes

- Rotate leaked credentials immediately if this repo history contained secrets.
- Use a strong `ADMIN_JWT_SECRET` with at least 32 random characters.
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
