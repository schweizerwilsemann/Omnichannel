import { useEffect, useMemo, useState } from 'react';
import { Button, Spinner, Form } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useCart } from '../context/CartContext.jsx';
import { useSession } from '../context/SessionContext.jsx';
import {
    placeCustomerOrder,
    closeSession,
    processCustomerPayment,
    fetchCartRecommendations
} from '../services/session.js';
import resolveAssetUrl from '../utils/assets.js';

const formatPrice = (cents) => `USD ${(cents / 100).toFixed(2)}`;
const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&h=600&fit=crop&crop=center';

const CheckoutPage = () => {
    const navigate = useNavigate();
    useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, []);
    const { cartItems, cartQuantity, totalCents, addItem, incrementItem, decrementItem, clearCart } = useCart();
    const { session, markOrdersDirty, updateSession, clearSession, vouchers, refreshPromotions } = useSession();
    const [placingOrder, setPlacingOrder] = useState(false);
    const discountBalanceCents = session?.membership?.discountBalanceCents ?? 0;
    const loyaltyPoints = session?.membership?.loyaltyPoints ?? 0;
    const [useDiscount, setUseDiscount] = useState(discountBalanceCents > 0);
    const [selectedVoucherId, setSelectedVoucherId] = useState('');
    const [paymentMode, setPaymentMode] = useState('card');
    const [cardNumber, setCardNumber] = useState('');
    const [cardName, setCardName] = useState('');
    const [cardExpMonth, setCardExpMonth] = useState('');
    const [cardExpYear, setCardExpYear] = useState('');
    const [cardCvc, setCardCvc] = useState('');
    const [cardTouched, setCardTouched] = useState({ number: false, expMonth: false, expYear: false, cvc: false });
    const [processingPayment, setProcessingPayment] = useState(false);
    const [paymentIntent, setPaymentIntent] = useState(null);
    const [paymentError, setPaymentError] = useState('');
    const [loadingRecommendations, setLoadingRecommendations] = useState(false);
    const [recommendations, setRecommendations] = useState([]);
    const [recommendationError, setRecommendationError] = useState('');
    const availableCustomerVouchers = useMemo(() => vouchers?.available || [], [vouchers]);
    const selectedVoucher = useMemo(
        () => availableCustomerVouchers.find((voucher) => voucher.id === selectedVoucherId) || null,
        [availableCustomerVouchers, selectedVoucherId]
    );
    const calculatedDiscounts = useMemo(() => {
        if (cartItems.length === 0) {
            return { voucher: 0, loyalty: 0 };
        }
        const cap = Math.floor(totalCents * 0.5);
        let voucherDiscount = 0;
        if (selectedVoucher) {
            const tiers = selectedVoucher.voucher?.tiers || [];
            let target = null;
            tiers.forEach((tier) => {
                if (totalCents >= tier.minSpendCents) {
                    if (!target || tier.minSpendCents >= target.minSpendCents) {
                        target = tier;
                    }
                }
            });
            if (target) {
                const percent = Number(target.discountPercent) || 0;
                let projected = Math.floor((percent / 100) * totalCents);
                if (target.maxDiscountCents) {
                    projected = Math.min(projected, target.maxDiscountCents);
                }
                voucherDiscount = Math.min(projected, cap);
            }
        }

        let loyaltyDiscount = 0;
        if (useDiscount && discountBalanceCents > 0) {
            const remainingCap = Math.max(cap - voucherDiscount, 0);
            loyaltyDiscount = Math.min(discountBalanceCents, remainingCap);
        }

        return { voucher: voucherDiscount, loyalty: loyaltyDiscount };
    }, [cartItems.length, totalCents, selectedVoucher, useDiscount, discountBalanceCents]);
    const resetCardTouched = () => setCardTouched({ number: false, expMonth: false, expYear: false, cvc: false });
    const voucherDiscountPreview = calculatedDiscounts.voucher;
    const discountToApply = calculatedDiscounts.loyalty;
    const finalTotalCents = Math.max(totalCents - voucherDiscountPreview - discountToApply, 0);
    const cardDigits = useMemo(() => cardNumber.replace(/\D/g, ''), [cardNumber]);
    const requiresOnlinePayment = paymentMode === 'card' && finalTotalCents > 0;
    const payInCash = paymentMode === 'cash' && finalTotalCents > 0;
    const cartSignature = useMemo(
        () =>
            JSON.stringify(
                cartItems.map((item) => ({
                    id: item.id,
                    quantity: item.quantity,
                    notes: item.notes || null
                }))
            ),
        [cartItems]
    );
    const cartItemIds = useMemo(() => cartItems.map((item) => item.id), [cartItems]);
    useEffect(() => {
        if (discountBalanceCents === 0 && useDiscount) {
            setUseDiscount(false);
        }
    }, [discountBalanceCents, useDiscount]);

    useEffect(() => {
        if (selectedVoucher?.voucher?.allowStackWithPoints === false && useDiscount) {
            setUseDiscount(false);
        }
    }, [selectedVoucher, useDiscount]);

    useEffect(() => {
        if (selectedVoucherId && !availableCustomerVouchers.find((voucher) => voucher.id === selectedVoucherId)) {
            setSelectedVoucherId('');
        }
    }, [availableCustomerVouchers, selectedVoucherId]);

    useEffect(() => {
        setPaymentIntent(null);
        setPaymentError('');
        resetCardTouched();
    }, [cartSignature, useDiscount, selectedVoucherId, finalTotalCents]);

    useEffect(() => {
        setPaymentError('');
        if (paymentMode === 'cash') {
            setPaymentIntent(null);
            resetCardTouched();
        }
    }, [paymentMode]);

    useEffect(() => {
        if (paymentIntent) {
            resetCardTouched();
        }
    }, [paymentIntent]);

    useEffect(() => {
        let cancelled = false;

        const loadRecommendations = async () => {
            if (!session?.sessionToken || cartItems.length === 0) {
                if (!cancelled) {
                    setRecommendations([]);
                    setRecommendationError('');
                }
                return;
            }

            setLoadingRecommendations(true);
            try {
                const response = await fetchCartRecommendations(session.sessionToken, cartItemIds);
                if (!cancelled) {
                    const payload = response?.data?.data || {};
                    setRecommendations(payload.recommendations || []);
                    setRecommendationError('');
                }
            } catch (error) {
                if (!cancelled) {
                    setRecommendations([]);
                    const message =
                        error?.response?.data?.message || error?.message || 'Unable to load recommendations.';
                    setRecommendationError(message);
                }
            } finally {
                if (!cancelled) {
                    setLoadingRecommendations(false);
                }
            }
        };

        loadRecommendations();

        return () => {
            cancelled = true;
        };
    }, [cartSignature, session?.sessionToken, cartItems.length, cartItemIds]);

    const cardErrors = useMemo(() => {
        if (!requiresOnlinePayment) {
            return {};
        }
        const errors = {};

        if (cardDigits.length < 12) {
            errors.number = 'Enter a valid card number (use 4242 4242 4242 4242 for Stripe tests).';
        }

        const expMonthInt = Number.parseInt(cardExpMonth, 10);
        const expYearInt = Number.parseInt(cardExpYear, 10);
        if (!expMonthInt || expMonthInt < 1 || expMonthInt > 12 || !expYearInt) {
            errors.expiry = 'Enter a valid expiry date (MM / YYYY).';
        } else {
            const now = new Date();
            const expiry = new Date(expYearInt, expMonthInt - 1, 1);
            expiry.setMonth(expiry.getMonth() + 1);
            if (expiry <= now) {
                errors.expiry = 'Expiry must be in the future.';
            }
        }

        if (cardCvc.length < 3 || cardCvc.length > 4) {
            errors.cvc = 'CVC must be 3 or 4 digits.';
        }

        return errors;
    }, [requiresOnlinePayment, cardDigits, cardExpMonth, cardExpYear, cardCvc]);

    const hasCardErrors = useMemo(() => Object.values(cardErrors).some(Boolean), [cardErrors]);
    const isCardFormComplete = useMemo(() => {
        if (!requiresOnlinePayment) {
            return true;
        }
        return !hasCardErrors;
    }, [requiresOnlinePayment, hasCardErrors]);



    const handlePlaceOrder = async () => {
        if (session?.membershipPending) {
            toast.info('Please verify your email to activate membership before placing an order.');
            return;
        }
        if (!session?.sessionToken) {
            toast.error('Session expired. Please refresh the page.');
            return;
        }
        if (cartItems.length === 0) {
            toast.info('Your cart is empty. Add some dishes first!');
            return;
        }
        if (requiresOnlinePayment && !paymentIntent && !isCardFormComplete) {
            setCardTouched({ number: true, expMonth: true, expYear: true, cvc: true });
            toast.error('Please enter your card details to pay for this order.');
            return;
        }

        try {
            setPlacingOrder(true);
            const allowLoyalty =
                useDiscount &&
                discountBalanceCents > 0 &&
                !(selectedVoucher && selectedVoucher.voucher?.allowStackWithPoints === false);

            let paymentIntentId = paymentIntent?.paymentIntentId || null;
            let paymentSummary = paymentIntent || null;

            if (requiresOnlinePayment && !paymentIntentId) {
                setProcessingPayment(true);
                setPaymentError('');
                try {
                    const expMonth = Number.parseInt(cardExpMonth, 10);
                    const expYear = Number.parseInt(cardExpYear, 10);
                    if (!Number.isInteger(expMonth) || !Number.isInteger(expYear)) {
                        setCardTouched({ number: true, expMonth: true, expYear: true, cvc: true });
                        const invalidMessage = 'Please provide a valid expiry date before continuing.';
                        setPaymentError(invalidMessage);
                        toast.error(invalidMessage);
                        return;
                    }
                    const paymentResponse = await processCustomerPayment({
                        sessionToken: session.sessionToken,
                        items: cartItems.map((item) => ({ menuItemId: item.id, quantity: item.quantity })),
                        applyLoyaltyDiscount: allowLoyalty,
                        customerVoucherId: selectedVoucherId || undefined,
                        card: {
                            number: cardNumber.replace(/\\s+/g, ''),
                            expMonth,
                            expYear,
                            cvc: cardCvc,
                            name: cardName || undefined
                        }
                    });
                    const paymentData = paymentResponse.data?.data;
                    if (!paymentData || paymentData.status !== 'SUCCEEDED') {
                        const fallbackMessage =
                            paymentData?.failureMessage || 'Payment could not be authorised. Please try again.';
                        setPaymentError(fallbackMessage);
                        toast.error(fallbackMessage);
                        return;
                    }
                    setPaymentIntent(paymentData);
                    paymentIntentId = paymentData.paymentIntentId;
                    paymentSummary = paymentData;
                    setPaymentError('');
                } catch (error) {
                    const message = error.response?.data?.message || error.message || 'Unable to process payment';
                    setPaymentError(message);
                    toast.error(message);
                    return;
                } finally {
                    setProcessingPayment(false);
                }
            }

            const response = await placeCustomerOrder({
                sessionToken: session.sessionToken,
                items: cartItems.map((item) => ({ menuItemId: item.id, quantity: item.quantity })),
                applyLoyaltyDiscount: allowLoyalty,
                customerVoucherId: selectedVoucherId || undefined,
                paymentIntentId: paymentIntentId || undefined,
                payInCash: payInCash ? true : undefined
            });
            const payload = response.data?.data;
            if (payload?.membership) {
                updateSession({ membership: payload.membership });
            }
            const discountAppliedCents = payload?.discountAppliedCents ?? 0;
            const earnedPoints = payload?.earnedLoyaltyPoints ?? 0;
            const voucherDiscountCents = payload?.voucherDiscountCents ?? 0;
            const messageParts = ['Order placed! We will keep you posted.'];
            if (discountAppliedCents > 0) {
                messageParts.push(`We applied ${formatPrice(discountAppliedCents)} from your loyalty bank.`);
            }
            if (voucherDiscountCents > 0) {
                messageParts.push(`Your voucher saved ${formatPrice(voucherDiscountCents)} this round.`);
            }
            if (earnedPoints > 0) {
                messageParts.push(`You earned ${earnedPoints} point${earnedPoints === 1 ? '' : 's'}.`);
            }
            if (paymentIntentId && paymentSummary) {
                messageParts.push(
                    `Payment confirmed · ${paymentSummary.cardBrand || 'card'} ••••${paymentSummary.cardLast4 || ''}`.trim()
                );
            } else if (payInCash && finalTotalCents > 0) {
                messageParts.push('Please pay at the cashier counter when you are ready.');
            }
            toast.success(messageParts.join(' '));
            clearCart();
            markOrdersDirty();
            setSelectedVoucherId('');
            setPaymentIntent(null);
            setCardNumber('');
            setCardName('');
            setCardExpMonth('');
            setCardExpYear('');
            setCardCvc('');
            setPaymentError('');
            resetCardTouched();
            if (typeof refreshPromotions === 'function') {
                const maybeRefresh = refreshPromotions();
                if (maybeRefresh && typeof maybeRefresh.catch === 'function') {
                    maybeRefresh.catch(() => {});
                }
            }
            navigate('/orders');
        } catch (error) {
            const message = error.response?.data?.message || error.message || 'Unable to place order';
            toast.error(message);
        } finally {
            setPlacingOrder(false);
            setProcessingPayment(false);
        }
    };

    const handleAddRecommendation = (menuItem) => {
        if (!menuItem) {
            return;
        }
        addItem(menuItem);
        toast.success(`${menuItem.name} added to cart`, { toastId: `rec-${menuItem.id}` });
    };

    const handleBackToMenu = () => navigate('/');

    const paymentFormDisabled = placingOrder || processingPayment || Boolean(paymentIntent);
    const placeOrderDisabled =
        placingOrder || processingPayment || (requiresOnlinePayment && !paymentIntent && !isCardFormComplete);

    return (
        <div className="checkout-page">
            <section className="checkout-card">
                <header className="checkout-card__header">
                    <button type="button" className="checkout-card__back" onClick={handleBackToMenu}>
                        &larr; Keep browsing
                    </button>
                    <h1 className="checkout-card__title">Ready to feast?</h1>
                    <p className="checkout-card__subtitle">
                        Double-check your picks then fire them to the kitchen. You can always add more later.
                    </p>
                </header>

                {cartItems.length === 0 ? (
                    <div className="empty-state-card empty-state-card--center">
                        <p className="mb-3">Your cart is feeling a little lonely.</p>
                        <Button onClick={handleBackToMenu}>Browse the menu</Button>
                    </div>
                ) : (
                    <>
                        <ul className="checkout-list">
                            {cartItems.map((item) => (
                                <li key={item.id} className="checkout-list__item">
                                    <img
                                        src={resolveAssetUrl(item.imageUrl) || FALLBACK_IMAGE}
                                        alt={item.name}
                                        loading="lazy"
                                        className="checkout-list__image"
                                    />
                                    <div className="checkout-list__body">
                                        <div>
                                            <h2 className="checkout-list__name">{item.name}</h2>
                                            {item.description && (
                                                <p className="checkout-list__description">{item.description.slice(0, 90)}{item.description.length > 90 ? '…' : ''}</p>
                                            )}
                                        </div>
                                        <div className="checkout-list__controls">
                                            <button
                                                type="button"
                                                className="checkout-list__quantity-btn"
                                                onClick={() => decrementItem(item.id)}
                                                aria-label={`Decrease ${item.name}`}
                                            >
                                                -
                                            </button>
                                            <span className="checkout-list__quantity">{item.quantity}</span>
                                            <button
                                                type="button"
                                                className="checkout-list__quantity-btn"
                                                onClick={() => incrementItem(item.id)}
                                                aria-label={`Increase ${item.name}`}
                                            >
                                                +
                                            </button>
                                        </div>
                                    </div>
                                    <div className="checkout-list__price">{formatPrice(item.priceCents * item.quantity)}</div>
                                </li>
                            ))}
                        </ul>

                        <div className="checkout-summary">
                            <div className="checkout-summary__row">
                                <span>Items</span>
                                <span>{cartQuantity}</span>
                            </div>
                            <div className="checkout-summary__row">
                                <span>Subtotal</span>
                                <span>{formatPrice(totalCents)}</span>
                            </div>
                            {availableCustomerVouchers.length > 0 && (
                                <div className="checkout-summary__row flex-column align-items-start">
                                    <Form.Label className="small text-muted mb-1">Voucher</Form.Label>
                                    <Form.Select
                                        size="sm"
                                        value={selectedVoucherId}
                                        onChange={(event) => setSelectedVoucherId(event.target.value)}
                                    >
                                        <option value="">Don&apos;t apply</option>
                                        {availableCustomerVouchers.map((voucher) => (
                                            <option key={voucher.id} value={voucher.id}>
                                                {(voucher.voucher?.code || 'Voucher')} · {voucher.voucher?.name || 'Saved reward'}
                                                {voucher.expiresAt
                                                    ? ` (expires ${new Date(voucher.expiresAt).toLocaleDateString()})`
                                                    : ''}
                                            </option>
                                        ))}
                                    </Form.Select>
                                    {selectedVoucher && selectedVoucher.voucher?.allowStackWithPoints === false && (
                                        <span className="text-muted small mt-1">
                                            This voucher cannot be combined with loyalty credits.
                                        </span>
                                    )}
                                </div>
                            )}
                            {voucherDiscountPreview > 0 && (
                                <div className="checkout-summary__row">
                                    <span>Voucher</span>
                                    <span>-{formatPrice(voucherDiscountPreview)}</span>
                                </div>
                            )}
                            {discountBalanceCents > 0 && (
                                <div className="checkout-summary__row flex-column align-items-start">
                                    <Form.Check
                                    type="switch"
                                    id="apply-loyalty-discount"
                                    label={`Apply loyalty discount (banked)`}
                                    checked={useDiscount}
                                    disabled={
                                        discountBalanceCents === 0 ||
                                        (selectedVoucher && selectedVoucher.voucher?.allowStackWithPoints === false)
                                    }
                                    onChange={(event) => setUseDiscount(event.target.checked)}
                                />
                                    {loyaltyPoints > 0 && (
                                        <span className="text-muted small">{loyaltyPoints} point{loyaltyPoints === 1 ? '' : 's'} available</span>
                                    )}
                                </div>
                            )}
                            {discountToApply > 0 && (
                                <div className="checkout-summary__row">
                                    <span>Loyalty discount</span>
                                    <span>-{formatPrice(discountToApply)}</span>
                                </div>
                            )}
                            <div className="checkout-summary__row checkout-summary__row--total">
                                <span>Total due</span>
                                <span>{formatPrice(finalTotalCents)}</span>
                            </div>
                        </div>

                        {session?.sessionToken && cartItems.length > 0 && (
                            <div className="checkout-recommendations mt-4">
                                <div className="checkout-recommendations__header">
                                    <h2 className="h5 mb-0">Recommended for you</h2>
                                    {loadingRecommendations && (
                                        <Spinner animation="border" size="sm" variant="secondary" className="ms-2" />
                                    )}
                                </div>
                                {recommendationError ? (
                                    <div className="alert alert-warning py-2 px-3 mt-3 mb-0">
                                        {recommendationError}
                                    </div>
                                ) : recommendations.length === 0 ? (
                                    <p className="text-muted small mt-3 mb-0">
                                        We&apos;re learning from guests&apos; favorite combos to surface great pairings.
                                    </p>
                                ) : (
                                    <div className="checkout-recommendations__list mt-3">
                                        {recommendations.map((recommendation) => {
                                            const item = recommendation.menuItem;
                                            if (!item) {
                                                return null;
                                            }
                                            const attachPercent = Math.round((recommendation.attachRate || 0) * 100);
                                            const imageUrl = resolveAssetUrl(item.imageUrl) || FALLBACK_IMAGE;
                                            return (
                                                <article className="checkout-recommendations__card" key={item.id}>
                                                    <div className="checkout-recommendations__media">
                                                        <img
                                                            src={imageUrl}
                                                            alt={item.name}
                                                            onError={(event) => {
                                                                event.currentTarget.src = FALLBACK_IMAGE;
                                                            }}
                                                        />
                                                    </div>
                                                    <div className="checkout-recommendations__content">
                                                        <h3 className="checkout-recommendations__name">{item.name}</h3>
                                                        {item.description && (
                                                            <p className="checkout-recommendations__description">
                                                                {item.description.length > 80
                                                                    ? `${item.description.slice(0, 77)}…`
                                                                    : item.description}
                                                            </p>
                                                        )}
                                                        <div className="checkout-recommendations__footer">
                                                            <div>
                                                                <span className="checkout-recommendations__price">
                                                                    {formatPrice(item.priceCents)}
                                                                </span>
                                                                {attachPercent > 0 && (
                                                                    <span className="checkout-recommendations__meta">
                                                                        {attachPercent}% of guests added this
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <Button
                                                                variant="outline-primary"
                                                                size="sm"
                                                                onClick={() => handleAddRecommendation(item)}
                                                            >
                                                                Add
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </article>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="checkout-payment mt-4">
                            <h2 className="h5 mb-3">Payment</h2>
                            <div className="d-flex flex-wrap gap-3 mb-3">
                                <Form.Check
                                    type="radio"
                                    id="payment-mode-card"
                                    name="payment-mode"
                                    label="Online card"
                                    value="card"
                                    checked={paymentMode === 'card'}
                                    onChange={() => setPaymentMode('card')}
                                    disabled={placingOrder || processingPayment}
                                />
                                <Form.Check
                                    type="radio"
                                    id="payment-mode-cash"
                                    name="payment-mode"
                                    label="Pay at counter"
                                    value="cash"
                                    checked={paymentMode === 'cash'}
                                    onChange={() => setPaymentMode('cash')}
                                    disabled={placingOrder || processingPayment}
                                />
                            </div>
                            {paymentMode === 'card' ? (
                                finalTotalCents > 0 ? (
                                    <>
                                        {paymentIntent ? (
                                            <div className="alert alert-success py-2 px-3 d-flex justify-content-between align-items-center">
                                                <span>
                                                    Ready to place order with{' '}
                                                    {paymentIntent.cardBrand ? paymentIntent.cardBrand.toUpperCase() : 'card'}{' '}
                                                    ending in {paymentIntent.cardLast4 || '****'}.
                                                </span>
                                                <Button
                                                    variant="link"
                                                    size="sm"
                                                    className="p-0 ms-3"
                                                    onClick={() => {
                                                        setPaymentIntent(null);
                                                        setPaymentError('');
                                                        resetCardTouched();
                                                        setCardNumber('');
                                                        setCardName('');
                                                        setCardExpMonth('');
                                                        setCardExpYear('');
                                                        setCardCvc('');
                                                    }}
                                                >
                                                    Use a different card
                                                </Button>
                                            </div>
                                        ) : (
                                            <Form.Text muted className="d-block mb-3">
                                                Use the Stripe test card 4242 4242 4242 4242 with any future expiry and CVC to
                                                simulate a successful payment.
                                            </Form.Text>
                                        )}
                                        {paymentError && (
                                            <div className="alert alert-danger py-2 px-3">{paymentError}</div>
                                        )}
                                        <Form.Group className="mb-3">
                                            <Form.Label>Card number</Form.Label>
                                            <Form.Control
                                                type="text"
                                                inputMode="numeric"
                                                autoComplete="cc-number"
                                                value={cardNumber}
                                                placeholder="4242 4242 4242 4242"
                                                disabled={paymentFormDisabled}
                                                isInvalid={cardTouched.number && Boolean(cardErrors.number)}
                                                onChange={(event) => {
                                                    const digits = event.target.value.replace(/\D/g, '').slice(0, 19);
                                                    const formatted = digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
                                                    setCardNumber(formatted);
                                                    setPaymentError('');
                                                }}
                                                onBlur={() => setCardTouched((prev) => ({ ...prev, number: true }))}
                                            />
                                            <Form.Control.Feedback type="invalid">{cardErrors.number}</Form.Control.Feedback>
                                        </Form.Group>
                                        <Form.Group className="mb-3">
                                            <Form.Label>Name on card</Form.Label>
                                            <Form.Control
                                                type="text"
                                                autoComplete="cc-name"
                                                disabled={paymentFormDisabled}
                                                value={cardName}
                                                onChange={(event) => {
                                                    setCardName(event.target.value);
                                                    setPaymentError('');
                                                }}
                                            />
                                        </Form.Group>
                                        <div className="d-flex gap-3">
                                            <Form.Group className="mb-3 flex-fill">
                                                <Form.Label>Expiry month</Form.Label>
                                                <Form.Control
                                                    type="text"
                                                    inputMode="numeric"
                                                    autoComplete="cc-exp-month"
                                                    placeholder="MM"
                                                    disabled={paymentFormDisabled}
                                                    value={cardExpMonth}
                                                    isInvalid={cardTouched.expMonth && Boolean(cardErrors.expiry)}
                                                    onChange={(event) => {
                                                        setCardExpMonth(event.target.value.replace(/\D/g, '').slice(0, 2));
                                                        setPaymentError('');
                                                    }}
                                                    onBlur={() => setCardTouched((prev) => ({ ...prev, expMonth: true }))}
                                                />
                                                <Form.Control.Feedback type="invalid">
                                                    {cardErrors.expiry}
                                                </Form.Control.Feedback>
                                            </Form.Group>
                                            <Form.Group className="mb-3 flex-fill">
                                                <Form.Label>Expiry year</Form.Label>
                                                <Form.Control
                                                    type="text"
                                                    inputMode="numeric"
                                                    autoComplete="cc-exp-year"
                                                    placeholder="YYYY"
                                                    disabled={paymentFormDisabled}
                                                    value={cardExpYear}
                                                    isInvalid={cardTouched.expYear && Boolean(cardErrors.expiry)}
                                                    onChange={(event) => {
                                                        setCardExpYear(event.target.value.replace(/\D/g, '').slice(0, 4));
                                                        setPaymentError('');
                                                    }}
                                                    onBlur={() => setCardTouched((prev) => ({ ...prev, expYear: true }))}
                                                />
                                                <Form.Control.Feedback type="invalid">
                                                    {cardErrors.expiry}
                                                </Form.Control.Feedback>
                                            </Form.Group>
                                            <Form.Group className="mb-3 flex-fill">
                                                <Form.Label>CVC</Form.Label>
                                                <Form.Control
                                                    type="password"
                                                    inputMode="numeric"
                                                    autoComplete="cc-csc"
                                                    placeholder="CVC"
                                                    disabled={paymentFormDisabled}
                                                    value={cardCvc}
                                                    isInvalid={cardTouched.cvc && Boolean(cardErrors.cvc)}
                                                    onChange={(event) => {
                                                        setCardCvc(event.target.value.replace(/\D/g, '').slice(0, 4));
                                                        setPaymentError('');
                                                    }}
                                                    onBlur={() => setCardTouched((prev) => ({ ...prev, cvc: true }))}
                                                />
                                                <Form.Control.Feedback type="invalid">
                                                    {cardErrors.cvc}
                                                </Form.Control.Feedback>
                                            </Form.Group>
                                        </div>
                                    </>
                                ) : (
                                    <div className="alert alert-info py-2 px-3 mb-0">
                                        Discounts cover the total. No payment is required.
                                    </div>
                                )
                            ) : finalTotalCents > 0 ? (
                                <div className="alert alert-warning py-2 px-3 mb-0">
                                    We will reserve your order. Please pay at the cashier counter before leaving.
                                </div>
                            ) : (
                                <div className="alert alert-info py-2 px-3 mb-0">
                                    No payment needed — we will get started right away.
                                </div>
                            )}
                        </div>
                        <div className="checkout-actions">
                            <Button variant="outline-secondary" onClick={clearCart} disabled={placingOrder}>
                                Clear cart
                            </Button>
                            <Button variant="outline-danger" onClick={async () => {
                                if (!session?.sessionToken) {
                                    toast.error('Session expired.');
                                    return;
                                }
                                try {
                                    await closeSession({ sessionToken: session.sessionToken });
                                } catch (err) {
                                    // ignore errors — still clear local session
                                }
                                clearSession();
                                toast.info('Session ended. Thank you!');
                                navigate('/');
                            }} className="me-2">
                                End session
                            </Button>
                            <Button onClick={handlePlaceOrder} disabled={placeOrderDisabled}>
                                {placingOrder ? (
                                    <>
                                        <Spinner animation="border" size="sm" className="me-2" />
                                        Sending...
                                    </>
                                ) : processingPayment ? (
                                    <>
                                        <Spinner animation="border" size="sm" className="me-2" />
                                        Authorising...
                                    </>
                                ) : (
                                    payInCash ? 'Place order (pay at counter)' : requiresOnlinePayment ? 'Pay & place order' : 'Place order now'
                                )}
                            </Button>
                        </div>
                    </>
                )}
            </section>
        </div>
    );
};

export default CheckoutPage;
