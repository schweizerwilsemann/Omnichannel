import Joi from 'joi';

const uuidV4 = Joi.string().guid({ version: 'uuidv4' });

const addressSchema = Joi.object({
    street: Joi.string().max(200).allow(null, '').optional(),
    city: Joi.string().max(100).allow(null, '').optional(),
    state: Joi.string().max(50).allow(null, '').optional(),
    zipCode: Joi.string().max(20).allow(null, '').optional(),
    country: Joi.string().max(50).allow(null, '').optional()
});

const businessHoursSchema = Joi.object({
    monday: Joi.object({
        open: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
        close: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
        isOpen: Joi.boolean().optional()
    }).optional(),
    tuesday: Joi.object({
        open: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
        close: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
        isOpen: Joi.boolean().optional()
    }).optional(),
    wednesday: Joi.object({
        open: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
        close: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
        isOpen: Joi.boolean().optional()
    }).optional(),
    thursday: Joi.object({
        open: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
        close: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
        isOpen: Joi.boolean().optional()
    }).optional(),
    friday: Joi.object({
        open: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
        close: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
        isOpen: Joi.boolean().optional()
    }).optional(),
    saturday: Joi.object({
        open: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
        close: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
        isOpen: Joi.boolean().optional()
    }).optional(),
    sunday: Joi.object({
        open: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
        close: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
        isOpen: Joi.boolean().optional()
    }).optional()
});

export const restaurantCreateSchema = Joi.object({
    ownerId: uuidV4.required(),
    name: Joi.string().max(120).required(),
    address: addressSchema.optional(),
    businessHours: businessHoursSchema.optional(),
    timezone: Joi.string().max(50).optional(),
    status: Joi.string().valid('ACTIVE', 'INACTIVE', 'SUSPENDED').optional()
});

export const restaurantUpdateSchema = Joi.object({
    name: Joi.string().max(120).optional(),
    address: addressSchema.optional(),
    businessHours: businessHoursSchema.optional(),
    timezone: Joi.string().max(50).optional(),
    status: Joi.string().valid('ACTIVE', 'INACTIVE', 'SUSPENDED').optional()
}).min(1);

export const restaurantStatusUpdateSchema = Joi.object({
    status: Joi.string().valid('ACTIVE', 'INACTIVE', 'SUSPENDED').required()
});

export default {
    restaurantCreateSchema,
    restaurantUpdateSchema,
    restaurantStatusUpdateSchema
};
