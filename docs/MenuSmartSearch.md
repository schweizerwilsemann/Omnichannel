# Smart Menu Search

## Concept

Guests can now describe cravings in natural language (e.g., “I want some spicy dishes”, “Need cold drinks”) and receive curated matches from the active restaurant menu. The request flows through `GET /customer/menu/search?sessionToken=<uuid>&query=<text>`, guarded by Joi validation and the usual guest-session lookup, so every search stays scoped to a single restaurant/table.

## Enrichment Data

- The service reuses the curated metadata produced for the vector-similarity pipeline (`chat-infrastructure/rag_service/data/menu_items_enriched.json`).
- `be/src/api/services/menuEnrichment.service.js` loads this JSON on server start (path configurable via `MENU_ENRICHMENT_PATH`), normalizes each record (spice level, dietary tags, allergens, key ingredients, category names, alcohol flag), and caches it in-memory.
- When no enrichment file is found, the endpoint still responds with `available: false`, enabling the UI to display “smart search isn’t enabled yet”.

## Request Handling

`searchMenuItems` (`be/src/api/services/menuSearch.service.js`) performs the heavy lifting:

1. Tokenizes the query, removes stop words, and determines intents:
   - Course hints: beverage, dessert, appetizer, salad, soup, pasta, entrée.
   - Temperature (“cold”, “warm”), spice preference (“spicy”, “mild”).
   - Alcohol allowance (cocktail vs. mocktail verbiage).
   - Dietary needs (vegetarian, vegan) and allergen avoidance (gluten, dairy, tree-nut, shellfish).
   - Ingredient focus (seafood/steak/chicken/pasta/salad/soup/dessert).
2. Fetches all available menu items for the restaurant (with their categories) and pairs them with enrichment metadata.
3. Builds a searchable “haystack” string per item and runs hard filters (e.g., vegetarian request vs. meat keywords, gluten-free vs. gluten allergens, alcohol-free vs. boozy cocktails).

## Scoring & Results

Each surviving item receives additive scores:

- Query token overlap with the haystack (name, description, tags, notes).
- Course alignment (e.g., beverages satisfying “cold drinks”).
- Spice/temperature matches driven by enrichment attributes.
- Alcohol preference satisfaction.
- Ingredient focus hits (e.g., seafood keywords).
- Bonus points for meeting dietary requirements (vegetarian/vegan tags) with a matching reason chip.

Items scoring ≤0.5 are discarded. The rest are sorted by score (ties break alphabetically) and trimmed to the requested limit (1–12, default 6). Every result includes:

- Menu basics: id, name, description, price, normalized image URL, category.
- Enrichment snippets: spice level, dietary tags, alcohol flag.
- Diagnostics: `matchScore` and up to four `matchReasons` (e.g., “Bold spice profile”, “Served chilled or refreshing”).

## Frontend Experience

`MenuSearch.jsx` renders directly under the quick-filter chips on the customer menu page:

- A text field plus “smart suggestion” chips (“Show me spicy dishes”, “I want some cold drinks”, “Any vegetarian pasta?”, “Need gluten-free options”).
- Result cards showing imagery, category, description, pill badges (spice + dietary), reason chips, formatted price, and an “Add to cart” button wired into the existing cart context.
- Friendly empty/error states: loading spinner, feature-disabled notice, validation error (“describe what you’re craving”), and “No matches found for …”.

## Operational Notes

- Keep the enrichment dataset in sync with reality: rerun the export → augment → similarity scripts whenever the menu changes, or wire a proper syncing mechanism.
- Set `MENU_ENRICHMENT_PATH` in `.env` if the deployment layout differs from the default monorepo path.
- Future upgrades: persist enrichment in the database, incorporate the Qdrant embeddings for true semantic similarity, and capture search telemetry to improve ranking models over time.
