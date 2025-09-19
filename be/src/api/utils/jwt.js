import jwt from 'jsonwebtoken';
import env from '../../config/env.js';

const { jwtSecret } = env;

export const signAccessToken = (payload, options = {}) =>
    jwt.sign(payload, jwtSecret, { expiresIn: '15m', ...options });

export const signRefreshToken = (payload, options = {}) =>
    jwt.sign(payload, jwtSecret, { expiresIn: '7d', ...options });

export const verifyToken = (token) => jwt.verify(token, jwtSecret);
