import Joi from 'joi';

const uuidSchema = Joi.string().uuid({ version: 'uuidv4' });

const parseUuidList = (value, helpers) => {
    if (!value) {
        return [];
    }

    if (Array.isArray(value)) {
        const invalid = value.find((item) => uuidSchema.validate(item).error);
        if (invalid) {
            return helpers.error('string.guid');
        }
        return value;
    }

    const parts = String(value)
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean);

    if (parts.length === 0) {
        return [];
    }

    const invalid = parts.find((part) => uuidSchema.validate(part).error);
    if (invalid) {
        return helpers.error('string.guid');
    }

    return parts;
};

export const startSessionSchema = Joi.object({
    qrSlug: Joi.string().trim().required(),
    customer: Joi.object({
        firstName: Joi.string().max(80).allow(null, ''),
        lastName: Joi.string().max(80).allow(null, ''),
        email: Joi.string().email().allow(null, ''),
        phoneNumber: Joi.string().max(20).allow(null, ''),
        membershipNumber: Joi.string().max(80).allow(null, ''),
        isMember: Joi.boolean().optional(),
        joinLoyalty: Joi.boolean().optional()
    })
        .optional()
        .default(undefined)
});

export const loginChallengeSchema = Joi.object({
    qrSlug: Joi.string().trim().required(),
    email: Joi.string().email().required(),
    method: Joi.string()
        .valid('PIN', 'AUTHENTICATOR')
        .default('PIN'),
    pin: Joi.when('method', {
        is: 'PIN',
        then: Joi.string()
            .pattern(/^[0-9]{4,6}$/)
            .required(),
        otherwise: Joi.string()
            .pattern(/^[0-9]{4,6}$/)
            .allow(null, '')
            .optional()
    })
});

export const loginVerifySchema = Joi.object({
    qrSlug: Joi.string().trim().required(),
    challengeId: Joi.string().uuid({ version: 'uuidv4' }).required(),
    code: Joi.string()
        .pattern(/^[0-9]{6}$/)
        .required()
});

export const sessionTokenQuerySchema = Joi.object({
    sessionToken: uuidSchema.required()
});

export const similarMenuQuerySchema = Joi.object({
    sessionToken: uuidSchema.required(),
    menuItemId: uuidSchema.required(),
    limit: Joi.number().integer().min(1).max(10).default(4)
});

export const placeOrderSchema = Joi.object({
    sessionToken: uuidSchema.required(),
    items: Joi.array()
        .items(
            Joi.object({
                menuItemId: Joi.string().uuid({ version: 'uuidv4' }).required(),
                quantity: Joi.number().integer().min(1).default(1),
                notes: Joi.string().max(500).allow(null, '').optional()
            })
        )
        .min(1)
        .required(),
    specialRequest: Joi.string().max(1000).allow(null, '').optional(),
    applyLoyaltyDiscount: Joi.boolean().optional().default(false),
    loyaltyPointsToRedeem: Joi.number().integer().min(0).optional(),
    customerVoucherId: Joi.string().uuid({ version: 'uuidv4' }).allow(null, '').optional(),
    voucherCode: Joi.string().max(120).allow(null, '').optional(),
    paymentIntentId: Joi.string().min(10).allow(null, '').optional(),
    payInCash: Joi.boolean().optional().default(false)
});

export const processPaymentSchema = Joi.object({
    sessionToken: uuidSchema.required(),
    items: Joi.array()
        .items(
            Joi.object({
                menuItemId: uuidSchema.required(),
                quantity: Joi.number().integer().min(1).default(1),
                notes: Joi.string().max(500).allow(null, '').optional()
            })
        )
        .min(1)
        .required(),
    applyLoyaltyDiscount: Joi.boolean().optional().default(false),
    loyaltyPointsToRedeem: Joi.number().integer().min(0).optional(),
    customerVoucherId: Joi.string().uuid({ version: 'uuidv4' }).allow(null, '').optional(),
    voucherCode: Joi.string().max(120).allow(null, '').optional(),
    card: Joi.object({
        number: Joi.string()
            .trim()
            .required()
            .custom((value, helpers) => {
                const digits = value.replace(/\\D/g, '');
                if (digits.length < 12 || digits.length > 19) {
                    return helpers.error('card.number.length');
                }
                return value;
            })
            .messages({
                'any.required': 'Card number is required',
                'card.number.length': 'Card number must contain 12-19 digits. Use 4242 4242 4242 4242 to simulate success.'
            }),
        expMonth: Joi.number().integer().min(1).max(12).required(),
        expYear: Joi.number().integer().min(new Date().getFullYear()).max(new Date().getFullYear() + 15).required(),
        cvc: Joi.string()
            .pattern(/^[0-9]{3,4}$/)
            .required(),
        name: Joi.string().max(120).allow(null, '').optional()
    }).required()
});

export const membershipRegistrationSchema = Joi.object({
    sessionToken: uuidSchema.required(),
    customer: Joi.object({
        firstName: Joi.string().max(80).required(),
        lastName: Joi.string().max(80).allow(null, ''),
        email: Joi.string().email().required(),
        phoneNumber: Joi.string().max(20).allow(null, ''),
        membershipNumber: Joi.string().max(80).allow(null, ''),
        pin: Joi.string()
            .pattern(/^[0-9]{4,6}$/)
            .required()
    })
        .required()
});

export const membershipVerifySchema = Joi.object({
    verificationId: uuidSchema.required(),
    token: Joi.string().min(12).max(255).required()
});
export const membershipStatusQuerySchema = Joi.object({
    customerId: uuidSchema.required(),
    restaurantId: uuidSchema.required()
});
export const qrSlugQuerySchema = Joi.object({
    qrSlug: Joi.string().trim().required()
});

export const sessionTokenBodySchema = Joi.object({
    sessionToken: uuidSchema.required()
});

export const authenticatorVerifySchema = sessionTokenBodySchema.keys({
    code: Joi.string()
        .pattern(/^[0-9]{6}$/)
        .required()
});

export const pinUpdateSchema = Joi.object({
    sessionToken: uuidSchema.required(),
    currentPin: Joi.string()
        .pattern(/^[0-9]{4,6}$/)
        .allow(null, ''),
    newPin: Joi.string()
        .pattern(/^[0-9]{4,6}$/)
        .required()
});

export const loyaltyClaimSchema = Joi.object({
    sessionToken: uuidSchema.required(),
    points: Joi.number().integer().min(1).required()
});

export const voucherClaimSchema = Joi.object({
    sessionToken: uuidSchema.required(),
    promotionId: uuidSchema.allow(null, '').optional(),
    voucherId: uuidSchema.allow(null, '').optional(),
    channel: Joi.string().max(40).allow(null, '').default('CUSTOMER_APP')
}).or('promotionId', 'voucherId');

export const voucherEmailClaimSchema = Joi.object({
    token: Joi.string().min(10).required(),
    promotionId: uuidSchema.allow(null, '').optional(),
    voucherId: uuidSchema.allow(null, '').optional()
});

export const orderRatingSchema = Joi.object({
    sessionToken: uuidSchema.required(),
    ratings: Joi.array()
        .items(
            Joi.object({
                orderItemId: uuidSchema.required(),
                rating: Joi.number().integer().min(1).max(5).required(),
                comment: Joi.string().max(500).allow(null, '').optional()
            })
        )
        .min(1)
        .required()
});

export const orderIdParamSchema = Joi.object({
    orderId: uuidSchema.required()
});

export const paymentIntentParamSchema = Joi.object({
    paymentIntentId: Joi.string().min(10).required()
});

export const cartRecommendationsQuerySchema = sessionTokenQuerySchema.keys({
    items: Joi.alternatives()
        .try(Joi.array().items(uuidSchema).min(1), Joi.string().custom(parseUuidList))
        .default([])
        .optional(),
    exclude: Joi.alternatives()
        .try(Joi.array().items(uuidSchema).min(1), Joi.string().custom(parseUuidList))
        .default([])
        .optional(),
    limit: Joi.number().integer().min(1).max(12).default(5)
});

export const menuSearchQuerySchema = sessionTokenQuerySchema.keys({
    query: Joi.string().min(3).max(200).required(),
    limit: Joi.number().integer().min(1).max(12).default(6)
});
