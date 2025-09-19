import Joi from 'joi';
import { USER_ROLES } from '../utils/common.js';

export const loginSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(8).required(),
    deviceName: Joi.string().max(100).optional()
});

export const refreshSchema = Joi.object({
    refreshToken: Joi.string().required()
});

export const createInvitationSchema = Joi.object({
    restaurantId: Joi.string().guid({ version: 'uuidv4' }).required(),
    invitee: Joi.object({
        firstName: Joi.string().max(50).required(),
        lastName: Joi.string().max(50).required(),
        email: Joi.string().email().required(),
        phoneNumber: Joi.string().max(20).required(),
        role: Joi.string()
            .valid(USER_ROLES.MANAGER, USER_ROLES.OWNER)
            .default(USER_ROLES.MANAGER)
    }).required()
});

export const acceptInvitationSchema = Joi.object({
    tokenIdentifier: Joi.string().guid({ version: 'uuidv4' }).required(),
    token: Joi.string().required(),
    password: Joi.string().min(8).required(),
    phoneNumber: Joi.string().max(20).optional()
});

export const passwordResetRequestSchema = Joi.object({
    email: Joi.string().email().required()
});

export const passwordResetSchema = Joi.object({
    resetId: Joi.string().guid({ version: 'uuidv4' }).required(),
    token: Joi.string().required(),
    password: Joi.string().min(8).required()
});
