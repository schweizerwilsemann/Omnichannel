# Recommendation Engine Overview

This doc explains how the v0 recommendation engine works, where its data comes from, and the way the Apriori algorithm is used to generate add‑on suggestions for guests.

## Feature Goals
- Suggest high affinity dishes in the customer checkout automatically.
- Give admins visibility into attach rates (how often “Pho → Spring Rolls” occurs) so they can refine menus.
- Keep the stack simple: nightly/batch style job plus lightweight API endpoints feeding both the guest and admin UIs.

## Data Sources

| Table | Purpose |
| --- | --- |
| `menu_categories`, `menu_items` | Defines the universe of items we can recommend. |
| `orders`, `order_items` | Provides historical baskets (each basket = set of item IDs for an order). |
| `menu_recommendations` | New table that stores the mined association metrics (support, confidence, lift, attach rate). |

When there is little or no order history the system manufactures synthetic baskets that still reference the real menu items. The Apriori run keeps track of how many historical vs. synthetic transactions influence each rule in the `metadata` column.

## Offline Generation Pipeline

The entrypoint lives in `be/src/scripts/buildRecommendations.js`. Running `pnpm --filter be recommendations:rebuild` triggers:

1. **Load Menu:** For each restaurant pull its categories + items.
2. **Build Transactions:**
   - Pull real orders grouped by `order_id`.
   - Generate synthetic baskets per restaurant if order volume is too small (details below).
3. **Run Apriori:** Mine association rules to compute support, confidence, lift and attach rate (`confidence` = attach rate).
4. **Persist Results:** Replace existing rows in `menu_recommendations` for that restaurant.

The job is idempotent—it truncates recommendations per restaurant inside a transaction and bulk inserts the refreshed set.

### Synthetic Transactions

Implemented in `buildSyntheticTransactions()` within `be/src/api/services/recommendation.service.js`.

- For each menu item we choose a handful of likely companions (15% of the remaining catalog) and add them to a “focus pairs” pool.
- For the majority of synthetic baskets (configurable weight, defaults to 65%) we:
  - Pick a focus pair,
  - Optionally add a third item,
  - Tag the basket with `source: 'synthetic'`.
- For the rest we sample 2–4 items from the same category so generated baskets still feel coherent.

This creates enough signal for Apriori to emit lift/attach metrics even before real orders exist. Once organic data grows those synthetic transactions become less influential because everything is blended.

## Apriori Implementation

The Apriori logic is implemented directly in JavaScript inside `runApriori()` (same service file). The steps:

1. **Count Singletons and Pairs:** Iterate through each transaction, collecting counts per item and per item pair.
2. **Calculate Support:** `support(pair) = count(pair) / total_transactions`.
3. **Filter by Thresholds:** Ignore pairs with support below `minSupport` (default 0.01).
4. **Compute Confidence/Lift:** For each surviving pair:
   - `confidence(A→B) = count(A,B) / count(A)`.
   - `lift(A→B) = confidence(A→B) / support(B)`.
   - Attach rate = confidence.
5. **Curate Top Rules:** Keep the top N (default 5) recommendations per base item sorted by lift → confidence → support count.
6. **Persist:** Save metrics alongside metadata (run id, counts of synthetic/historical transactions, totals).

Everything is designed to be transparent: `metadata.sources.historical` vs `synthetic` reveals how much of the signal was manufactured.

## Serving Recommendations

### Customer App
- Endpoint: `GET /customer/recommendations`.
- Parameters: `sessionToken`, `items` (IDs in the cart), optional `limit`.
- Flow:
  1. Resolve guest session → restaurant.
  2. Fetch top recommendations for the cart items excluding ones already in the cart.
  3. Return data to the checkout UI; the FE shows “Recommended for you” cards with attach‑rate badges and “Add” buttons.

File references:
- Backend controller: `be/src/api/controllers/customer.controller.js`.
- Frontend integration: `fe-customer/src/pages/CheckoutPage.jsx`, `fe-customer/src/index.css`.

### Admin Dashboard
- Endpoint: `GET /admin/menu/recommendations`.
- Filters: `restaurantId`, `minAttachRate`, `limit`.
- Returns summary metrics and a ranked table for attach rate/lift/confidence/support (with synthetic vs historical counts).
- UI: new “Recommendations” tab in the management page (`fe-administrator/src/pages/ManagementPage.jsx` + `fe-administrator/src/components/recommendations/RecommendationInsightsPanel.jsx`).

## Configuration & Tuning

The defaults are stored in `DEFAULT_OPTIONS` inside `recommendation.service.js`. You can tweak:
- `minSupport` / `minConfidence` to tighten or loosen the rule mining.
- `syntheticTransactionsPerItem`, `syntheticComboWeight` to control the bootstrap dataset size/bias.
- `topRecommendationsPerItem` to change how many rules we retain per base dish.

## Running It End-to-End
1. Run migrations: `pnpm --filter be migrate`.
2. Generate recommendations: `pnpm --filter be recommendations:rebuild`.
3. Start backend + FE apps; checkout page should show suggestions, admin page should show analytics.

## Next Steps
- Swap to purely historical data once enough orders accumulate (toggle the `includeHistoricalOrders`/synthetic options).
- Introduce schedule (cron/worker) so the rebuild runs nightly.
- Consider user-specific signals (loyalty history) as a future iteration on top of this Apriori baseline.

