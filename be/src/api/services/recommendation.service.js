import { Op } from 'sequelize';
import crypto from 'crypto';
import models from '../models/index.js';
import logger from '../../config/logger.js';

const {
    sequelize,
    Restaurant,
    MenuCategory,
    MenuItem,
    Order,
    OrderItem,
    MenuRecommendation,
    GuestSession
} = models;

const DEFAULT_OPTIONS = Object.freeze({
    minSupport: 0.01,
    minConfidence: 0.1,
    minAttachRate: 0.1,
    topRecommendationsPerItem: 5,
    syntheticTransactionsPerItem: 35,
    syntheticComboWeight: 0.65,
    includeHistoricalOrders: true
});

const clampDecimal = (value) => {
    if (!Number.isFinite(value)) {
        return 0;
    }
    return Number.parseFloat(value.toFixed(6));
};

const toNumber = (value) => {
    if (value === null || value === undefined) {
        return 0;
    }
    const parsed = Number.parseFloat(value);
    return Number.isNaN(parsed) ? 0 : parsed;
};

const runApriori = (transactions, { minSupport, minConfidence, generatedAtIso }) => {
    const totalTransactions = transactions.length;
    if (totalTransactions === 0) {
        return [];
    }

    const itemCounts = new Map();
    const pairCounts = new Map();

    const normalizeTransaction = (transaction) => {
        if (!transaction) {
            return null;
        }
        if (Array.isArray(transaction)) {
            return { items: transaction, source: 'historical' };
        }
        if (!Array.isArray(transaction.items)) {
            return null;
        }
        return {
            items: transaction.items,
            source: transaction.source || 'historical'
        };
    };

    transactions.forEach((raw) => {
        const txn = normalizeTransaction(raw);
        if (!txn) {
            return;
        }
        const uniqueItems = Array.from(new Set(txn.items.filter(Boolean)));
        if (uniqueItems.length < 2) {
            uniqueItems.forEach((itemId) => {
                const entry = itemCounts.get(itemId) || { total: 0, synthetic: 0, historical: 0 };
                entry.total += 1;
                entry[txn.source] = (entry[txn.source] || 0) + 1;
                itemCounts.set(itemId, entry);
            });
            return;
        }

        uniqueItems.forEach((itemId) => {
            const entry = itemCounts.get(itemId) || { total: 0, synthetic: 0, historical: 0 };
            entry.total += 1;
            entry[txn.source] = (entry[txn.source] || 0) + 1;
            itemCounts.set(itemId, entry);
        });

        for (let i = 0; i < uniqueItems.length - 1; i += 1) {
            for (let j = i + 1; j < uniqueItems.length; j += 1) {
                const [a, b] = uniqueItems[i] < uniqueItems[j] ? [uniqueItems[i], uniqueItems[j]] : [uniqueItems[j], uniqueItems[i]];
                const key = `${a}|${b}`;
                const entry = pairCounts.get(key) || { total: 0, synthetic: 0, historical: 0 };
                entry.total += 1;
                entry[txn.source] = (entry[txn.source] || 0) + 1;
                pairCounts.set(key, entry);
            }
        }
    });

    const rules = [];

    pairCounts.forEach((pairEntry, key) => {
        const [a, b] = key.split('|');
        const pairSupportCount = pairEntry.total;
        const support = pairSupportCount / totalTransactions;
        if (support < minSupport) {
            return;
        }
        const infoA = itemCounts.get(a) || { total: 0 };
        const infoB = itemCounts.get(b) || { total: 0 };
        if (!infoA.total || !infoB.total) {
            return;
        }

        const probA = infoA.total / totalTransactions;
        const probB = infoB.total / totalTransactions;

        const confidenceAtoB = pairSupportCount / infoA.total;
        if (confidenceAtoB >= minConfidence) {
            const liftAtoB = confidenceAtoB / (probB || Number.EPSILON);
            rules.push({
                baseItemId: a,
                recommendedItemId: b,
                support,
                confidence: confidenceAtoB,
                attachRate: confidenceAtoB,
                lift: liftAtoB,
                supportCount: pairSupportCount,
                metadata: {
                    algorithm: 'apriori',
                    generatedAt: generatedAtIso,
                    sources: { ...pairEntry },
                    baseSupport: { ...infoA },
                    recommendedSupport: { ...infoB },
                    totalTransactions
                }
            });
        }

        const confidenceBtoA = pairSupportCount / infoB.total;
        if (confidenceBtoA >= minConfidence) {
            const liftBtoA = confidenceBtoA / (probA || Number.EPSILON);
            rules.push({
                baseItemId: b,
                recommendedItemId: a,
                support,
                confidence: confidenceBtoA,
                attachRate: confidenceBtoA,
                lift: liftBtoA,
                supportCount: pairSupportCount,
                metadata: {
                    algorithm: 'apriori',
                    generatedAt: generatedAtIso,
                    sources: { ...pairEntry },
                    baseSupport: { ...infoB },
                    recommendedSupport: { ...infoA },
                    totalTransactions
                }
            });
        }
    });

    return rules;
};

const randomFromArray = (items) => {
    if (!Array.isArray(items) || items.length === 0) {
        return null;
    }
    const index = Math.floor(Math.random() * items.length);
    return items[index];
};

const pickNFromArray = (items, n) => {
    if (!Array.isArray(items) || items.length === 0 || n <= 0) {
        return [];
    }
    if (n >= items.length) {
        return [...items];
    }
    const copy = [...items];
    const picked = [];
    while (picked.length < n && copy.length > 0) {
        const index = Math.floor(Math.random() * copy.length);
        picked.push(copy.splice(index, 1)[0]);
    }
    return picked;
};

const buildSyntheticTransactions = (restaurant, menuItems, options) => {
    const transactions = [];
    if (!Array.isArray(menuItems) || menuItems.length < 2) {
        return transactions;
    }

    const { syntheticTransactionsPerItem, syntheticComboWeight } = options;
    const generatedAt = new Date().toISOString();
    const totalTarget = Math.max(syntheticTransactionsPerItem * menuItems.length, 100);
    const categories = new Map();

    menuItems.forEach((item) => {
        const categoryId = item.categoryId || 'uncategorised';
        if (!categories.has(categoryId)) {
            categories.set(categoryId, []);
        }
        categories.get(categoryId).push(item);
    });

    const categoryList = Array.from(categories.values()).filter((list) => list.length > 0);
    const focusPairs = [];

    menuItems.forEach((item) => {
        const companionPool = menuItems.filter((candidate) => candidate.id !== item.id);
        const companions = pickNFromArray(companionPool, Math.max(2, Math.floor(companionPool.length * 0.15)));
        companions.forEach((companion) => {
            focusPairs.push([item.id, companion.id]);
        });
    });

    for (let i = 0; i < totalTarget; i += 1) {
        const leverageCombo = Math.random() < syntheticComboWeight;
        let itemsInOrder = [];

        if (leverageCombo && focusPairs.length > 0) {
            const pair = randomFromArray(focusPairs);
            if (Array.isArray(pair) && pair.length === 2) {
                itemsInOrder = [...pair];
            }

            if (Math.random() < 0.5) {
                const extra = randomFromArray(menuItems)?.id;
                if (extra && !itemsInOrder.includes(extra)) {
                    itemsInOrder.push(extra);
                }
            }
        }

        if (itemsInOrder.length < 2) {
            const categorySample = randomFromArray(categoryList);
            const size = 2 + Math.floor(Math.random() * 3);
            const pool = Array.isArray(categorySample) && categorySample.length >= 2 ? categorySample : menuItems;
            const selected = pickNFromArray(pool, size);
            itemsInOrder = selected.map((item) => item.id);
        }

        if (itemsInOrder.length >= 2) {
            transactions.push({
                items: itemsInOrder,
                source: 'synthetic',
                generatedAt
            });
        }
    }

    logger.debug('Generated synthetic transactions', {
        restaurantId: restaurant.id,
        restaurantName: restaurant.name,
        syntheticCount: transactions.length
    });

    return transactions;
};

const loadHistoricalTransactions = async (restaurantId) => {
    const rows = await OrderItem.findAll({
        attributes: ['orderId', 'menuItemId'],
        include: [
            {
                model: Order,
                as: 'order',
                attributes: [],
                where: {
                    restaurantId,
                    status: {
                        [Op.notIn]: ['CANCELLED']
                    }
                },
                required: true
            }
        ],
        raw: true
    });

    if (!rows.length) {
        return [];
    }

    const grouped = rows.reduce((acc, row) => {
        const orderId = row.orderId;
        if (!acc.has(orderId)) {
            acc.set(orderId, new Set());
        }
        acc.get(orderId).add(row.menuItemId);
        return acc;
    }, new Map());

    return Array.from(grouped.values())
        .map((set) => Array.from(set))
        .filter((items) => items.length >= 2)
        .map((items) => ({ items, source: 'historical' }));
};

const replaceMenuRecommendations = async (restaurantId, recommendations, transaction) => {
    await MenuRecommendation.destroy({
        where: { restaurantId },
        transaction
    });

    if (!recommendations.length) {
        return 0;
    }

    const payload = recommendations.map((rule) => ({
        restaurantId,
        baseItemId: rule.baseItemId,
        recommendedItemId: rule.recommendedItemId,
        support: clampDecimal(rule.support),
        confidence: clampDecimal(rule.confidence),
        attachRate: clampDecimal(rule.attachRate),
        lift: clampDecimal(rule.lift),
        supportCount: rule.supportCount,
        metadata: rule.metadata || null
    }));

    await MenuRecommendation.bulkCreate(payload, { transaction });
    return payload.length;
};

const curateRules = (rules, { topRecommendationsPerItem, minAttachRate }) => {
    if (!Array.isArray(rules) || rules.length === 0) {
        return [];
    }

    const grouped = rules.reduce((acc, rule) => {
        if (rule.attachRate < minAttachRate) {
            return acc;
        }
        if (!acc.has(rule.baseItemId)) {
            acc.set(rule.baseItemId, []);
        }
        acc.get(rule.baseItemId).push(rule);
        return acc;
    }, new Map());

    const curated = [];

    grouped.forEach((list, baseItemId) => {
        const sorted = [...list].sort((a, b) => {
            if (b.lift !== a.lift) {
                return b.lift - a.lift;
            }
            if (b.confidence !== a.confidence) {
                return b.confidence - a.confidence;
            }
            return (b.supportCount || 0) - (a.supportCount || 0);
        });
        sorted.slice(0, topRecommendationsPerItem).forEach((rule) => {
            curated.push(rule);
        });
    });

    return curated;
};

export const rebuildMenuRecommendations = async (options = {}) => {
    const settings = { ...DEFAULT_OPTIONS, ...options };
    const generatedAtIso = new Date().toISOString();
    const restaurants = await Restaurant.findAll({
        attributes: ['id', 'name'],
        include: [
            {
                model: MenuCategory,
                as: 'categories',
                required: true,
                include: [{ model: MenuItem, as: 'items', required: true }]
            }
        ]
    });

    const summary = [];

    for (const restaurant of restaurants) {
        const plainCategories = restaurant.categories.map((category) => category.get({ plain: true }));
        const menuItems = plainCategories.flatMap((category) =>
            (category.items || []).map((item) => ({
                ...item,
                categoryId: category.id
            }))
        );

        if (menuItems.length < 2) {
            summary.push({
                restaurantId: restaurant.id,
                restaurantName: restaurant.name,
                recommendations: 0,
                reason: 'NOT_ENOUGH_MENU_ITEMS'
            });
            continue;
        }

        const transactions = [];
        let historicalCount = 0;
        if (settings.includeHistoricalOrders) {
            const historical = await loadHistoricalTransactions(restaurant.id);
            historicalCount = historical.length;
            transactions.push(...historical);
        }

        const synthetic = buildSyntheticTransactions(restaurant, menuItems, settings);
        const syntheticCount = synthetic.length;
        transactions.push(...synthetic);

        if (!transactions.length) {
            summary.push({
                restaurantId: restaurant.id,
                restaurantName: restaurant.name,
                recommendations: 0,
                reason: 'NO_TRANSACTIONS'
            });
            continue;
        }

        const rules = runApriori(transactions, {
            minSupport: settings.minSupport,
            minConfidence: settings.minConfidence,
            generatedAtIso
        });
        const curated = curateRules(rules, settings);

        await sequelize.transaction(async (transaction) => {
            await replaceMenuRecommendations(
                restaurant.id,
                curated.map((rule) => ({
                    ...rule,
                    metadata: {
                        ...rule.metadata,
                        runId: settings.runId || crypto.randomUUID(),
                        historicalTransactions: historicalCount,
                        syntheticTransactions: syntheticCount
                    }
                })),
                transaction
            );
        });

        summary.push({
            restaurantId: restaurant.id,
            restaurantName: restaurant.name,
            recommendations: curated.length,
            transactions: transactions.length,
            syntheticTransactions: syntheticCount,
            historicalTransactions: historicalCount
        });
    }

    return summary;
};

export const getRecommendationsForRestaurant = async (
    restaurantId,
    baseItemIds,
    { excludeItemIds = [], limit = 5 } = {}
) => {
    if (!restaurantId || !Array.isArray(baseItemIds) || baseItemIds.length === 0) {
        return [];
    }

    const exclusions = new Set(excludeItemIds);

    const recommendations = await MenuRecommendation.findAll({
        where: {
            restaurantId,
            baseItemId: {
                [Op.in]: baseItemIds
            },
            recommendedItemId: {
                [Op.notIn]: Array.from(exclusions)
            }
        },
        include: [
            {
                model: MenuItem,
                as: 'recommendedItem',
                required: true,
                where: {
                    isAvailable: true
                },
                include: [
                    {
                        model: MenuCategory,
                        as: 'category',
                        required: false
                    }
                ]
            }
        ],
        order: [
            ['lift', 'DESC'],
            ['confidence', 'DESC'],
            ['supportCount', 'DESC']
        ],
        limit: limit * Math.max(baseItemIds.length, 1)
    });

    const seen = new Set();
    const results = [];

    recommendations.forEach((record) => {
        if (!record.recommendedItem) {
            return;
        }
        if (seen.has(record.recommendedItemId)) {
            return;
        }
        if (exclusions.has(record.recommendedItemId)) {
            return;
        }
        seen.add(record.recommendedItemId);
        results.push({
            baseItemId: record.baseItemId,
            recommendedItemId: record.recommendedItemId,
            score: Number.parseFloat(record.lift),
            attachRate: Number.parseFloat(record.attachRate),
            confidence: Number.parseFloat(record.confidence),
            support: Number.parseFloat(record.support),
            supportCount: record.supportCount,
            menuItem: {
                id: record.recommendedItem.id,
                name: record.recommendedItem.name,
                description: record.recommendedItem.description,
                priceCents: record.recommendedItem.priceCents,
                imageUrl: record.recommendedItem.imageUrl,
                category: record.recommendedItem.category
                    ? {
                          id: record.recommendedItem.category.id,
                          name: record.recommendedItem.category.name
                      }
                    : null
            }
        });
    });

    return results.slice(0, limit);
};

export const listRecommendationAnalytics = async (restaurantIds = [], options = {}) => {
    const permittedRestaurants = Array.isArray(restaurantIds) ? restaurantIds.filter(Boolean) : [];
    const where = {};
    const restaurantConditions = [];

    if (permittedRestaurants.length > 0) {
        restaurantConditions.push({ restaurantId: { [Op.in]: permittedRestaurants } });
    }

    if (options.restaurantId) {
        restaurantConditions.push({ restaurantId: options.restaurantId });
    }

    if (Array.isArray(options.excludeRestaurantIds) && options.excludeRestaurantIds.length > 0) {
        restaurantConditions.push({ restaurantId: { [Op.notIn]: options.excludeRestaurantIds } });
    }

    if (restaurantConditions.length === 1) {
        Object.assign(where, restaurantConditions[0]);
    } else if (restaurantConditions.length > 1) {
        where[Op.and] = restaurantConditions;
    }

    const minAttachRate = options.minAttachRate ?? 0;
    const limit = Math.min(options.limit ?? 150, 500);

    const records = await MenuRecommendation.findAll({
        where,
        include: [
            { model: Restaurant, as: 'restaurant', attributes: ['id', 'name'] },
            {
                model: MenuItem,
                as: 'baseItem',
                include: [{ model: MenuCategory, as: 'category', attributes: ['id', 'name'] }]
            },
            {
                model: MenuItem,
                as: 'recommendedItem',
                include: [{ model: MenuCategory, as: 'category', attributes: ['id', 'name'] }]
            }
        ],
        order: [
            ['lift', 'DESC'],
            ['confidence', 'DESC'],
            ['supportCount', 'DESC']
        ],
        limit
    });

    const seenRestaurants = new Map();
    const rows = [];
    let attachRateTotal = 0;
    let liftTotal = 0;
    let confidenceTotal = 0;
    let lastUpdatedAt = null;

    records.forEach((record) => {
        const attachRate = toNumber(record.attachRate);
        if (attachRate < minAttachRate) {
            return;
        }
        const confidence = toNumber(record.confidence);
        const lift = toNumber(record.lift);
        const support = toNumber(record.support);

        const baseItem = record.baseItem ? record.baseItem.get({ plain: true }) : null;
        const recommendedItem = record.recommendedItem ? record.recommendedItem.get({ plain: true }) : null;
        const restaurant = record.restaurant ? record.restaurant.get({ plain: true }) : null;

        if (restaurant && !seenRestaurants.has(restaurant.id)) {
            seenRestaurants.set(restaurant.id, restaurant);
        }

        const updatedAtIso =
            record.updatedAt instanceof Date
                ? record.updatedAt.toISOString()
                : record.updatedAt
                  ? new Date(record.updatedAt).toISOString()
                  : null;
        if (updatedAtIso && (!lastUpdatedAt || updatedAtIso > lastUpdatedAt)) {
            lastUpdatedAt = updatedAtIso;
        }

        const recommendedPrice = recommendedItem?.priceCents ?? 0;
        const estimatedIncrementalRevenueCents = Math.round(recommendedPrice * attachRate);
        const projectedPairRevenueCents = Math.round(recommendedPrice * (record.supportCount || 0));

        attachRateTotal += attachRate;
        liftTotal += lift;
        confidenceTotal += confidence;

        rows.push({
            id: `${record.restaurantId}-${record.baseItemId}-${record.recommendedItemId}`,
            restaurant,
            baseItem: baseItem
                ? {
                      id: baseItem.id,
                      name: baseItem.name,
                      priceCents: baseItem.priceCents,
                      category: baseItem.category ? { id: baseItem.category.id, name: baseItem.category.name } : null
                  }
                : null,
            companionItem: recommendedItem
                ? {
                      id: recommendedItem.id,
                      name: recommendedItem.name,
                      priceCents: recommendedItem.priceCents,
                      category: recommendedItem.category
                          ? { id: recommendedItem.category.id, name: recommendedItem.category.name }
                          : null
                  }
                : null,
            attachRate,
            confidence,
            lift,
            support,
            supportCount: record.supportCount,
            estimatedIncrementalRevenueCents,
            projectedPairRevenueCents,
            metadata: record.metadata || null,
            updatedAt: updatedAtIso
        });
    });

    rows.forEach((row, index) => {
        row.rank = index + 1;
    });

    return {
        summary: {
            totalPairs: rows.length,
            averageAttachRate: rows.length ? clampDecimal(attachRateTotal / rows.length) : 0,
            averageConfidence: rows.length ? clampDecimal(confidenceTotal / rows.length) : 0,
            averageLift: rows.length ? clampDecimal(liftTotal / rows.length) : 0,
            lastUpdatedAt
        },
        restaurants: Array.from(seenRestaurants.values()),
        rows
    };
};

export const getCartRecommendations = async (sessionToken, cartItemIds = [], options = {}) => {
    if (!sessionToken) {
        throw new Error('Session token is required');
    }

    const session = await GuestSession.findOne({
        where: { sessionToken },
        include: [{ model: Restaurant, as: 'restaurant' }]
    });

    if (!session || session.closedAt) {
        throw new Error('Session is not active');
    }

    const uniqueItems = Array.from(new Set(cartItemIds.filter(Boolean)));
    const exclusionSet = new Set([...(options.excludeItemIds || []), ...uniqueItems]);
    const recommendations = await getRecommendationsForRestaurant(session.restaurantId, uniqueItems, {
        ...options,
        excludeItemIds: Array.from(exclusionSet)
    });

    return {
        restaurant: session.restaurant ? { id: session.restaurant.id, name: session.restaurant.name } : null,
        cartItems: uniqueItems,
        recommendations
    };
};
