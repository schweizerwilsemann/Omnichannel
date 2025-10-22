# Omnichannel Backend

Restaurant ordering backend bootstrapped for QR-first dining with admin-only authentication.

## Environment

1. Copy `.env.example` to `.env` and fill values. Use the same credentials as the Rasops variant where applicable.
2. Ensure `DB_NAME`, `DB_HOST`, `DB_USER`, and `DB_PASSWORD` point to a reachable MySQL instance.
3. Provide `JWT_SECRET` and a 32-byte `CRYPTO_SECRET_KEY` (e.g. generated via `openssl rand -hex 16`).
4. Configure Stripe keys (`STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY`) if you plan to swap the mock gateway for a live Stripe account. The checkout flow ships with a server-side stripe simulation and works without real keys.
5. Populate email and notification keys if email delivery is required; otherwise leave blank for local testing.
6. Configure asset storage via `STORAGE_PROVIDER`, `STORAGE_BUCKET`, and the `MINIO_*` variables for MinIO-compatible object storage.

## Setup

```bash
npm install
npm run dev
```

The first boot synchronises Sequelize models with the database (`sequelize.sync()`), creating the tables that back:

- Admin auth (`users`, `user_credentials`, `admin_sessions`, `admin_invitations`, `password_reset_tokens`, `security_events`).
- Restaurant operations (`restaurants`, `restaurant_staff`, `restaurant_tables`, `menu_categories`, `menu_items`).
- Guest journey (`guest_sessions`, `orders`, `order_items`, `kds_tickets`, `kds_activity_logs`).
- Customer registry (`customers`, `restaurant_customers`).
- Notifications (`notifications`).

## Key Routes

- `POST /api/v1/admin/auth/login` — admin login, returns access + refresh tokens.
- `POST /api/v1/admin/auth/refresh` — rotates refresh tokens and issues a fresh access token.
- `POST /api/v1/admin/auth/logout` — revokes the active refresh token.
- `POST /api/v1/admin/auth/invitations` — owners invite managers (JWT required).
- `POST /api/v1/admin/auth/invitations/accept` — invitee accepts, sets password, and joins assigned restaurant.
- `POST /api/v1/admin/auth/password-reset/request` — requests a password reset email.
- `POST /api/v1/admin/auth/password-reset/confirm` — finalises reset and revokes outstanding sessions.

All customer-facing ordering flows are unauthenticated and tracked via `guest_sessions` tokens allocated when a QR code is scanned.

## Running migrations manually

The backend uses hand-written Sequelize migration files stored in `be/migrations`. To apply a specific migration without wiring up the full Sequelize CLI, use the helper script:

```bash
# From the be/ directory
pnpm run migrate 008-create-promotions-and-vouchers.js

# To roll back the same migration
pnpm run migrate 008-create-promotions-and-vouchers.js -- --down
```

The script loads `be/.env`, connects with the configured database credentials, and runs the selected migration's `up` (default) or `down` function. Ensure the DB user has permission to alter schema objects before running it.

## Customer API

QR scans create guest sessions that drive the customer ordering flow. Key endpoints under `/api/v1/customer` include:

- `POST /customer/sessions` - start a session for a table QR slug (optionally capture membership details).
- `GET /customer/menu` - retrieve active categories and menu items for the session.
- `POST /customer/orders` - place an order tied to the active guest session.
- `GET /customer/orders` - list orders for the session with live kitchen status.

Sessions capture membership metadata when the customer provides a loyalty number or opts into the program. Orders accrue loyalty points for members.
