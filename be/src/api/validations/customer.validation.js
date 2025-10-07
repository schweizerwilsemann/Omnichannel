import Joi from 'joi';

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

export const sessionTokenQuerySchema = Joi.object({
    sessionToken: Joi.string().uuid({ version: 'uuidv4' }).required()
});

export const placeOrderSchema = Joi.object({
    sessionToken: Joi.string().uuid({ version: 'uuidv4' }).required(),
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
    applyLoyaltyDiscount: Joi.boolean().optional().default(false)
});

export const membershipRegistrationSchema = Joi.object({
    sessionToken: Joi.string().uuid({ version: 'uuidv4' }).required(),
    customer: Joi.object({
        firstName: Joi.string().max(80).required(),
        lastName: Joi.string().max(80).allow(null, ''),
        email: Joi.string().email().required(),
        phoneNumber: Joi.string().max(20).allow(null, ''),
        membershipNumber: Joi.string().max(80).allow(null, '')
    })
        .required()
});

export const membershipVerifySchema = Joi.object({
    verificationId: Joi.string().uuid({ version: 'uuidv4' }).required(),
    token: Joi.string().min(12).max(255).required()
});
export const qrSlugQuerySchema = Joi.object({
    qrSlug: Joi.string().trim().required()
});

export const loyaltyClaimSchema = Joi.object({
    sessionToken: Joi.string().uuid({ version: 'uuidv4' }).required(),
    points: Joi.number().integer().min(1).required()
});

export const orderRatingSchema = Joi.object({
    sessionToken: Joi.string().uuid({ version: 'uuidv4' }).required(),
    ratings: Joi.array()
        .items(
            Joi.object({
                orderItemId: Joi.string().uuid({ version: 'uuidv4' }).required(),
                rating: Joi.number().integer().min(1).max(5).required(),
                comment: Joi.string().max(500).allow(null, '').optional()
            })
        )
        .min(1)
        .required()
});

export const orderIdParamSchema = Joi.object({
    orderId: Joi.string().uuid({ version: 'uuidv4' }).required()
});
