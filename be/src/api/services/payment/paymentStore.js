import crypto from 'crypto';
import { PAYMENT_STATUS, PAYMENT_METHOD } from '../../utils/common.js';

const PAYMENT_PROVIDER = 'STRIPE_SIMULATED';

const intents = new Map();

const clone = (value) => {
    if (typeof globalThis.structuredClone === 'function') {
        return globalThis.structuredClone(value);
    }
    return JSON.parse(JSON.stringify(value));
};

const generateIntentId = () => `pi_${crypto.randomBytes(8).toString('hex')}`;

export const createPaymentRecord = ({
    sessionToken,
    amountCents,
    currency = 'usd',
    quote,
    status = PAYMENT_STATUS.PENDING,
    method = PAYMENT_METHOD.CARD,
    cardBrand = null,
    cardLast4 = null,
    failureMessage = null
} = {}) => {
    if (!sessionToken) {
        throw new Error('sessionToken is required to create payment records');
    }

    const id = generateIntentId();
    const now = new Date();

    const record = {
        id,
        provider: PAYMENT_PROVIDER,
        sessionToken,
        amountCents,
        currency,
        status,
        method,
        cardBrand,
        cardLast4,
        failureMessage,
        quote: quote ? clone(quote) : null,
        createdAt: now,
        updatedAt: now,
        consumed: false,
        consumedAt: null
    };

    intents.set(id, record);

    return clone(record);
};

export const updatePaymentRecord = (paymentIntentId, updates = {}) => {
    const record = intents.get(paymentIntentId);
    if (!record) {
        return null;
    }

    Object.assign(record, updates, { updatedAt: new Date() });
    return clone(record);
};

export const getPaymentRecord = (paymentIntentId) => {
    const record = intents.get(paymentIntentId);
    return record ? clone(record) : null;
};

export const consumePaymentIntent = ({
    paymentIntentId,
    sessionToken,
    expectedAmountCents,
    expectedFingerprint
} = {}) => {
    const record = intents.get(paymentIntentId);

    if (!record) {
        throw new Error('Payment confirmation could not be found. Please retry the payment process.');
    }

    if (record.sessionToken !== sessionToken) {
        throw new Error('Payment confirmation does not belong to this session.');
    }

    if (record.method !== PAYMENT_METHOD.CARD) {
        throw new Error('Online payment confirmation is not compatible with the selected payment method.');
    }

    if (record.status !== PAYMENT_STATUS.SUCCEEDED) {
        throw new Error('Payment has not completed successfully.');
    }

    if (record.consumed) {
        throw new Error('Payment confirmation has already been used.');
    }

    if (typeof expectedAmountCents === 'number' && expectedAmountCents >= 0) {
        if (record.amountCents !== expectedAmountCents) {
            throw new Error('Payment amount does not match the current order total.');
        }
    }

    const storedFingerprint = record.quote?.orderFingerprint || null;
    if (storedFingerprint && expectedFingerprint && storedFingerprint !== expectedFingerprint) {
        throw new Error('Order contents changed after the payment was authorised. Please submit payment again.');
    }

    record.consumed = true;
    record.consumedAt = new Date();
    record.updatedAt = record.consumedAt;

    return clone(record);
};

export const resetPaymentStore = () => {
    intents.clear();
};

export const getPaymentProviderLabel = () => PAYMENT_PROVIDER;
