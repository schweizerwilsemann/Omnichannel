import env from '../../config/env.js';
import logger from '../../config/logger.js';

const embeddingConfig = env.vector?.embedding || {};
const { baseUrl, apiKey } = embeddingConfig;

const EMBED_ENDPOINT = baseUrl ? new URL('rag/embed', baseUrl).toString() : '';

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

export const embedTexts = async (texts = []) => {
    if (!Array.isArray(texts) || texts.length === 0) {
        return [];
    }
    if (!EMBED_ENDPOINT) {
        throw new Error('Embedding service URL is not configured');
    }

    try {
        const fetchFn = await getFetch();
        const response = await fetchFn(EMBED_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(apiKey ? { 'x-rag-admin-key': apiKey } : {})
            },
            body: JSON.stringify({ texts })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Embedding service responded with ${response.status}: ${errorText}`);
        }

        const payload = await response.json();
        if (!Array.isArray(payload.embeddings)) {
            throw new Error('Embedding service returned invalid payload');
        }
        return payload.embeddings;
    } catch (error) {
        logger.error('Failed to fetch embeddings', { message: error.message });
        throw error;
    }
};

export const embedText = async (text) => {
    const [embedding] = await embedTexts([text]);
    return embedding;
};
