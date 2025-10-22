# Omnichannel Platform Overview

This document captures the end-to-end capabilities of the Omnichannel QR dining platform. The monorepo bundles the Express/Sequelize backend, the customer ordering web application, the kitchen-facing admin console, and shared tooling for local development.

## Workspace Structure & Tooling

- **Package management**: pnpm workspace defined in `pnpm-workspace.yaml`.
- **Packages**:
  - `be/` – Node.js + Express backend with Sequelize ORM, MySQL persistence, and Server-Sent Events for realtime updates.
  - `fe-customer/` – React 18 SPA built with React-Bootstrap delivering the guest ordering flow optimised for mobile.
  - `fe-administrator/` – React 18 admin console using Redux Toolkit and axios for authenticated restaurant operators.
  - `minio/` – optional utilities for the MinIO object storage emulator.
- **Scripts**: each package exposes `pnpm dev/start/test` entries. The backend ships with Jest, the UIs inherit the CRA toolchain.
- **Shared configuration**: `.env.example` files per package describe required environment variables; backend secrets include JWT, crypto, email, and payment credentials.

## Backend Service (`be/`)

### Core Responsibilities

1. **Authentication & Admin Management**
   - JWT-based owner/manager auth (`/admin/auth/*` routes) with refresh token rotation and password reset flows.
   - Invitation system allowing owners to onboard staff.

2. **Restaurant Inventory & Menu**
   - Sequelize models for restaurants, tables, menu categories, and menu items.
   - Asset storage integration hooks (MinIO-compatible) for menu imagery.

3. **Customer Ordering Pipeline**
   - Guest sessions created via QR slugs (`POST /customer/sessions`).
   - Menu delivery (`GET /customer/menu`) scoped to the active restaurant/table.
   - Order placement with validation of menu availability and loyalty accrual (`POST /customer/orders`).
   - Membership registration & verification through signed email links (`/customer/memberships/*`).

4. **Order Tracking & Kitchen Display**
   - KDS ticket creation with incremental sequencing per restaurant.
   - Order hydration exposes restaurant/table, line items, special requests, and ticket status.
   - Admin endpoints deliver aggregated order lists and allow status transitions (`/admin/orders`).

5. **Realtime Event Infrastructure**
   - Server-Sent Events (SSE) registry broadcasting to two audiences:
     - **Kitchen stream** (`/admin/orders/stream`) keyed by restaurant IDs for large-display dashboards.
     - **Customer stream** (`/customer/orders/stream`) keyed by session token, enabling live status updates on guest devices.
   - Event payloads include restaurant + session context so clients can update UI state immediately.

### Tech Stack

- Express 4, Sequelize 6 (MySQL driver), Joi for validation, bcryptjs for credential hashing, UUID v4 for IDs.
- Winston logger with structured metadata.
- Modular service/controller architecture under `src/api`.
- Configuration via dotenv + custom `config/env.js` loader.

## Customer Web App (`fe-customer/`)

### User Journey

1. **QR Bootstrapping**
   - Session context reads the `qr` slug, validates it via `/customer/tables/lookup`, and persists active sessions in `localStorage` for seamless navigation.
   - Graceful fallback when slug is missing but a stored session exists (e.g. deep links to `/checkout`).

2. **Session Setup**
   - Optional guest details (name, email, phone, loyalty number) captured through a responsive form.
   - Warns when a table already has an open order and allows skipping data entry.

3. **Menu Browsing & Cart**
   - Menu categories + items rendered with React-Bootstrap cards, image fallbacks, quantity controls, and contextual badges in `MenuPage.jsx`/`MenuCategory.jsx`.
   - Cart context tracks selections, totals, and item adjustments across the app shell.

4. **Checkout**
   - Presents a summary with quantities, pricing, clear-cart, and submit actions.
   - Posts to `/customer/orders` and resets the cart on success, invalidating cached order lists.

5. **Order Tracking & Notifications**
   - Orders list subscribes to the SSE stream using `EventSource` for live updates without polling.
   - When statuses change to READY or COMPLETED:
     - Vibrates compatible devices.
     - Plays an audible tone (Web Audio API) distinct per status.
     - Fires a browser notification when permission is granted.
     - Displays a modal summarising the ticket and items for quick acknowledgement.
   - Manual refresh button provides a REST fallback.

### Tech Stack & Patterns

- React 18 with functional components + hooks, React-Bootstrap for layout, Toastify for inline feedback.
- Context providers for session and cart state, axios service layer in `src/services/`.
- Client-side routing via `react-router-dom` v6 with guarded shells.

## Admin Console (`fe-administrator/`)

### Key Features

1. **Authentication Workflows**
   - Login, invitation acceptance, and password reset screens connected to backend auth endpoints.
   - Redux store retains tokens and user profile; axios interceptors auto-refresh credentials.

2. **Orders Command Center**
   - Card-based layout tailored for kitchen displays with high contrast and concise metadata.
   - Shows restaurant, table, elapsed time, line items, special requests, and running total.
   - Action buttons progress orders through PLACED -> ACCEPTED -> IN_PREP -> READY -> COMPLETED or cancel.
   - SSE subscription keeps the board in sync; new orders surface toast notifications.
   - When staff mark an order READY, a confirmation modal reminds them the customer has been notified.

3. **Additional Pages**
   - Placeholder dashboard, asset management, and auth utility pages scaffolded for future expansion.

### Promotion Email Campaigns

- Build your campaign under **Management → Promotions** in the admin console. Each promotion should include at least one active voucher so recipients have a tangible benefit.
- Once ready, choose **Send campaign email**. The UI calls `POST /api/v1/management/promotions/:promotionId/dispatch`, which loads the promotion, verifies voucher inventory, and targets restaurant members who have opted into email.
- Only `RestaurantCustomer` records with `MEMBER` status and a non-null email address are contacted. The response echoes how many emails were attempted, sent, and failed for analytics in the UI.
- Every email carries a signed claim link (`/claim-voucher?token=…`). Guests can tap it from their inbox to add the highlighted voucher to their bag immediately—no QR code required.

```js
// be/src/api/services/management.service.js
export const dispatchPromotionEmails = async (restaurantIds = [], promotionId) => {
    const promotionRecord = await loadPromotionForRestaurants(promotionId, restaurantIds);
    const statsMap = await fetchVoucherStats((promotionRecord.vouchers || []).map((voucher) => voucher.id));
    const promotion = formatPromotionAdmin(promotionRecord, statsMap);

    if (!promotion || (promotion.vouchers || []).length === 0) {
        throw new Error('Promotion has no vouchers configured');
    }

    const memberships = await RestaurantCustomer.findAll({
        where: { restaurantId: promotion.restaurantId, status: MEMBERSHIP_STATUS.MEMBER },
        include: [{ model: Customer, as: 'customer', required: true, where: { email: { [Op.ne]: null } } }]
    });

    const urlSanitizer = /\/+$/;
    const baseUrl = (env.app.customerAppUrl || env.app.appUrl || 'http://localhost:3030').replace(urlSanitizer, '');
    const featuredVoucher = promotion.vouchers[0];
    const maxDiscountPercent = promotion.vouchers.reduce((acc, voucher) => {
        const voucherMax = (voucher.tiers || []).reduce(
            (tierAcc, tier) => Math.max(tierAcc, Number(tier.discountPercent) || 0),
            0
        );
        return Math.max(acc, voucherMax);
    }, 0);

    const recipients = memberships.filter((membership) => membership.customer?.email);
    if (recipients.length === 0) {
        return { promotion, attempted: 0, sent: 0, failed: 0 };
    }

    const emailResults = await Promise.allSettled(
        recipients.map((membership) => {
            const customer = membership.customer;
            const name = [customer.firstName, customer.lastName].filter(Boolean).join(' ').trim() || customer.email || 'Valued guest';
            const claimToken = signPromotionClaimToken({
                restaurantId: promotion.restaurantId,
                promotionId: promotion.id,
                voucherId: featuredVoucher?.id || null,
                customerId: membership.customerId,
                membershipId: membership.id,
                email: customer.email
            });
            const claimUrl = `${baseUrl}/claim-voucher?token=${encodeURIComponent(claimToken)}`;
            const tiers = (featuredVoucher?.tiers || []).map((tier) => ({
                minSpend: formatCurrency(tier.minSpendCents),
                discountPercent: tier.discountPercent,
                maxDiscount: tier.maxDiscountCents ? formatCurrency(tier.maxDiscountCents) : null
            }));
            const hasTiers = tiers.length > 0;

            return sendEmail(
                {
                    name,
                    emailSubject: promotion.emailSubject,
                    emailPreviewText: promotion.emailPreviewText,
                    promotionName: promotion.name,
                    headline: promotion.headline,
                    description: promotion.description,
                    bannerImageUrl: promotion.bannerImageUrl,
                    ctaLabel: promotion.ctaLabel || 'Claim voucher',
                    claimUrl,
                    voucherCode: featuredVoucher?.code || '',
                    tiers,
                    hasTiers,
                    maxDiscountPercent,
                    legalNotice: `Discounts are capped at ${MAX_LEGAL_DISCOUNT_PERCENT}% per transaction.`,
                    validUntil: featuredVoucher?.validUntil || promotion.endsAt || null
                },
                customer.email,
                EMAIL_ACTIONS.PROMOTION_CAMPAIGN
            );
        })
    );

    const sent = emailResults.filter((entry) => entry.status === 'fulfilled').length;
    const failed = emailResults.length - sent;

    return { promotion, attempted: emailResults.length, sent, failed };
};
```

### Tech Stack

- React 18, Redux Toolkit, React-Bootstrap, Toastify.
- Axios service layer in `src/services/`, SSE helpers in `orderEvents.service.js`.
- CRA build with ESLint/Prettier configuration for consistent linting.

## Realtime & Notification Flow

1. Guest scans QR -> backend validates table and issues `sessionToken`.
2. Order placed -> backend creates order + KDS ticket -> dispatches `order.created` event to kitchen and customer streams.
3. Kitchen updates status via admin console -> backend persists and broadcasts `order.updated`.
4. Customer UI reacts:
   - Updates order card state.
   - If status is READY/COMPLETED, plays vibration + audio, shows success modal, and pushes browser notification.
5. Admin UI reacts:
   - Refreshes card state instantly.
   - Shows “customer notified” modal when transitioning to READY to confirm the alert was sent.

## Configuration & Environment Highlights

- **Backend `.env` essentials**: MySQL credentials, JWT secrets, crypto key, optional Stripe keys for live mode, email settings, MinIO storage.
- **Frontends**: `REACT_APP_BASE_URL` pointing to backend (`http://localhost:3301/api/v1` by default). Customer app can optionally set brand colours via CSS in `index.css`.
- **Ports**: customer app defaults to 3030, admin app to CRA’s 3000, backend to 3301.

## Testing & Quality

- Backend wired for Jest (`pnpm --filter omnichannel-backend test -- --passWithNoTests`).
- Frontends rely on CRA testing harness (Jest + React Testing Library) ready for component tests.
- ESLint + Prettier configs in each package support consistent formatting; run `pnpm lint` within packages when needed.

## Extending the Platform

- **Menu & pricing**: add Sequelize migrations/services and expose new endpoints, then consume via React service modules.
- **Payments**: Stripe-style mock gateway with detailed validation plus cashier cash handoff; swap in real Stripe keys and payment service to go live.
- **Push notifications**: the `notifications` table and realtime service registry provide hooks for email/SMS/push integrations.
- **Analytics**: follow the SSE registry pattern to introduce additional telemetry channels or upgrade to WebSockets.

Pair this document with the package-specific READMEs for setup commands and environment variable descriptions.
