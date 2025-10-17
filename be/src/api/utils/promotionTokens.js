import jwt from 'jsonwebtoken';
import env from '../../config/env.js';

const CLAIM_TOKEN_TYPE = 'PROMOTION_CLAIM';
const CLAIM_TOKEN_EXPIRATION = '7d';

export const signPromotionClaimToken = (payload = {}, options = {}) =>
    jwt.sign({ type: CLAIM_TOKEN_TYPE, ...payload }, env.jwtSecret, { expiresIn: CLAIM_TOKEN_EXPIRATION, ...options });

export const verifyPromotionClaimToken = (token) => {
    try {
        const decoded = jwt.verify(token, env.jwtSecret);
        if (decoded.type !== CLAIM_TOKEN_TYPE) {
            throw new Error('Invalid claim token');
        }
        return decoded;
    } catch (error) {
        const err = new Error('Invalid or expired claim token');
        err.cause = error;
        throw err;
    }
};
