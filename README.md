# Al Dayaa Al Shamiah Restaurant

Production-ready Next.js (App Router) site for Al Dayaa Al Shamiah Restaurant with Tailwind CSS, Prisma + SQLite, and admin dashboard.

## Getting Started

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Environment variables**
   Create `.env` with:
   ```env
   DATABASE_URL="file:./dev.db"
   ADMIN_EMAIL="admin@example.com"
   ADMIN_PASSWORD="strongpassword"
   ADMIN_JWT_SECRET="change-me"
   
   # WhatsApp (Twilio) optional
   TWILIO_ACCOUNT_SID=""
   TWILIO_AUTH_TOKEN=""
   TWILIO_WHATSAPP_FROM=""
   ADMIN_WHATSAPP_TO=""

   # Cloudinary optional (for photo uploads)
   CLOUDINARY_CLOUD_NAME=""
   CLOUDINARY_API_KEY=""
   CLOUDINARY_API_SECRET=""
   ```

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

## Features
- Public pages: Home, Menu, Reservations, Order Online, Gallery, About, Contact.
- Framer Motion animations, responsive Tailwind UI.
- Orders & reservations via API routes with optional WhatsApp notifications.
- Admin dashboard (login at `/admin/login`) to manage menu, gallery, view reservations & orders.
- SQLite by default; swap DATABASE_URL for Postgres when needed.

## Notes
- Seed data populates menu categories/items and gallery categories/photos.
- Admin credentials from `.env` seed automatically; you can also create records in the AdminUser table.
- Image placeholders reference `/public/images/...` paths; add your assets there.

## Admin system
- Admin area lives under `src/app/admin` with route groups for authentication and protected pages. Shared UI lives in `src/app/admin/components`.
- Role-based access:
  - **ADMIN**: full control including managing other admin users.
  - **MANAGER**: manage menu, gallery, orders, and reservations (no admin user creation).
  - **SUPPORT**: read-only access to data.
- All admin API routes return a consistent `{ success, data, error }` shape. Validation uses Zod and RBAC checks via `requireAdmin`.
- CRUD coverage:
  - Menu and gallery include category/item creation, editing, and deletion with confirmation prompts.
  - Orders and reservations support status changes and protected deletes.
  - Admin users can be created, updated (role/password), and removed from `/admin/users` (ADMIN only).
- Layout uses `AdminShell` for navigation, responsive design, and session-aware controls. Confirmation dialogs are provided for destructive actions.