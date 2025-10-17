import Joi from 'joi';

const uuidV4 = Joi.string().guid({ version: 'uuidv4' });

const promotionVoucherTierSchema = Joi.object({
    minSpendCents: Joi.number().integer().min(0).required(),
    discountPercent: Joi.number().min(0).max(50).required(),
    maxDiscountCents: Joi.number().integer().min(0).allow(null).optional()
});

const promotionVoucherSchema = Joi.object({
    id: uuidV4.optional(),
    code: Joi.string().max(80).required(),
    name: Joi.string().max(150).required(),
    description: Joi.string().allow(null, '').optional(),
    status: Joi.string().valid('ACTIVE', 'INACTIVE').optional(),
    discountType: Joi.string().valid('PERCENTAGE').optional(),
    allowStackWithPoints: Joi.boolean().optional(),
    claimsPerCustomer: Joi.number().integer().min(1).optional(),
    totalClaimLimit: Joi.number().integer().min(1).allow(null).optional(),
    validFrom: Joi.date().allow(null, '').optional(),
    validUntil: Joi.date().allow(null, '').optional(),
    termsUrl: Joi.string().uri().allow(null, '').optional(),
    tiers: Joi.array().items(promotionVoucherTierSchema).min(1).required()
});

export const menuItemCreateSchema = Joi.object({
    categoryId: uuidV4.required(),
    sku: Joi.string().max(50).required(),
    name: Joi.string().max(150).required(),
    description: Joi.string().allow(null, '').optional(),
    priceCents: Joi.number().integer().min(0).required(),
    isAvailable: Joi.boolean().optional(),
    prepTimeSeconds: Joi.number().integer().min(0).allow(null).optional(),
    imageUrl: Joi.string().uri().allow(null, '').optional()
});

export const menuItemUpdateSchema = Joi.object({
    categoryId: uuidV4.optional(),
    sku: Joi.string().max(50).optional(),
    name: Joi.string().max(150).optional(),
    description: Joi.string().allow(null, '').optional(),
    priceCents: Joi.number().integer().min(0).optional(),
    isAvailable: Joi.boolean().optional(),
    prepTimeSeconds: Joi.number().integer().min(0).allow(null).optional(),
    imageUrl: Joi.string().uri().allow(null, '').optional()
}).min(1);

const customerPayloadSchema = Joi.object({
    id: uuidV4.optional(),
    firstName: Joi.string().max(80).allow(null, '').optional(),
    lastName: Joi.string().max(80).allow(null, '').optional(),
    email: Joi.string().email().allow(null, '').optional(),
    phoneNumber: Joi.string().max(20).allow(null, '').optional(),
    membershipNumber: Joi.string().max(80).allow(null, '').optional()
});

export const customerMembershipCreateSchema = Joi.object({
    restaurantId: uuidV4.required(),
    status: Joi.string().valid('GUEST', 'MEMBER').optional(),
    loyaltyPoints: Joi.number().integer().min(0).optional(),
    discountBalanceCents: Joi.number().integer().min(0).optional(),
    customer: customerPayloadSchema.required()
});

export const customerMembershipUpdateSchema = Joi.object({
    status: Joi.string().valid('GUEST', 'MEMBER').optional(),
    loyaltyPoints: Joi.number().integer().min(0).optional(),
    discountBalanceCents: Joi.number().integer().min(0).optional(),
    customer: customerPayloadSchema.optional()
}).min(1);

export const tableCreateSchema = Joi.object({
    restaurantId: uuidV4.required(),
    name: Joi.string().max(50).required(),
    qrSlug: Joi.string().max(120).required(),
    capacity: Joi.number().integer().min(1).required(),
    status: Joi.string().valid('AVAILABLE', 'RESERVED', 'OUT_OF_SERVICE').optional()
});

export const tableUpdateSchema = Joi.object({
    name: Joi.string().max(50).optional(),
    qrSlug: Joi.string().max(120).optional(),
    capacity: Joi.number().integer().min(1).optional(),
    status: Joi.string().valid('AVAILABLE', 'RESERVED', 'OUT_OF_SERVICE').optional()
}).min(1);

export const promotionCreateSchema = Joi.object({
    restaurantId: uuidV4.required(),
    name: Joi.string().max(150).required(),
    headline: Joi.string().max(200).allow(null, '').optional(),
    description: Joi.string().allow(null, '').optional(),
    bannerImageUrl: Joi.string().uri().allow(null, '').optional(),
    ctaLabel: Joi.string().max(100).allow(null, '').optional(),
    ctaUrl: Joi.string().uri().allow(null, '').optional(),
    status: Joi.string().valid('DRAFT', 'SCHEDULED', 'ACTIVE', 'EXPIRED', 'ARCHIVED').optional(),
    startsAt: Joi.date().allow(null, '').optional(),
    endsAt: Joi.date().allow(null, '').optional(),
    emailSubject: Joi.string().max(200).allow(null, '').optional(),
    emailPreviewText: Joi.string().max(255).allow(null, '').optional(),
    emailBody: Joi.string().allow(null, '').optional(),
    vouchers: Joi.array().items(promotionVoucherSchema).min(1).required()
});

export const promotionUpdateSchema = Joi.object({
    name: Joi.string().max(150).optional(),
    headline: Joi.string().max(200).allow(null, '').optional(),
    description: Joi.string().allow(null, '').optional(),
    bannerImageUrl: Joi.string().uri().allow(null, '').optional(),
    ctaLabel: Joi.string().max(100).allow(null, '').optional(),
    ctaUrl: Joi.string().uri().allow(null, '').optional(),
    status: Joi.string().valid('DRAFT', 'SCHEDULED', 'ACTIVE', 'EXPIRED', 'ARCHIVED').optional(),
    startsAt: Joi.date().allow(null, '').optional(),
    endsAt: Joi.date().allow(null, '').optional(),
    emailSubject: Joi.string().max(200).allow(null, '').optional(),
    emailPreviewText: Joi.string().max(255).allow(null, '').optional(),
    emailBody: Joi.string().allow(null, '').optional(),
    vouchers: Joi.array().items(promotionVoucherSchema).optional()
}).min(1);

export default {
    menuItemCreateSchema,
    menuItemUpdateSchema,
    customerMembershipCreateSchema,
    customerMembershipUpdateSchema,
    tableCreateSchema,
    tableUpdateSchema,
    promotionCreateSchema,
    promotionUpdateSchema
};
