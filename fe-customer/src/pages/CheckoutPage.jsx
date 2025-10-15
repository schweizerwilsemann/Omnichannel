import { useEffect, useState } from 'react';
import { Button, Spinner, Form } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useCart } from '../context/CartContext.jsx';
import { useSession } from '../context/SessionContext.jsx';
import { placeCustomerOrder, closeSession } from '../services/session.js';

const formatPrice = (cents) => `USD ${(cents / 100).toFixed(2)}`;
const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&h=600&fit=crop&crop=center';

const CheckoutPage = () => {
    const navigate = useNavigate();
    const { cartItems, cartQuantity, totalCents, incrementItem, decrementItem, clearCart } = useCart();
    const { session, markOrdersDirty, updateSession, clearSession } = useSession();
    const [placingOrder, setPlacingOrder] = useState(false);
    const discountBalanceCents = session?.membership?.discountBalanceCents ?? 0;
    const loyaltyPoints = session?.membership?.loyaltyPoints ?? 0;
    const [useDiscount, setUseDiscount] = useState(discountBalanceCents > 0);
    const discountToApply = useDiscount ? Math.min(discountBalanceCents, totalCents) : 0;
    const finalTotalCents = Math.max(totalCents - discountToApply, 0);
    useEffect(() => {
        if (discountBalanceCents === 0 && useDiscount) {
            setUseDiscount(false);
        }
    }, [discountBalanceCents, useDiscount]);



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

        try {
            setPlacingOrder(true);
            const response = await placeCustomerOrder({
                sessionToken: session.sessionToken,
                items: cartItems.map((item) => ({ menuItemId: item.id, quantity: item.quantity })),
                applyLoyaltyDiscount: useDiscount && discountBalanceCents > 0
            });
            const payload = response.data?.data;
            if (payload?.membership) {
                updateSession({ membership: payload.membership });
            }
            const discountAppliedCents = payload?.discountAppliedCents ?? 0;
            const earnedPoints = payload?.earnedLoyaltyPoints ?? 0;
            const messageParts = ['Order placed! We will keep you posted.'];
            if (discountAppliedCents > 0) {
                messageParts.push(`We applied ${formatPrice(discountAppliedCents)} from your loyalty bank.`);
            }
            if (earnedPoints > 0) {
                messageParts.push(`You earned ${earnedPoints} point${earnedPoints === 1 ? '' : 's'}.`);
            }
            toast.success(messageParts.join(' '));
            clearCart();
            markOrdersDirty();
            navigate('/orders');
        } catch (error) {
            const message = error.response?.data?.message || error.message || 'Unable to place order';
            toast.error(message);
        } finally {
            setPlacingOrder(false);
        }
    };

    const handleBackToMenu = () => navigate('/');

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
                                        src={item.imageUrl || FALLBACK_IMAGE}
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
                            {discountBalanceCents > 0 && (
                                <div className="checkout-summary__row flex-column align-items-start">
                                    <Form.Check
                                        type="switch"
                                        id="apply-loyalty-discount"
                                        label={`Apply loyalty discount (banked)`}
                                        checked={useDiscount}
                                        onChange={(event) => setUseDiscount(event.target.checked)}
                                    />
                                    {loyaltyPoints > 0 && (
                                        <span className="text-muted small">{loyaltyPoints} point{loyaltyPoints === 1 ? '' : 's'} available</span>
                                    )}
                                </div>
                            )}
                            {discountToApply > 0 && (
                                <div className="checkout-summary__row">
                                    <span>Discount</span>
                                    <span>-{formatPrice(discountToApply)}</span>
                                </div>
                            )}
                            <div className="checkout-summary__row checkout-summary__row--total">
                                <span>Total due</span>
                                <span>{formatPrice(finalTotalCents)}</span>
                            </div>
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
                            <Button onClick={handlePlaceOrder} disabled={placingOrder}>
                                {placingOrder ? (
                                    <>
                                        <Spinner animation="border" size="sm" className="me-2" />
                                        Sending...
                                    </>
                                ) : (
                                    'Place order now'
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
