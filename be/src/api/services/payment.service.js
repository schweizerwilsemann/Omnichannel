import logger from '../../config/logger.js';
import { PAYMENT_STATUS, PAYMENT_METHOD } from '../utils/common.js';
import { quoteOrderForSession } from './customer.service.js';
import { createPaymentRecord, getPaymentRecord } from './payment/paymentStore.js';

const normalizeCardNumber = (value) => String(value || '').replace(/[^0-9]/g, '');

const detectCardBrand = (cardNumber) => {
    if (!cardNumber) {
        return null;
    }
    if (/^4/.test(cardNumber)) {
        return 'visa';
    }
    if (/^5[1-5]/.test(cardNumber)) {
        return 'mastercard';
    }
    if (/^3[47]/.test(cardNumber)) {
        return 'amex';
    }
    if (/^6(?:011|5)/.test(cardNumber)) {
        return 'discover';
    }
    return 'card';
};

const evaluateCardStatus = ({ number, expMonth, expYear, cvc }) => {
    const digits = number || '';
    if (!digits || digits.length < 12 || digits.length > 19) {
        return {
            status: PAYMENT_STATUS.FAILED,
            failureMessage: 'Card number must contain 12-19 digits. Use 4242 4242 4242 4242 for a successful Stripe test payment.'
        };
    }

    if (!Number.isInteger(expMonth) || expMonth < 1 || expMonth > 12 || !Number.isInteger(expYear) || expYear < 2000) {
        return {
            status: PAYMENT_STATUS.FAILED,
            failureMessage: 'Expiry date looks invalid. Double-check the month and year.'
        };
    }

    const current = new Date();
    const expiry = new Date(expYear, expMonth - 1, 1);
    expiry.setMonth(expiry.getMonth() + 1);
    if (expiry <= current) {
        return {
            status: PAYMENT_STATUS.FAILED,
            failureMessage: 'Card has expired. Use a future expiry when testing Stripe.'
        };
    }

    if (!cvc || cvc.length < 3 || cvc.length > 4) {
        return {
            status: PAYMENT_STATUS.FAILED,
            failureMessage: 'CVC must be 3 or 4 digits.'
        };
    }

    if (digits.endsWith('0002')) {
        return {
            status: PAYMENT_STATUS.FAILED,
            failureMessage: 'Your bank declined the card (Stripe `card_declined`). Try the 4242 test card instead.'
        };
    }

    if (digits.endsWith('9995')) {
        return {
            status: PAYMENT_STATUS.FAILED,
            failureMessage: 'Card requires 3D Secure authentication, which the mock gateway skips. Use 4242 4242 4242 4242 to simulate success.'
        };
    }

    return {
        status: PAYMENT_STATUS.SUCCEEDED,
        failureMessage: null
    };
};

const buildQuoteSummary = (quote) => ({
    subtotalCents: quote.subtotalCents,
    discountAppliedCents: quote.discountAppliedCents,
    voucherDiscountCents: quote.voucherDiscountCents,
    loyaltyDiscountCents: quote.loyaltyDiscountCents,
    loyaltyPointsRedeemed: quote.loyaltyPointsRedeemed,
    payableCents: quote.payableCents,
    loyaltyPointsEarned: quote.loyaltyPointsEarned,
    membership: quote.membership || null,
    voucher: quote.voucher || null,
    orderFingerprint: quote.orderFingerprint,
    currency: quote.currency || 'usd'
});

export const processOrderPayment = async (sessionToken, payload) => {
    const { card = null, ...orderPayload } = payload || {};

    const quote = await quoteOrderForSession(sessionToken, orderPayload);

    if (quote.payableCents <= 0) {
        const record = createPaymentRecord({
            sessionToken,
            amountCents: quote.payableCents,
            currency: quote.currency || 'usd',
            quote: quote,
            status: PAYMENT_STATUS.SUCCEEDED,
            method: PAYMENT_METHOD.NONE
        });

        return {
            paymentIntentId: record.id,
            status: record.status,
            amountCents: record.amountCents,
            currency: record.currency,
            method: record.method,
            cardBrand: null,
            cardLast4: null,
            failureMessage: null,
            quote: buildQuoteSummary(quote)
        };
    }

    if (!card) {
        throw new Error('Card details are required to process payment.');
    }

    const cardNumber = normalizeCardNumber(card.number);
    const cardBrand = detectCardBrand(cardNumber);
    const cardLast4 = cardNumber.slice(-4);
    const expMonth = Number.isFinite(card.expMonth) ? card.expMonth : Number.parseInt(card.expMonth, 10);
    const expYear = Number.isFinite(card.expYear) ? card.expYear : Number.parseInt(card.expYear, 10);
    const cvc = card.cvc ? String(card.cvc).trim() : '';

    const evaluation = evaluateCardStatus({ number: cardNumber, expMonth, expYear, cvc });

    const record = createPaymentRecord({
        sessionToken,
        amountCents: quote.payableCents,
        currency: quote.currency || 'usd',
        quote: quote,
        status: evaluation.status,
        method: PAYMENT_METHOD.CARD,
        cardBrand: evaluation.status === PAYMENT_STATUS.SUCCEEDED ? cardBrand : null,
        cardLast4: evaluation.status === PAYMENT_STATUS.SUCCEEDED ? cardLast4 : null,
        failureMessage: evaluation.failureMessage
    });

    logger.info('Processed mock payment intent', {
        paymentIntentId: record.id,
        sessionToken,
        status: record.status
    });

    return {
        paymentIntentId: record.id,
        status: record.status,
        amountCents: record.amountCents,
        currency: record.currency,
        method: record.method,
        cardBrand: record.cardBrand,
        cardLast4: record.cardLast4,
        failureMessage: record.failureMessage || null,
        quote: buildQuoteSummary(quote)
    };
};

export const getPaymentIntentSummary = (sessionToken, paymentIntentId) => {
    const record = getPaymentRecord(paymentIntentId);
    if (!record || record.sessionToken !== sessionToken) {
        return null;
    }

    return {
        paymentIntentId: record.id,
        status: record.status,
        amountCents: record.amountCents,
        currency: record.currency,
        method: record.method,
        cardBrand: record.cardBrand,
        cardLast4: record.cardLast4,
        failureMessage: record.failureMessage || null,
        quote: buildQuoteSummary(record.quote || {})
    };
};
