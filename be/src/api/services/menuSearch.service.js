import models from '../models/index.js';
import env from '../../config/env.js';
import logger from '../../config/logger.js';
import qdrantClient from '../../config/qdrant.js';
import { MENU_QUERY_RESOLUTION_STATUS } from '../utils/common.js';
import { normalizeAssetUrl } from './storage.service.js';
import { getMenuEnrichment, hasMenuEnrichment } from './menuEnrichment.service.js';
import { embedText } from './embedding.service.js';

const {
    GuestSession,
    MenuItem,
    MenuCategory,
    MenuQueryLog,
    MenuQueryCandidate,
    MenuQueryClarification,
    sequelize
} = models;

const VECTOR_COLLECTION = env.vector?.qdrant?.collection || null;
const HAS_VECTOR_SEARCH = Boolean(qdrantClient && VECTOR_COLLECTION && env.vector?.embedding?.baseUrl);
const VECTOR_WEIGHT = 5.5;
const VECTOR_CANDIDATE_LIMIT = 24;

const STOP_WORDS = new Set([
    'i',
    'me',
    'my',
    'want',
    'some',
    'something',
    'please',
    'show',
    'give',
    'with',
    'and',
    'or',
    'for',
    'the',
    'a',
    'an',
    'to',
    'of',
    'any',
    'maybe',
    'like',
    'just',
    'little',
    'bit'
]);

const COURSE_KEYWORDS = {
    beverage: ['drink', 'drinks', 'beverage', 'cocktail', 'cocktails', 'mocktail', 'juice', 'soda', 'spritz', 'wine', 'beer', 'espresso', 'coffee'],
    dessert: ['dessert', 'sweet', 'cake', 'gelato', 'tiramisu', 'panna', 'cotta', 'brulee', 'sorbet', 'brownie'],
    appetizer: ['appetizer', 'starter', 'snack', 'shareable', 'tapas'],
    salad: ['salad', 'greens', 'arugula'],
    soup: ['soup', 'bisque', 'broth'],
    pasta: ['pasta', 'spaghetti', 'rigatoni', 'tagliatelle', 'ravioli', 'gnocchi'],
    entree: ['main', 'entree', 'dinner', 'steak', 'fish', 'seafood', 'chicken', 'lamb']
};

const TEMPERATURE_KEYWORDS = {
    cold: ['cold', 'iced', 'chilled', 'refreshing', 'cool', 'frozen'],
    warm: ['warm', 'cozy', 'comforting', 'hearty']
};

const SPICE_KEYWORDS = {
    bold: ['spicy', 'spice', 'fiery', 'peppery', 'kick', 'heat', 'chili'],
    mild: ['mild', 'gentle', 'not spicy', 'no spice', 'light spice']
};

const DIETARY_KEYWORDS = {
    vegetarian: ['vegetarian', 'veggie'],
    vegan: ['vegan', 'plant based', 'plant-based'],
    glutenFree: ['gluten-free', 'gluten free', 'no gluten'],
    dairyFree: ['dairy-free', 'dairy free', 'lactose-free', 'lactose free'],
    nutFree: ['nut-free', 'nut free', 'no nuts', 'peanut-free', 'peanut free'],
    shellfishFree: ['shellfish-free', 'shellfish free', 'no shellfish']
};

const INGREDIENT_SYNONYMS = {
    seafood: ['seafood', 'lobster', 'shrimp', 'prawn', 'crab', 'scallop', 'salmon', 'tuna'],
    steak: ['steak', 'beef', 'ribeye', 'filet', 'tenderloin', 'short rib'],
    chicken: ['chicken', 'pollo'],
    pasta: ['pasta', 'spaghetti', 'rigatoni', 'tagliatelle', 'ravioli', 'gnocchi', 'penne'],
    salad: ['salad', 'greens', 'arugula', 'spinach'],
    soup: ['soup', 'bisque', 'broth', 'veloute'],
    dessert: ['dessert', 'cake', 'gelato', 'panna cotta', 'tiramisu', 'brulee', 'sorbet']
};

const MEAT_KEYWORDS = ['steak', 'beef', 'chicken', 'lamb', 'pork', 'salmon', 'tuna', 'lobster', 'shrimp', 'crab', 'prosciutto', 'bacon'];

const buildWordRegex = (phrase) => new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');

const toFixedNumber = (value, precision = 3) => {
    if (!Number.isFinite(value)) {
        return 0;
    }
    const multiplier = 10 ** precision;
    return Math.round(value * multiplier) / multiplier;
};

const serializeIntents = (intents) => {
    if (!intents) {
        return null;
    }
    return {
        courses: Array.from(intents.courses || []),
        temperature: intents.temperature || null,
        spice: intents.spice || null,
        alcoholPreference: intents.alcoholPreference ?? null,
        requireDietary: Array.from(intents.requireDietary || []),
        avoidAllergens: Array.from(intents.avoidAllergens || []),
        ingredientFocus: Array.from(intents.ingredientFocus || [])
    };
};

const computeAmbiguityScore = (scores) => {
    const [topScore, secondScore] = scores;
    if (!topScore || topScore <= 0) {
        return scores.length === 0 ? 1 : 0;
    }
    if (!secondScore || secondScore <= 0) {
        return 0;
    }
    const ratio = Math.min(Math.max(secondScore / (topScore || Number.EPSILON), 0), 1);
    return toFixedNumber(ratio);
};

const formatListWithOr = (items) => {
    if (!Array.isArray(items) || items.length === 0) {
        return '';
    }
    if (items.length === 1) {
        return items[0];
    }
    if (items.length === 2) {
        return `${items[0]} or ${items[1]}`;
    }
    const head = items.slice(0, -1).join(', ');
    const tail = items[items.length - 1];
    return `${head}, or ${tail}`;
};

const buildClarificationDetails = (scored, tokens) => {
    if (!Array.isArray(scored) || scored.length === 0) {
        return { prompt: null, options: [] };
    }

    const categories = new Set();
    const ingredientHints = new Set();

    scored.slice(0, 4).forEach(({ item, enrichment }) => {
        const categoryName = item.category?.name || enrichment?.categoryName;
        if (categoryName) {
            categories.add(categoryName);
        }
        (enrichment?.keyIngredients || []).forEach((ingredient) => {
            if (ingredient && ingredient.length <= 40) {
                ingredientHints.add(ingredient);
            }
        });
    });

    if (categories.size > 1) {
        const sample = Array.from(categories).slice(0, 3);
        return {
            prompt: `Would you like to focus on ${formatListWithOr(sample)}?`,
            options: sample
        };
    }

    if ((tokens || []).length <= 1) {
        const suggestions = Array.from(ingredientHints);
        if (suggestions.length === 0) {
            scored.slice(0, 3).forEach(({ item }) => {
                if (item.name && item.name.length <= 60) {
                    ingredientHints.add(item.name);
                }
            });
        }
        return {
            prompt: "Could you share key ingredients or the flavor profile you're craving?",
            options: Array.from(ingredientHints).slice(0, 4)
        };
    }

    return {
        prompt: 'Could you add a bit more detail (for example spice level or dish style)?',
        options: []
    };
};

const logMenuQuery = async ({
    session,
    rawQuery,
    normalizedQuery,
    tokens,
    intents,
    scored,
    totalMatches,
    limit,
    metadata,
    ambiguityScore,
    resolutionStatus,
    fallbackReason,
    needsClarification,
    clarificationPrompt,
    clarificationOptions
}) => {
    if (!MenuQueryLog || !MenuQueryCandidate) {
        return null;
    }

    try {
        let clarificationId = null;

        await sequelize.transaction(async (transaction) => {
            const topScore = scored[0]?.score || 0;
            const secondScore = scored[1]?.score || 0;

            const logEntry = await MenuQueryLog.create(
                {
                    restaurantId: session.restaurantId,
                    guestSessionId: session.id,
                    customerId: session.customerId || null,
                    rawQuery,
                    normalizedQuery,
                    tokens,
                    intents: serializeIntents(intents),
                    metadata,
                    ambiguityScore,
                    topScore: toFixedNumber(topScore),
                    secondScore: toFixedNumber(secondScore),
                    totalCandidates: totalMatches,
                    limit,
                    resolutionStatus,
                    resolvedItemId: scored[0]?.item?.id || null,
                    fallbackReason,
                    triggeredClarification: resolutionStatus === MENU_QUERY_RESOLUTION_STATUS.CLARIFIED
                },
                { transaction }
            );

            if (!scored.length) {
                return;
            }

            const candidates = scored.map(({ item, score, reasons, vectorScore }, index) => ({
                queryLogId: logEntry.id,
                menuItemId: item.id,
                rank: index + 1,
                recallScore: vectorScore ? toFixedNumber(vectorScore, 4) : null,
                finalScore: toFixedNumber(score, 4),
                reasons,
                selected: index < limit
            }));

            await MenuQueryCandidate.bulkCreate(candidates, { transaction });

            if (
                needsClarification &&
                clarificationPrompt &&
                MenuQueryClarification
            ) {
                const clarification = await MenuQueryClarification.create(
                    {
                        queryLogId: logEntry.id,
                        questionText: clarificationPrompt,
                        metadata: {
                            options: clarificationOptions || []
                        }
                    },
                    { transaction }
                );

                clarificationId = clarification.id;
            }
        });
        return clarificationId;
    } catch (error) {
        logger.warn('Failed to record menu query analytics', { message: error.message });
    }
    return null;
};

const vectorSearchMenuItems = async (restaurantId, query, options = {}) => {
    if (!HAS_VECTOR_SEARCH || !restaurantId || !query) {
        return [];
    }
    const limit = Math.min(Math.max(options.limit || VECTOR_CANDIDATE_LIMIT, 1), 48);
    try {
        const embedding = await embedText(query);
        if (!Array.isArray(embedding) || embedding.length === 0) {
            return [];
        }

        const filter = {
            must: [
                {
                    key: 'restaurant_id',
                    match: { value: restaurantId }
                }
            ]
        };

        const results = await qdrantClient.search(VECTOR_COLLECTION, {
            vector: embedding,
            limit,
            with_payload: true,
            filter
        });

        return (results || [])
            .map((hit, index) => {
                const payload = hit?.payload || {};
                const menuItemId = payload.menu_item_id || hit?.id;
                if (!menuItemId) {
                    return null;
                }
                const similarity = typeof hit.score === 'number' ? hit.score : 0;
                return {
                    menuItemId,
                    score: similarity,
                    payload,
                    rank: index + 1
                };
            })
            .filter(Boolean);
    } catch (error) {
        logger.warn('Vector search failed', { message: error.message });
        return [];
    }
};

const tokenizeQuery = (query) => {
    const normalized = query.toLowerCase();
    const tokens = normalized
        .split(/[^a-z0-9]+/i)
        .map((token) => token.trim())
        .filter((token) => token && !STOP_WORDS.has(token));

    return { normalized, tokens };
};

const includesAny = (source, keywords = []) => keywords.some((word) => source.includes(word));

const inferCategoryCourse = (categoryName = '') => {
    const normalized = categoryName.toLowerCase();
    if (!normalized) {
        return null;
    }
    if (/(drink|beverage|cocktail|wine)/.test(normalized)) {
        return 'beverage';
    }
    if (/(dessert|sweet)/.test(normalized)) {
        return 'dessert';
    }
    if (/(salad)/.test(normalized)) {
        return 'salad';
    }
    if (/(soup|bisque)/.test(normalized)) {
        return 'soup';
    }
    if (/(appetizer|starter|snack)/.test(normalized)) {
        return 'appetizer';
    }
    if (/(pasta)/.test(normalized)) {
        return 'pasta';
    }
    return null;
};

const collectIntents = (normalized, tokens) => {
    const intents = {
        courses: new Set(),
        temperature: null,
        spice: null,
        alcoholPreference: null,
        requireDietary: new Set(),
        avoidAllergens: new Set(),
        ingredientFocus: new Set()
    };

    Object.entries(COURSE_KEYWORDS).forEach(([course, keywords]) => {
        if (includesAny(normalized, keywords)) {
            intents.courses.add(course);
        }
    });

    Object.entries(TEMPERATURE_KEYWORDS).forEach(([temp, keywords]) => {
        if (!intents.temperature && includesAny(normalized, keywords)) {
            intents.temperature = temp;
        }
    });

    Object.entries(SPICE_KEYWORDS).forEach(([level, keywords]) => {
        if (!intents.spice && includesAny(normalized, keywords)) {
            intents.spice = level;
        }
    });

    if (includesAny(normalized, ['mocktail', 'non-alcoholic', 'alcohol-free', 'alcohol free', 'zero proof'])) {
        intents.courses.add('beverage');
        intents.alcoholPreference = false;
    } else if (includesAny(normalized, ['cocktail', 'wine', 'beer', 'boozy'])) {
        intents.courses.add('beverage');
        intents.alcoholPreference = true;
    }

    Object.entries(DIETARY_KEYWORDS).forEach(([intent, keywords]) => {
        if (!includesAny(normalized, keywords)) {
            return;
        }
        switch (intent) {
            case 'vegetarian':
                intents.requireDietary.add('vegetarian');
                break;
            case 'vegan':
                intents.requireDietary.add('vegan');
                break;
            case 'glutenFree':
                intents.avoidAllergens.add('gluten');
                break;
            case 'dairyFree':
                intents.avoidAllergens.add('dairy');
                break;
            case 'nutFree':
                intents.avoidAllergens.add('tree-nut');
                break;
            case 'shellfishFree':
                intents.avoidAllergens.add('shellfish');
                break;
            default:
                break;
        }
    });

    Object.entries(INGREDIENT_SYNONYMS).forEach(([label, keywords]) => {
        if (includesAny(normalized, keywords)) {
            intents.ingredientFocus.add(label);
        }
    });

    if (tokens.includes('seafood')) {
        intents.ingredientFocus.add('seafood');
    }

    if (tokens.includes('steak')) {
        intents.ingredientFocus.add('steak');
    }

    return intents;
};

const buildHaystack = (item, enrichment) => {
    const fields = [
        item.name,
        item.description,
        item.category?.name,
        enrichment?.categoryName,
        ...(enrichment?.keyIngredients || []),
        enrichment?.notes,
        ...(enrichment?.dietaryTags || []),
        enrichment?.spiceLevel || ''
    ];
    return fields
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
};

const containsMeatKeyword = (text) => MEAT_KEYWORDS.some((keyword) => buildWordRegex(keyword).test(text));

const ingredientMatches = (haystack, focus) => {
    const keywords = INGREDIENT_SYNONYMS[focus] || [focus];
    return keywords.some((keyword) => haystack.includes(keyword));
};

const evaluateItem = (item, enrichment, tokens, intents, haystack, vectorScore = 0) => {
    if (!haystack) {
        return null;
    }

    if (intents.requireDietary.size > 0) {
        if (!enrichment) {
            return null;
        }
        for (const tag of intents.requireDietary) {
            if (!enrichment.dietaryTags.includes(tag)) {
                return null;
            }
        }
    }

    for (const allergen of intents.avoidAllergens) {
        if (!enrichment) {
            return null;
        }
        if (enrichment.allergens.includes(allergen)) {
            return null;
        }
    }

    if (intents.alcoholPreference === false && enrichment?.containsAlcohol) {
        return null;
    }

    if (intents.spice === 'bold' && enrichment?.spiceLevel && ['none', 'mild'].includes(enrichment.spiceLevel)) {
        return null;
    }

    if (intents.requireDietary.has('vegetarian') && containsMeatKeyword(haystack)) {
        return null;
    }

    let score = 0;
    const reasons = [];

    if (vectorScore > 0) {
        score += vectorScore * VECTOR_WEIGHT;
        reasons.push('Matches what you described');
    }

    tokens.forEach((token) => {
        if (haystack.includes(token)) {
            score += 1.2;
        }
    });

    const categoryCourse = inferCategoryCourse(item.category?.name || enrichment?.categoryName);

    if (intents.courses.size > 0) {
        if (categoryCourse && intents.courses.has(categoryCourse)) {
            score += 3.2;
            reasons.push(`Matches ${categoryCourse === 'beverage' ? 'drink' : categoryCourse} craving`);
        } else if (intents.courses.has('beverage') && enrichment?.containsAlcohol === (intents.alcoholPreference ?? enrichment?.containsAlcohol)) {
            score += 1.5;
        } else if (intents.courses.has('dessert') && haystack.includes('dessert')) {
            score += 1.2;
        } else {
            score -= 0.4;
        }
    }

    if (intents.spice === 'bold' && enrichment?.spiceLevel && ['medium', 'hot'].includes(enrichment.spiceLevel)) {
        score += 3;
        reasons.push('Bold spice profile');
    }

    if (intents.spice === 'mild' && enrichment?.spiceLevel && ['none', 'mild'].includes(enrichment.spiceLevel)) {
        score += 1.4;
        reasons.push('Gentle spice level');
    }

    if (intents.temperature === 'cold') {
        if (haystack.includes('chilled') || haystack.includes('iced') || haystack.includes('cold') || categoryCourse === 'beverage') {
            score += 1.6;
            reasons.push('Served chilled or refreshing');
        }
    } else if (intents.temperature === 'warm') {
        if (haystack.includes('warm') || haystack.includes('roasted') || haystack.includes('braised') || haystack.includes('baked')) {
            score += 1.2;
            reasons.push('Comforting and warm');
        }
    }

    if (intents.alcoholPreference === true && enrichment?.containsAlcohol) {
        score += 1.1;
        reasons.push('Contains alcohol');
    } else if (intents.alcoholPreference === false && enrichment && !enrichment.containsAlcohol) {
        score += 1.1;
        reasons.push('Alcohol-free');
    }

    intents.ingredientFocus.forEach((focus) => {
        if (ingredientMatches(haystack, focus)) {
            score += 1.8;
            reasons.push(`Highlights ${focus}`);
        }
    });

    if (enrichment) {
        intents.requireDietary.forEach((tag) => {
            if (enrichment.dietaryTags.includes(tag)) {
                reasons.push(`${tag.replace('-', ' ')} friendly`);
                score += 1.2;
            }
        });
    }

    const cutoff = vectorScore > 0 ? 0.05 : 0.5;
    if (score <= cutoff) {
        return null;
    }

    return {
        score,
        reasons: reasons.slice(0, 4)
    };
};

const formatResult = (item, enrichment, score, reasons, vectorScore = 0) => ({
    id: item.id,
    name: item.name,
    description: item.description,
    priceCents: item.priceCents,
    imageUrl: normalizeAssetUrl(item.imageUrl),
    category: item.category
        ? { id: item.category.id, name: item.category.name }
        : enrichment?.categoryId
          ? { id: enrichment.categoryId, name: enrichment.categoryName }
          : null,
    spiceLevel: enrichment?.spiceLevel || null,
    dietaryTags: enrichment?.dietaryTags || [],
    containsAlcohol: enrichment?.containsAlcohol ?? false,
    matchScore: Number(score.toFixed(3)),
    matchReasons: reasons,
    similarityScore: vectorScore > 0 ? Number(vectorScore.toFixed(3)) : null
});

export const searchMenuItems = async (sessionToken, query, options = {}) => {
    if (!sessionToken) {
        throw new Error('Session token is required');
    }
    const trimmed = String(query || '').trim();
    if (!trimmed) {
        throw new Error('Search query is required');
    }

    const session = await GuestSession.findOne({
        where: { sessionToken },
        attributes: ['id', 'restaurantId', 'customerId', 'closedAt']
    });

    if (!session || session.closedAt) {
        throw new Error('Session is not active');
    }

    const { normalized, tokens } = tokenizeQuery(trimmed);
    if (tokens.length === 0) {
        throw new Error('Search query must include at least one descriptive word');
    }

    const intents = collectIntents(normalized, tokens);

    const vectorCandidates = await vectorSearchMenuItems(session.restaurantId, normalized, {
        limit: VECTOR_CANDIDATE_LIMIT
    });
    const vectorScores = new Map();
    vectorCandidates.forEach((candidate) => {
        if (!candidate || !candidate.menuItemId) {
            return;
        }
        const score = typeof candidate.score === 'number' ? candidate.score : 0;
        vectorScores.set(candidate.menuItemId, Math.max(score, 0));
    });

    const menuItems = await MenuItem.findAll({
        where: { isAvailable: true },
        include: [
            {
                model: MenuCategory,
                as: 'category',
                required: true,
                attributes: ['id', 'name'],
                where: {
                    restaurantId: session.restaurantId,
                    isActive: true
                }
            }
        ]
    });

    const scored = [];
    menuItems.forEach((item) => {
        const enrichment = getMenuEnrichment(item.id);
        const haystack = buildHaystack(item, enrichment);
        const vectorScore = vectorScores.get(item.id) || 0;
        const evaluation = evaluateItem(item, enrichment, tokens, intents, haystack, vectorScore);
        if (!evaluation) {
            return;
        }
        scored.push({
            item,
            enrichment,
            score: evaluation.score,
            reasons: evaluation.reasons,
            vectorScore
        });
    });

    scored.sort((a, b) => {
        if (b.score === a.score) {
            return a.item.name.localeCompare(b.item.name);
        }
        return b.score - a.score;
    });

    const available = hasMenuEnrichment();
    const limit = Math.min(Math.max(options.limit || 6, 1), 12);
    const topCandidates = scored.slice(0, 12);
    const hasResults = topCandidates.length > 0;
    const topScore = topCandidates[0]?.score || 0;
    const secondScore = topCandidates[1]?.score || 0;
    const ambiguityScore = hasResults ? computeAmbiguityScore([topScore, secondScore]) : 1;
    let needsClarification = hasResults && (ambiguityScore >= 0.75 || tokens.length < 2);
    let clarificationPrompt = null;
    let clarificationOptions = [];
    if (needsClarification) {
        const details = buildClarificationDetails(topCandidates, tokens);
        clarificationPrompt = details.prompt;
        clarificationOptions = details.options || [];
        if (!clarificationPrompt) {
            needsClarification = false;
        }
    }
    const resolutionStatus = !hasResults
        ? MENU_QUERY_RESOLUTION_STATUS.FALLBACK
        : needsClarification
          ? MENU_QUERY_RESOLUTION_STATUS.NEEDS_CLARIFICATION
          : MENU_QUERY_RESOLUTION_STATUS.AUTO;
    const fallbackReason = hasResults ? null : 'NO_MATCH';

    const metadata = {
        available,
        tokenCount: tokens.length,
        queryLength: trimmed.length,
        needsClarification,
        clarificationPrompt,
        clarificationOptions,
        vectorSearch: {
            enabled: HAS_VECTOR_SEARCH,
            candidateCount: vectorCandidates.length,
            topCandidateScore: vectorCandidates[0]?.score ?? null
        }
    };

    if (options.parentClarificationId) {
        metadata.parentClarificationId = options.parentClarificationId;
    }

    if (vectorCandidates.length > 0) {
        metadata.vectorCandidates = vectorCandidates.slice(0, Math.min(vectorCandidates.length, 20)).map((candidate) => ({
            menuItemId: candidate.menuItemId,
            score: candidate.score,
            rank: candidate.rank
        }));
    }

    const clarificationId = await logMenuQuery({
        session,
        rawQuery: trimmed,
        normalizedQuery: normalized,
        tokens,
        intents,
        scored: topCandidates,
        totalMatches: scored.length,
        limit,
        metadata,
        ambiguityScore,
        resolutionStatus,
        fallbackReason,
        needsClarification,
        clarificationPrompt,
        clarificationOptions
    });

    return {
        query: trimmed,
        available,
        total: scored.length,
        ambiguityScore,
        needsClarification,
        clarificationPrompt,
        clarificationOptions,
        clarificationId,
        items: topCandidates
            .slice(0, limit)
            .map(({ item, enrichment, score, reasons, vectorScore }) =>
                formatResult(item, enrichment, score, reasons, vectorScore)
            )
    };
};

export const clarifyMenuSearch = async (sessionToken, clarificationId, answer, options = {}) => {
    if (!sessionToken) {
        throw new Error('Session token is required');
    }
    const trimmedAnswer = String(answer || '').trim();
    if (!clarificationId || typeof clarificationId !== 'string') {
        throw new Error('Clarification reference is required');
    }
    if (trimmedAnswer.length < 2) {
        throw new Error('Clarification answer is too short');
    }

    const session = await GuestSession.findOne({
        where: { sessionToken },
        attributes: ['id', 'restaurantId', 'customerId', 'closedAt']
    });

    if (!session || session.closedAt) {
        throw new Error('Session is not active');
    }

    const clarification = await MenuQueryClarification.findOne({
        where: { id: clarificationId },
        include: [
            {
                model: MenuQueryLog,
                as: 'queryLog'
            }
        ]
    });

    if (!clarification || !clarification.queryLog) {
        throw new Error('Clarification prompt not found');
    }

    if (clarification.queryLog.guestSessionId !== session.id) {
        throw new Error('Clarification does not belong to this session');
    }

    const baseQuery = clarification.queryLog.rawQuery || '';
    const combinedQuery = `${baseQuery} ${trimmedAnswer}`.trim();

    await clarification.update({
        userReply: trimmedAnswer,
        resolvedIntent: 'freeform-input',
        resolvedAt: new Date(),
        metadata: {
            ...(clarification.metadata || {}),
            answerLength: trimmedAnswer.length
        }
    });

    await clarification.queryLog.update({
        resolutionStatus: MENU_QUERY_RESOLUTION_STATUS.CLARIFIED,
        triggeredClarification: true
    });

    const limit = Math.min(Math.max(options.limit || 6, 1), 12);
    const result = await searchMenuItems(sessionToken, combinedQuery, {
        limit,
        parentClarificationId: clarificationId
    });

    if (Array.isArray(result.items) && result.items.length > 0) {
        await clarification.queryLog.update({ resolvedItemId: result.items[0].id });
    }

    return {
        ...result,
        clarificationResolved: true,
        appliedClarification: trimmedAnswer,
        baseQuery
    };
};
