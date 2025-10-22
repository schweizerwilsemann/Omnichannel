 2. Recommendation Engine & Menu Personalization

    Goal: Improve basket size and guest satisfaction by recommending complementary items.

    - Guest side: Use collaborative filtering on order history (per session, per loyalty member) to suggest add-ons
      during checkout. Eg. “People who ordered Pho also added Spring Rolls.”
    - Admin side: Provide an “attach rate” dashboard so menu planners know which combos drive revenue.
    - Implementation: Start with association rules (Apriori) or matrix factorization using only the orders +
      order_items; optionally leverage loyalty profiles once enough data accumulates.


• Here’s how we can turn the recommendation engine idea into a concrete roadmap, tailored to the repo’s current
  structure.

  ———

  ### 1. Data Foundation

  What we already have

  - orders and order_items tables with restaurant, session, customer, item IDs.
  - Loyalty data (restaurant_customers, vouchers) we can plug in later.

  Additions

  - Create a menu_recommendations schema/table to materialize item-pair stats (e.g., {restaurant_id, base_item_id,
    recommended_item_id, attach_rate, lift}).
  - If COGS/margins matter, extend menu_items with cost fields (not required for v1).

  ———

  ### 2. Generating Recommendations (offline job)

  Algorithm choice

  - Start simple: Association rules (Apriori or FP-Growth) work well on basket data. Libraries like mlxtend can
    generate item→item “lift” scores.
  - Upgrade path: Collaborative filtering/matrix factorization when we want user-specific recommendations.

  Pipeline steps

  1. Nightly ETL job:
      - Query order_items grouped by restaurant and order ID.
      - Build transactions (sets of menu item IDs per order).
  2. Run association rule mining per restaurant (and optionally per daypart).
  3. Store top N companions per base item in menu_recommendations.
  4. Optionally, track attach-rate time series (e.g., weekly) to detect shifts.

  Tech options

  - Scheduled script in /be/src/scripts using node + mlxtend via Python (child process) or a separate Python job.
  - Alternatively, implement the algorithm directly in JS if keeping dependencies minimal.

  ———

  ### 3. Serving Recommendations in the Customer App

  API layer

  - Add a backend endpoint /customer/recommendations?sessionToken=... that:
      - Looks up the current cart (items in session context).
      - Fetches recommendations from menu_recommendations (filter by items not already in cart).
      - Returns top 3–5 suggestions.

  Frontend integration

  - In CheckoutPage.jsx, display a “Recommended for you” bar under the cart summary with add-to-cart buttons.
  - Track analytics (e.g., emit events when a recommendation is shown/clicked) for future tuning.

  Personalization

  - If the session is tied to a loyalty member, add a filter using their history: boost items they’ve historically
    liked or categories aligned with their preferences.

  ———

  ### 4. Admin Attach-Rate Dashboard

  Backend

  - Extend the analytics pipeline to produce metrics:
      - Attach rate = orders containing both A and B / orders containing A.
      - Revenue lift, conversion by daypart, etc.
  - Provide an endpoint (/admin/menu/recommendations) returning top combos, trending up/down.

  Admin UI

  - In the Management page, add a panel with:
      - Top recommended pairs with metrics.
      - Filters by category, time range, restaurant.
      - Sparkline to show attach rate trend.

  ———

  ### 5. Iteration & Safeguards

  - Cold start: If an item has <X orders, fall back to category-level or global recommendations.
  - Diversity: Avoid recommending the same item repeatedly—cycle through top options.
  - Curation: Allow admins to pin/override recommendations in the dashboard.

  ———

  ### Rollout Plan

  | Phase | Deliverable |
  |-------|-------------|
  | v0    | Nightly association rules + display static “Popular add-ons” (no personalization) |
  | v1    | Session-aware suggestions in checkout; analytics table for attach rate |
  | v2    | Loyalty-aware ranking & admin dashboard controls |
  | v3    | Matrix factorization or sequence-based recommendations for repeat guests |

  This keeps complexity manageable: start with a batch job and minimal UI changes, then layer personalization as data
  grows. Let me know if you want a starter script or database migration drafted for Phase v0.