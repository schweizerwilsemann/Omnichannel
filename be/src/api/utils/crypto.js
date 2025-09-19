import crypto from 'crypto';
import env from '../../config/env.js';

const algorithm = 'aes-256-gcm';
const key = Buffer.from(env.cryptoSecret || '', 'utf-8');

if (key.length && key.length !== 32) {
    throw new Error('CRYPTO_SECRET_KEY must be 32 bytes for aes-256-gcm');
}

export const encrypt = (text) => {
    if (!key.length) {
        throw new Error('CRYPTO_SECRET_KEY not configured');
    }

    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return {
        content: encrypted.toString('base64'),
        iv: iv.toString('base64'),
        tag: authTag.toString('base64')
    };
};

export const decrypt = ({ content, iv, tag }) => {
    if (!key.length) {
        throw new Error('CRYPTO_SECRET_KEY not configured');
    }

    const decipher = crypto.createDecipheriv(algorithm, key, Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    const decrypted = Buffer.concat([
        decipher.update(Buffer.from(content, 'base64')),
        decipher.final()
    ]);

    return decrypted.toString('utf8');
};
