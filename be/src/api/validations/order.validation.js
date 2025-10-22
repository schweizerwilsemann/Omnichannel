import Joi from 'joi';
import { PAYMENT_STATUS } from '../utils/common.js';

export const orderPaymentUpdateSchema = Joi.object({
    status: Joi.string()
        .valid(PAYMENT_STATUS.PENDING, PAYMENT_STATUS.SUCCEEDED)
        .required()
});
