import env from '../../config/env.js';
import logger from '../../config/logger.js';

const { clarificationModel } = env;
const MODEL_URL = clarificationModel?.url || '';
const ADMIN_KEY = clarificationModel?.adminKey || '';
const TIMEOUT_MS = clarificationModel?.timeoutMs || 1200;

let nodeFetch = null;

const getFetch = async () => {
    if (typeof fetch === 'function') {
        return fetch;
    }
    if (!nodeFetch) {
        const mod = await import('node-fetch');
        nodeFetch = mod.default;
    }
    return nodeFetch;
};

export const scoreClarification = async (features = {}) => {
    if (!MODEL_URL) {
        return null;
    }
    if (!features || typeof features !== 'object') {
        return null;
    }

    try {
        const fetchFn = await getFetch();
        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const timeoutHandle =
            controller && TIMEOUT_MS > 0
                ? setTimeout(() => controller.abort(), TIMEOUT_MS)
                : null;

        const response = await fetchFn(MODEL_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(ADMIN_KEY ? { 'x-rag-admin-key': ADMIN_KEY } : {})
            },
            body: JSON.stringify({ features }),
            signal: controller?.signal
        });

        if (timeoutHandle) {
            clearTimeout(timeoutHandle);
        }

        if (!response.ok) {
            const errorText = await response.text();
            logger.warn('Clarification predictor responded with error', {
                status: response.status,
                body: errorText
            });
            return null;
        }

        const payload = await response.json();
        if (!payload || typeof payload !== 'object') {
            return null;
        }
        return payload;
    } catch (error) {
        logger.warn('Failed to score clarification via predictor', { message: error.message });
        return null;
    }
};
