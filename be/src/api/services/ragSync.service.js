import { Op } from 'sequelize';
import models from '../models/index.js';
import env from '../../config/env.js';
import logger from '../../config/logger.js';
import { PROMOTION_STATUS } from '../utils/common.js';

const { Restaurant, MenuCategory, MenuItem, Promotion } = models;

const RAG_HEADERS = Object.freeze({
    adminKey: 'x-rag-admin-key'
});

const ragSyncState = {
    lastRunAt: null,
    lastRunSummary: null,
    lastError: null,
    lastCacheFlushAt: null
};

let syncInProgress = false;
let scheduledJob = null;

const getBaseUrl = () => (env.rag?.baseUrl || '').replace(/\/$/, '');

const ensureRagConfigured = () => {
    const baseUrl = getBaseUrl();
    if (!baseUrl) {
        throw new Error('RAG service URL is not configured');
    }
    return baseUrl;
};

const buildHeaders = () => {
    const headers = { 'Content-Type': 'application/json' };
    if (env.rag?.adminKey) {
        headers[RAG_HEADERS.adminKey] = env.rag.adminKey;
    }
    return headers;
};

const callRag = async (path, payload = null, options = {}) => {
    const baseUrl = ensureRagConfigured();
    const url = `${baseUrl}${path}`;
    const response = await fetch(url, {
        method: options.method || 'POST',
        headers: buildHeaders(),
        body: payload ? JSON.stringify(payload) : undefined
    });

    if (!response.ok) {
        const body = await response.text();
        throw new Error(`RAG request failed (${response.status}): ${body || response.statusText}`);
    }

    if (response.status === 204) {
        return null;
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
        return null;
    }

    return response.json();
};

const formatAddress = (address) => {
    if (!address) {
        return null;
    }
    if (typeof address === 'string') {
        return address;
    }
    const parts = [
        address.line1,
        address.line2,
        address.city,
        address.state,
        address.postalCode,
        address.country
    ].filter(Boolean);
    return parts.length ? parts.join(', ') : null;
};

const formatBusinessHours = (hours) => {
    if (!hours || typeof hours !== 'object') {
        return null;
    }
    return Object.entries(hours)
        .map(([day, slots]) => {
            if (Array.isArray(slots) && slots.length > 0) {
                const formattedSlots = slots
                    .map((slot) => {
                        if (!slot || typeof slot !== 'object') {
                            return null;
                        }
                        if (slot.open && slot.close) {
                            return `${slot.open}–${slot.close}`;
                        }
                        return null;
                    })
                    .filter(Boolean);
                if (formattedSlots.length > 0) {
                    const label = day.charAt(0).toUpperCase() + day.slice(1);
                    return `${label}: ${formattedSlots.join(', ')}`;
                }
            }
            return null;
        })
        .filter(Boolean)
        .join('\n');
};

const buildRestaurantDocuments = (restaurants) =>
    restaurants
        .map((restaurant) => {
            const lines = [
                `Restaurant profile: ${restaurant.name}`,
                restaurant.status ? `Status: ${restaurant.status}` : null,
                restaurant.timezone ? `Timezone: ${restaurant.timezone}` : null,
                formatAddress(restaurant.address) ? `Address: ${formatAddress(restaurant.address)}` : null,
                formatBusinessHours(restaurant.businessHours)
                    ? `Business hours:\n${formatBusinessHours(restaurant.businessHours)}`
                    : null
            ].filter(Boolean);

            if (lines.length === 0) {
                return null;
            }

            return {
                text: lines.join('\n').trim(),
                metadata: {
                    restaurant_id: restaurant.id,
                    source_id: `restaurant:${restaurant.id}`,
                    tags: ['restaurant-info']
                }
            };
        })
        .filter(Boolean);

const buildPromotionDocuments = (promotions, restaurantMap) =>
    promotions
        .map((promotion) => {
            const restaurant = restaurantMap.get(promotion.restaurantId);
            if (!restaurant) {
                return null;
            }
            const startsAt = promotion.startsAt ? new Date(promotion.startsAt).toISOString() : null;
            const endsAt = promotion.endsAt ? new Date(promotion.endsAt).toISOString() : null;
            const lines = [
                `Promotion: ${promotion.name}`,
                `Restaurant: ${restaurant.name}`,
                promotion.headline ? `Headline: ${promotion.headline}` : null,
                promotion.description ? `Details: ${promotion.description}` : null,
                startsAt || endsAt ? `Schedule: ${startsAt || 'now'} → ${endsAt || 'open ended'}` : null,
                promotion.ctaLabel && promotion.ctaUrl
                    ? `CTA: ${promotion.ctaLabel} (${promotion.ctaUrl})`
                    : null
            ].filter(Boolean);

            if (lines.length === 0) {
                return null;
            }

            return {
                text: lines.join('\n').trim(),
                metadata: {
                    restaurant_id: restaurant.id,
                    source_id: `promotion:${promotion.id}`,
                    tags: ['promotion', promotion.status.toLowerCase()],
                    extras: {
                        startsAt,
                        endsAt,
                        status: promotion.status
                    }
                }
            };
        })
        .filter(Boolean);

const buildMenuDocuments = (categories, restaurantMap) => {
    const documents = [];
    categories.forEach((category) => {
        const restaurant = restaurantMap.get(category.restaurantId);
        if (!restaurant || !Array.isArray(category.items)) {
            return;
        }
        category.items.forEach((item) => {
            const price = Number.isFinite(item.priceCents) ? (item.priceCents / 100).toFixed(2) : 'N/A';
            const lines = [
                `Menu item: ${item.name}`,
                `Restaurant: ${restaurant.name}`,
                category.name ? `Category: ${category.name}` : null,
                `Price (USD): ${price}`,
                item.description ? `Description: ${item.description}` : null,
                item.sku ? `SKU: ${item.sku}` : null,
                typeof item.prepTimeSeconds === 'number'
                    ? `Prep time: ${Math.max(item.prepTimeSeconds, 0)} seconds`
                    : null
            ].filter(Boolean);
            if (lines.length === 0) {
                return;
            }
            documents.push({
                text: lines.join('\n').trim(),
                metadata: {
                    restaurant_id: restaurant.id,
                    source_id: `menu-item:${item.id}`,
                    tags: ['menu-item', category.name || 'menu'],
                    extras: {
                        categoryId: category.id,
                        priceCents: item.priceCents,
                        isAvailable: item.isAvailable
                    }
                }
            });
        });
    });
    return documents;
};

const chunkArray = (items, size) => {
    if (size <= 0) {
        return [items];
    }
    const chunks = [];
    for (let index = 0; index < items.length; index += size) {
        chunks.push(items.slice(index, index + size));
    }
    return chunks;
};

const resolveRestaurants = async (restaurantIds) => {
    const whereClause = {};
    if (Array.isArray(restaurantIds)) {
        if (restaurantIds.length === 0) {
            return [];
        }
        whereClause.id = { [Op.in]: restaurantIds };
    }

    const records = await Restaurant.findAll({
        where: Object.keys(whereClause).length ? whereClause : undefined
    });
    return records.map((record) => record.get({ plain: true }));
};

const loadPromotions = async (restaurantIds) => {
    const now = new Date();

    // Only load promotions that are currently valid based on dates
    // Don't rely on status field alone as it may not be updated yet
    const whereClause = {
        restaurantId: { [Op.in]: restaurantIds },
        [Op.and]: [
            // Must have started (or have no start date)
            {
                [Op.or]: [{ startsAt: null }, { startsAt: { [Op.lte]: now } }]
            },
            // Must not have ended yet (or have no end date)
            {
                [Op.or]: [{ endsAt: null }, { endsAt: { [Op.gt]: now } }]
            }
        ],
        // Exclude explicitly expired/inactive promotions
        status: { [Op.notIn]: [PROMOTION_STATUS.EXPIRED, PROMOTION_STATUS.INACTIVE] }
    };

    const records = await Promotion.findAll({
        where: whereClause,
        order: [['updatedAt', 'DESC']]
    });
    return records.map((record) => record.get({ plain: true }));
};

const loadMenuCategories = async (restaurantIds) => {
    const whereClause = {
        isActive: true,
        restaurantId: { [Op.in]: restaurantIds }
    };

    const records = await MenuCategory.findAll({
        where: whereClause,
        order: [
            ['restaurantId', 'ASC'],
            ['sortOrder', 'ASC']
        ],
        include: [
            {
                model: MenuItem,
                as: 'items',
                required: false,
                where: { isAvailable: true }
            }
        ]
    });
    return records.map((record) => record.get({ plain: true }));
};

const collectDocuments = async (restaurantIds) => {
    const restaurants = await resolveRestaurants(restaurantIds);
    if (restaurants.length === 0) {
        return { documents: [], restaurants };
    }
    const ids = restaurants.map((restaurant) => restaurant.id);
    const restaurantMap = new Map(restaurants.map((restaurant) => [restaurant.id, restaurant]));

    const [promotions, categories] = await Promise.all([loadPromotions(ids), loadMenuCategories(ids)]);

    logger.info('RAG Sync - Loaded data', {
        restaurantCount: restaurants.length,
        promotionCount: promotions.length,
        categoryCount: categories.length
    });

    if (promotions.length > 0) {
        logger.info('RAG Sync - Promotions loaded:', promotions.map(p => ({
            id: p.id,
            name: p.name,
            status: p.status,
            startsAt: p.startsAt,
            endsAt: p.endsAt
        })));
    }

    const restaurantDocs = buildRestaurantDocuments(restaurants);
    const promotionDocs = buildPromotionDocuments(promotions, restaurantMap);
    const menuDocs = buildMenuDocuments(categories, restaurantMap);

    logger.info('RAG Sync - Built documents', {
        restaurantDocs: restaurantDocs.length,
        promotionDocs: promotionDocs.length,
        menuDocs: menuDocs.length,
        total: restaurantDocs.length + promotionDocs.length + menuDocs.length
    });

    if (promotionDocs.length > 0) {
        logger.info('RAG Sync - Promotion documents:', promotionDocs.map(d => ({
            source_id: d.metadata.source_id,
            text_preview: d.text.substring(0, 100)
        })));
    }

    const documents = [
        ...restaurantDocs,
        ...promotionDocs,
        ...menuDocs
    ];

    return { documents, restaurants };
};

export const getRagSyncStatus = () => ({
    configured: Boolean(getBaseUrl()),
    syncing: syncInProgress,
    lastRunAt: ragSyncState.lastRunAt,
    lastRunSummary: ragSyncState.lastRunSummary,
    lastError: ragSyncState.lastError,
    lastCacheFlushAt: ragSyncState.lastCacheFlushAt,
    autoSync: {
        enabled: Boolean(env.rag?.autoSync?.enabled && getBaseUrl()),
        intervalMinutes: env.rag?.autoSync?.intervalMinutes || 60
    }
});

const updateLastRun = (summary) => {
    ragSyncState.lastRunAt = new Date().toISOString();
    ragSyncState.lastRunSummary = summary;
    ragSyncState.lastError = null;
};

export const flushRagCache = async () => {
    await callRag('/cache/flush');
    ragSyncState.lastCacheFlushAt = new Date().toISOString();
    return { flushedAt: ragSyncState.lastCacheFlushAt };
};

export const syncRagKnowledge = async ({ restaurantIds = undefined, flushCache = true } = {}) => {
    if (syncInProgress) {
        throw new Error('Knowledge sync is already running');
    }
    syncInProgress = true;
    try {
        const { documents, restaurants } = await collectDocuments(restaurantIds);
        if (restaurants.length === 0) {
            throw new Error('No restaurants available for knowledge sync');
        }

        let ingested = 0;
        if (documents.length > 0) {
            const batches = chunkArray(documents, 25);
            for (const batch of batches) {
                await callRag('/ingest', { documents: batch });
                ingested += batch.length;
            }
        }

        if (flushCache) {
            try {
                await flushRagCache();
            } catch (error) {
                logger.warn('Failed to flush RAG cache', { message: error.message });
            }
        }

        const summary = {
            restaurants: restaurants.length,
            documents: ingested
        };
        updateLastRun(summary);
        logger.info('Knowledge sync completed', summary);
        return summary;
    } catch (error) {
        ragSyncState.lastError = {
            message: error.message,
            at: new Date().toISOString()
        };
        logger.error('Knowledge sync failed', { message: error.message });
        throw error;
    } finally {
        syncInProgress = false;
    }
};

export const scheduleRagSyncJob = () => {
    if (scheduledJob || !env.rag?.autoSync?.enabled) {
        return;
    }
    try {
        ensureRagConfigured();
    } catch (error) {
        logger.warn('Skipping RAG auto-sync schedule', { message: error.message });
        return;
    }
    const intervalMinutes = Math.max(env.rag.autoSync.intervalMinutes || 60, 5);
    const intervalMs = intervalMinutes * 60 * 1000;
    scheduledJob = setInterval(async () => {
        try {
            await syncRagKnowledge();
        } catch (error) {
            logger.warn('Scheduled RAG sync failed', { message: error.message });
        }
    }, intervalMs);
    logger.info('Scheduled automatic RAG sync', { intervalMinutes });
};
