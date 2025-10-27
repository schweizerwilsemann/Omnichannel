import models from '../models/index.js';
import { normalizeAssetUrl } from './storage.service.js';
import { getMenuEnrichment, hasMenuEnrichment } from './menuEnrichment.service.js';

const { GuestSession, MenuItem, MenuCategory } = models;

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

const evaluateItem = (item, enrichment, tokens, intents, haystack) => {
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

    if (score <= 0.5) {
        return null;
    }

    return {
        score,
        reasons: reasons.slice(0, 4)
    };
};

const formatResult = (item, enrichment, score, reasons) => ({
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
    matchReasons: reasons
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
        attributes: ['id', 'restaurantId', 'closedAt']
    });

    if (!session || session.closedAt) {
        throw new Error('Session is not active');
    }

    const { normalized, tokens } = tokenizeQuery(trimmed);
    if (tokens.length === 0) {
        throw new Error('Search query must include at least one descriptive word');
    }

    const intents = collectIntents(normalized, tokens);

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
        const evaluation = evaluateItem(item, enrichment, tokens, intents, haystack);
        if (!evaluation) {
            return;
        }
        scored.push({
            item,
            enrichment,
            score: evaluation.score,
            reasons: evaluation.reasons
        });
    });

    scored.sort((a, b) => {
        if (b.score === a.score) {
            return a.item.name.localeCompare(b.item.name);
        }
        return b.score - a.score;
    });

    const limit = Math.min(Math.max(options.limit || 6, 1), 12);

    return {
        query: trimmed,
        available: hasMenuEnrichment(),
        total: scored.length,
        items: scored.slice(0, limit).map(({ item, enrichment, score, reasons }) => formatResult(item, enrichment, score, reasons))
    };
};
