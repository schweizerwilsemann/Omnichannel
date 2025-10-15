import Joi from 'joi';

const uuidV4 = Joi.string().guid({ version: 'uuidv4' });

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

export default {
    menuItemCreateSchema,
    menuItemUpdateSchema,
    customerMembershipCreateSchema,
    customerMembershipUpdateSchema,
    tableCreateSchema,
    tableUpdateSchema
};
