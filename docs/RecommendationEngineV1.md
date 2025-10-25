# Recommendation Engine v1 – Design & Implementation

This document captures the full reasoning behind the v1 recommendation feature set that is now live in the Omnichannel monorepo: nightly ETL, persistent history, admin analytics with trends, and customer‑facing add‑ons.

---

## 1. Objectives

| Persona | Goal |
| --- | --- |
| Guest | Surface 3‑5 high affinity items under the checkout summary, tuned to the table’s active cart. |
| Operator | Monitor attach rate, lift, and trend for popular pairs; understand whether momentum is up/down before adjusting the menu. |
| Platform | Keep the pipeline deterministic and debuggable (cron friendly, minimal dependencies). |

---

## 2. Data Model & Migration

Two tables back the experience:

1. **`menu_recommendations`** – current “live” rules that power both APIs.
2. **`menu_recommendation_history`** – append‑only log for each ETL run; feeds the analytics sparkline.

The new migration `be/migrations/013-create-menu-recommendation-history.js` provisions the history table plus compact indexes so MySQL stays under identifier limits:

```js
await queryInterface.createTable(TABLE_NAME, {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    restaurant_id: { type: DataTypes.UUID, allowNull: false },
    base_item_id: { type: DataTypes.UUID, allowNull: false },
    recommended_item_id: { type: DataTypes.UUID, allowNull: false },
    support: { type: DataTypes.DECIMAL(10, 6), defaultValue: 0 },
    confidence: { type: DataTypes.DECIMAL(10, 6), defaultValue: 0 },
    lift: { type: DataTypes.DECIMAL(10, 6), defaultValue: 0 },
    attach_rate: { type: DataTypes.DECIMAL(10, 6), defaultValue: 0 },
    support_count: { type: DataTypes.INTEGER, defaultValue: 0 },
    run_id: { type: DataTypes.UUID, allowNull: false },
    generated_at: { type: DataTypes.DATE, allowNull: false },
    metadata: { type: DataTypes.JSON }
});

await queryInterface.addIndex(TABLE_NAME, ['restaurant_id', 'base_item_id', 'recommended_item_id'], {
    name: 'rec_hist_rest_base_comp_idx'
});
```

Sequelize model: `be/src/api/models/menuRecommendationHistory.model.js`.

Associations ensure easy joins when necessary (`be/src/api/models/associations.js`): each history row belongs to its restaurant + both menu items.

---

## 3. ETL & Rule Generation

The ETL entrypoint remains `be/src/scripts/buildRecommendations.js`, which simply bootstraps the DB connection and calls `rebuildMenuRecommendations`.

### 3.1 Core Loop

`rebuildMenuRecommendations()` in `be/src/api/services/recommendation.service.js` orchestrates:

```js
const runId = settings.runId || crypto.randomUUID();
for (const restaurant of restaurants) {
    const transactions = [...historicalOrders, ...buildSyntheticTransactions(...)];
    const rules = runApriori(transactions, { minSupport, minConfidence, generatedAtIso });
    const curated = curateRules(rules, settings);
    const enrichedRules = curated.map((rule) => ({
        ...rule,
        metadata: {
            ...rule.metadata,
            runId,
            historicalTransactions: historicalCount,
            syntheticTransactions: syntheticCount
        }
    }));

    await sequelize.transaction(async (transaction) => {
        await replaceMenuRecommendations(restaurant.id, enrichedRules, transaction);
        await recordRecommendationHistory(
            restaurant.id,
            enrichedRules,
            { runId, generatedAt: generatedAtIso },
            transaction
        );
    });
}
```

Key ideas:

- **Single `runId` per batch** – makes correlating logs vs. DB easy.
- **Synthetic fallback** – `buildSyntheticTransactions()` manufactures combos per item + category if historical order volume is low; each synthetic basket carries `source: 'synthetic'`.
- **Metadata** – attaches counts of historical vs. synthetic transactions and the ISO timestamp per rule for debugging.
- **History logging** – every curated rule is inserted into `menu_recommendation_history` within the same DB transaction so the live table + audit trail stay in sync.

### 3.2 Apriori Simplification

`runApriori()` is intentionally bespoke (no heavy data‑science dependencies):

1. Deduplicate each transaction, count items/pairs.
2. Filter by `minSupport`.
3. Emit two directional rules (`A→B`, `B→A`) with confidence, lift, attach rate.
4. `curateRules()` keeps the best `topRecommendationsPerItem` sorted by lift → confidence → support count.

Default parameters live in `DEFAULT_OPTIONS`. They can be overridden when invoking the script or via future admin inputs.

---

## 4. Serving Layer

### 4.1 Customer API & UI

- **Endpoint**: `GET /customer/recommendations?sessionToken=...&items=...`
- **Server**: `getCartRecommendationsController` resolves the session, de‑dupes cart IDs, and calls `getRecommendationsForRestaurant()` which queries the `menu_recommendations` table with excludes.
- **Frontend**: `fe-customer/src/pages/CheckoutPage.jsx` fetches recommendations whenever the cart signature changes and renders the “Recommended for you” row (image, price, attach rate badge, add‑to‑cart CTA).

### 4.2 Admin Analytics + Trends

- **Endpoint**: `GET /admin/menu/recommendations`
  - Validated by `recommendationAnalyticsQuerySchema` (now supports `trendWindowDays` 7‑120).
  - Controller forwards filters + restaurant scope to `listRecommendationAnalytics`.
- **Trend computation**: `attachTrendDataToRows()` looks up matching history rows within the requested window, limits to ~12 points (`DEFAULT_TREND_OPTIONS.maxPoints`), and annotates each pair with:
  - Sparkline points (`[{ generatedAt, attachRate }]`)
  - Net delta vs. the earliest point
  - Direction (`UP` / `DOWN` / `FLAT`)
  - Sample size

```js
const historyRows = await MenuRecommendationHistory.findAll({
    where: { generatedAt: { [Op.gte]: cutoff }, [Op.or]: pairs },
    order: [['generatedAt', 'ASC']]
});
// Map points → delta → direction
```

- **UI**: `fe-administrator/src/components/recommendations/RecommendationInsightsPanel.jsx`
  - Adds a “Trend window” dropdown (7/14/30/60/90/120 days) + inline refresh control.
  - Each row renders `<TrendSparkline points={row.trend.points} />` with a textual delta like `+3.2% vs 30d`.
  - `TrendSparkline` is a tiny SVG helper (`fe-administrator/src/components/recommendations/TrendSparkline.jsx`) that draws an inline polyline; defaults to a neutral “No history yet” label when data is missing.

Result: operators can judge whether “Pho → Spring Rolls” is accelerating or stagnating before making menu decisions.

---

## 5. Operations Guide

1. **Migrate**  
   ```bash
   pnpm --filter be run migrate
   ```

2. **Rebuild recommendations**  
   ```bash
   pnpm --filter be exec node src/scripts/buildRecommendations.js
   ```
   (Schedule this nightly cron or run ad‑hoc after major menu edits.)

3. **Verify**
   - Customer checkout should show updated recs under the cart.
   - Admin → Management → Recommendations should display sparklines, last updated timestamp, and respond to trend window changes.

4. **Monitor**
   - `be` logs emit run summaries with synthetic vs. historical counts and total rules inserted.
   - DB table `menu_recommendation_history` can be queried by `run_id` for debugging.

---

## 6. Future Iterations

- Personalize scores using loyalty history (user embeddings) while keeping the batch pipeline for cold start.
- Add admin overrides/pins stored alongside generated rules.
- Stream ETL results to a cache (Redis) to avoid full table scans for extremely large menus.
- Incorporate cost/margin metadata in the ranking logic (e.g., weight attach rate by contribution margin).

For now, the system balances simplicity (pure Node/Sequelize) with enough observability (history table + UI trends) to make data‑driven menu tweaks.***
