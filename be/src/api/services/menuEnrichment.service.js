import fs from 'node:fs';
import path from 'node:path';
import env from '../../config/env.js';
import logger from '../../config/logger.js';

const DEFAULT_RELATIVE_PATH = '../chat-infrastructure/rag_service/data/menu_items_enriched.json';

let enrichmentIndex = new Map();
let enrichmentPath = null;

const toArray = (value) => {
    if (Array.isArray(value)) {
        return value;
    }
    if (value === null || value === undefined) {
        return [];
    }
    return [value];
};

const normalizeItem = (raw) => {
    if (!raw || !raw.menu_item_id) {
        return null;
    }
    return {
        menuItemId: raw.menu_item_id,
        restaurantId: raw.restaurant_id || null,
        categoryId: raw.category_id || null,
        categoryName: raw.category_name || null,
        name: raw.name || null,
        spiceLevel: raw.spice_level ? String(raw.spice_level).toLowerCase() : null,
        dietaryTags: toArray(raw.dietary_tags).map((tag) => String(tag).toLowerCase()),
        allergens: toArray(raw.allergens).map((tag) => String(tag).toLowerCase()),
        keyIngredients: toArray(raw.key_ingredients).map((ingredient) => String(ingredient)),
        containsAlcohol: Boolean(raw.contains_alcohol),
        notes: raw.notes || ''
    };
};

const resolveCandidatePaths = () => {
    const candidates = [];
    if (env.menu?.enrichmentPath) {
        candidates.push(env.menu.enrichmentPath);
    }
    candidates.push(path.resolve(process.cwd(), DEFAULT_RELATIVE_PATH));
    return candidates;
};

const loadEnrichmentData = () => {
    const candidates = resolveCandidatePaths().filter(Boolean);
    const filePath = candidates.find((candidate) => {
        try {
            return fs.existsSync(candidate);
        } catch (error) {
            logger.warn('Unable to check enrichment path', { candidate, message: error.message });
            return false;
        }
    });

    if (!filePath) {
        enrichmentIndex = new Map();
        enrichmentPath = null;
        logger.warn('Menu enrichment data not found', { candidates });
        return;
    }

    try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        const items = Array.isArray(parsed?.items) ? parsed.items : Array.isArray(parsed) ? parsed : [];
        const nextIndex = new Map();
        items.forEach((item) => {
            const normalized = normalizeItem(item);
            if (!normalized) {
                return;
            }
            nextIndex.set(normalized.menuItemId, normalized);
        });
        enrichmentIndex = nextIndex;
        enrichmentPath = filePath;
        logger.info('Menu enrichment data loaded', { entries: enrichmentIndex.size, path: filePath });
    } catch (error) {
        enrichmentIndex = new Map();
        enrichmentPath = null;
        logger.error('Failed to load menu enrichment data', { message: error.message, path: filePath });
    }
};

loadEnrichmentData();

export const getMenuEnrichment = (menuItemId) => enrichmentIndex.get(menuItemId) || null;

export const hasMenuEnrichment = () => enrichmentIndex.size > 0;

export const getMenuEnrichmentSource = () => enrichmentPath;

export const reloadMenuEnrichment = () => loadEnrichmentData();
