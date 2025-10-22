import Joi from 'joi';

const uuidSchema = Joi.string().uuid({ version: 'uuidv4' });

export const recommendationAnalyticsQuerySchema = Joi.object({
    restaurantId: uuidSchema.optional(),
    minAttachRate: Joi.number().min(0).max(1).default(0),
    limit: Joi.number().integer().min(10).max(500).default(100)
});

