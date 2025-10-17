import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Spinner, Modal, Form, Badge, Card } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useSession } from '../context/SessionContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import { fetchMenu, requestMembershipVerification, claimLoyaltyPoints } from '../services/session.js';
import MenuCategory from '../components/menu/MenuCategory.jsx';
import resolveAssetUrl from '../utils/assets.js';

const formatPrice = (cents) => `USD ${(cents / 100).toFixed(2)}`;

const MenuPage = () => {
    const {
        session,
        updateSession,
        loyaltyPointValueCents,
        promotions,
        promotionsLoading,
        claimPromotionVoucher,
        vouchers
    } = useSession();
    const { addItem, cartQuantity, totalCents } = useCart();
    const [menuData, setMenuData] = useState({ categories: [], session: null });
    const [loadingMenu, setLoadingMenu] = useState(false);
    const [menuError, setMenuError] = useState(null);
    const navigate = useNavigate();

    const [showMembershipModal, setShowMembershipModal] = useState(false);
    const [membershipForm, setMembershipForm] = useState({
        firstName: '',
        lastName: '',
        email: '',
        phoneNumber: ''
    });
    const [membershipSubmitting, setMembershipSubmitting] = useState(false);
    const [membershipError, setMembershipError] = useState(null);
    const isMember = session?.membership?.status === 'MEMBER';
    const membershipStatus = session?.membership?.status || 'GUEST';

    // Claim / loyalty UI state
    const [showClaimModal, setShowClaimModal] = useState(false);
    const [claimPointsValue, setClaimPointsValue] = useState('');
    const [claimSubmitting, setClaimSubmitting] = useState(false);
    const [claimError, setClaimError] = useState(null);
    const [claimingPromotionKey, setClaimingPromotionKey] = useState(null);

    // Derived loyalty values
    const loyaltyPoints = session?.membership?.loyaltyPoints || 0;
    const discountBalanceCents = session?.membership?.discountBalanceCents || 0;
    const pointValueCents = loyaltyPointValueCents || 10;

    const sessionToken = session?.sessionToken;
    const availableCustomerVouchers = useMemo(() => vouchers?.available || [], [vouchers]);

    const loadMenu = async () => {
        if (!sessionToken) {
            return;
        }

        setLoadingMenu(true);
        setMenuError(null);
        try {
            const response = await fetchMenu(sessionToken);
            const payload = response.data?.data || { categories: [], session: null };
            setMenuData(payload);
        } catch (error) {
            const message = error.response?.data?.message || error.message || 'Unable to load menu';
            setMenuError(message);
        } finally {
            setLoadingMenu(false);
        }
    };

    const handleClaimPromotion = async (promotionId, voucherId) => {
        if (!sessionToken) {
            toast.error('Session expired. Please refresh the page.');
            return;
        }

        const claimKey = `${promotionId}:${voucherId || 'default'}`;
        try {
            setClaimingPromotionKey(claimKey);
            const claimed = await claimPromotionVoucher({ promotionId, voucherId });
            if (claimed?.alreadyClaimed) {
                toast.info('This voucher is already in your wallet.');
            } else {
                toast.success('Voucher saved to your wallet!');
            }
        } catch (error) {
            const message = error.response?.data?.message || error.message || 'Unable to claim voucher right now.';
            toast.error(message);
        } finally {
            setClaimingPromotionKey(null);
        }
    };

    useEffect(() => {
        loadMenu();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sessionToken]);
    useEffect(() => {
        if (!showMembershipModal) {
            setMembershipError(null);
            return;
        }
        setMembershipForm({
            firstName: session?.customer?.firstName || '',
            lastName: session?.customer?.lastName || '',
            email: session?.customer?.email || '',
            phoneNumber: session?.customer?.phoneNumber || ''
        });
    }, [showMembershipModal, session]);
    const handleMembershipChange = (event) => {
        const { name, value } = event.target;
        setMembershipForm((prev) => ({
            ...prev,
            [name]: value
        }));
    };

    const handleMembershipClose = () => {
        setShowMembershipModal(false);
        setMembershipError(null);
    };

    const handleMembershipSubmit = async (event) => {
        event.preventDefault();
        if (!sessionToken) {
            setMembershipError('Session expired. Please refresh the page.');
            return;
        }
        if (!membershipForm.email) {
            setMembershipError('Email is required to join the membership.');
            return;
        }
        try {
            setMembershipSubmitting(true);
            setMembershipError(null);
            const response = await requestMembershipVerification({
                sessionToken,
                customer: {
                    firstName: membershipForm.firstName || null,
                    lastName: membershipForm.lastName || null,
                    email: membershipForm.email,
                    phoneNumber: membershipForm.phoneNumber || null
                }
            });
            const payload = response.data?.data;
            // flag local session as pending verification so checkout can be blocked until confirmed
            if (payload && payload.expiresAt && payload.membershipStatus !== 'MEMBER') {
                updateSession({ membershipPending: true });
            }
            toast.success('Check your email to verify your membership');
            setShowMembershipModal(false);
        } catch (error) {
            const message = error.response?.data?.message || error.message || 'Unable to process membership request';
            setMembershipError(message);
        } finally {
            setMembershipSubmitting(false);
        }
    };

    const handleMembershipOpen = () => {
        setShowMembershipModal(true);
    };



    const handleClaimOpen = () => {
        if (!sessionToken) {
            toast.error('Session expired. Please refresh the page.');
            return;
        }
        setClaimError(null);
        setClaimPointsValue(loyaltyPoints > 0 ? String(loyaltyPoints) : '');
        setShowClaimModal(true);
    };

    const handleClaimClose = () => {
        setShowClaimModal(false);
        setClaimError(null);
    };

    const handleClaimChange = (event) => {
        setClaimPointsValue(event.target.value);
    };

    const handleClaimSubmit = async (event) => {
        event.preventDefault();
        if (!sessionToken) {
            setClaimError('Session expired. Please refresh the page.');
            return;
        }

        const parsedPoints = parseInt(claimPointsValue, 10);
        if (Number.isNaN(parsedPoints) || parsedPoints <= 0) {
            setClaimError('Enter how many points you want to convert.');
            return;
        }
        if (parsedPoints > loyaltyPoints) {
            setClaimError('You do not have that many points to claim.');
            return;
        }

        try {
            setClaimSubmitting(true);
            setClaimError(null);
            const response = await claimLoyaltyPoints({
                sessionToken,
                points: parsedPoints
            });
            const payload = response.data?.data;
            if (payload) {
                updateSession({
                    membership: {
                        loyaltyPoints: payload.loyaltyPoints,
                        discountBalanceCents: payload.discountBalanceCents
                    }
                });
            }
            toast.success(`Converted ${parsedPoints} point${parsedPoints === 1 ? '' : 's'} into a discount for your next visit.`);
            setClaimPointsValue('');
            setShowClaimModal(false);
        } catch (error) {
            const message = error.response?.data?.message || error.message || 'Unable to claim points right now.';
            setClaimError(message);
        } finally {
            setClaimSubmitting(false);
        }
    };

    const handleAddToCart = (menuItem) => {
        addItem(menuItem);
        toast.success(`${menuItem.name} added to cart`, { toastId: `add-${menuItem.id}` });
    };

    const activeCategories = useMemo(
        () => (menuData.categories || []).filter((category) => Array.isArray(category.items) && category.items.length > 0),
        [menuData.categories]
    );

    const quickFilters = useMemo(() => activeCategories.slice(0, 6), [activeCategories]);

    const scrollToCategory = (categoryId) => {
        const element = document.getElementById(`category-${categoryId}`);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    return (
        <div className="menu-page">
            <section className="menu-hero gradient-card">
                <div className="menu-hero__content">
                    <p className="menu-hero__eyebrow">welcome back{session?.customer?.firstName ? `, ${session.customer.firstName}` : ''}</p>
                    <h1 className="menu-hero__title">Curated bites made for vibey nights.</h1>
                    <p className="menu-hero__subtitle">
                        Order straight from your table at {session?.restaurant?.name || 'our pop-up'}. Tap a dish to drop it into your cart and we
                        will ping you when it is ready.
                    </p>
                    <p className="menu-hero__highlight">
                        {isMember
                            ? 'You already have loyalty perks activated for this table.'
                            : 'Join the membership to collect points and unlock little surprises.'}
                    </p>
                    <div className="menu-hero__actions">
                        <Button variant="light" size="sm" onClick={loadMenu} disabled={loadingMenu}>
                            {loadingMenu ? 'Refreshing...' : 'Refresh menu'}
                        </Button>
                        {!isMember && (
                            <Button variant="outline-light" size="sm" onClick={handleMembershipOpen}>
                                Join membership
                            </Button>
                        )}
                        <Button variant="outline-light" size="sm" onClick={() => navigate('/orders')}>
                            Track orders
                        </Button>
                    </div>
                </div>
            </section>

            {quickFilters.length > 0 && (
                <div className="menu-quick-filters">
                    <span className="menu-quick-filters__label">Get to the good stuff</span>
                    <div className="menu-quick-filters__chips">
                        {quickFilters.map((category) => (
                            <button
                                key={category.id}
                                type="button"
                                className="menu-quick-filters__chip"
                                onClick={() => scrollToCategory(category.id)}
                            >
                                {category.name}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {sessionToken && (
                <section className="card shadow-sm mb-4 p-3">
                    <div className="d-flex flex-column flex-lg-row justify-content-between gap-3">
                        <div>
                            <h2 className="h5 mb-1">Loyalty perks</h2>
                            <p className="text-muted mb-0">
                                Status: {membershipStatus}. Each point converts to {formatPrice(pointValueCents)} in discount.
                            </p>
                        </div>
                        <div className="d-flex flex-wrap gap-4 align-items-center">
                            <div>
                                <div className="fw-semibold fs-5">{loyaltyPoints}</div>
                                <div className="text-muted small">Points available</div>
                            </div>
                            <div>
                                <div className="fw-semibold fs-5">{formatPrice(discountBalanceCents)}</div>
                                <div className="text-muted small">Discount bank</div>
                            </div>
                            <div className="d-flex gap-2">
                                <Button
                                    size="sm"
                                    variant="outline-primary"
                                    onClick={handleClaimOpen}
                                    disabled={loyaltyPoints <= 0 || claimSubmitting}
                                >
                                    Claim points
                                </Button>
                                {!isMember && (
                                    <Button size="sm" variant="outline-secondary" onClick={handleMembershipOpen}>
                                        Join membership
                                    </Button>
                                )}
                            </div>
                        </div>
                        {availableCustomerVouchers.length > 0 && (
                            <div className="w-100 mt-3">
                                <div className="text-muted small fw-semibold text-uppercase">My vouchers</div>
                                <div className="d-flex flex-wrap gap-2 mt-2">
                                    {availableCustomerVouchers.slice(0, 3).map((voucher) => (
                                        <div className="border rounded px-3 py-2 bg-light" key={voucher.id}>
                                            <div className="fw-semibold">{voucher.voucher?.code || 'Voucher'}</div>
                                            <div className="small text-muted">
                                                {voucher.voucher?.name || 'Saved reward'}
                                                {voucher.expiresAt
                                                    ? ` · Expires ${new Date(voucher.expiresAt).toLocaleDateString()}`
                                                    : ''}
                                            </div>
                                        </div>
                                    ))}
                                    {availableCustomerVouchers.length > 3 ? (
                                        <button type="button" className="cta-link" onClick={() => navigate('/vouchers')}>
                                            View all
                                        </button>
                                    ) : null}
                                </div>
                            </div>
                        )}
                    </div>
                    {discountBalanceCents > 0 && (
                        <p className="text-muted small mb-0 mt-2">
                            We will offer to apply your discount when you check out.
                        </p>
                    )}
                </section>
            )}

            {(promotionsLoading || promotions.length > 0) && (
                <section className="card shadow-sm mb-4 p-3">
                    <div className="d-flex justify-content-between align-items-center mb-3">
                        <h2 className="h5 mb-0">Today&apos;s promotions</h2>
                        <span className="text-muted small">Claim vouchers before they run out</span>
                    </div>
                    {promotionsLoading ? (
                        <div className="d-flex justify-content-center py-4">
                            <Spinner animation="border" size="sm" />
                        </div>
                    ) : promotions.length === 0 ? (
                        <p className="text-muted mb-0">No active promotions right now. Check back soon!</p>
                    ) : (
                        promotions.map((promotion) => {
                            const highlightVoucher = (promotion.vouchers || [])[0] || null;
                            const promotionKeyBase = promotion.id;
                            const renderClaimAction = (voucher) => {
                                const key = `${promotionKeyBase}:${voucher.id}`;
                                if (voucher.customerVoucher) {
                                    return (
                                        <Badge bg="success">Saved to wallet</Badge>
                                    );
                                }

                                if (!isMember) {
                                    return (
                                        <Button
                                            size="sm"
                                            variant="outline-secondary"
                                            onClick={handleMembershipOpen}
                                        >
                                            Join loyalty to claim
                                        </Button>
                                    );
                                }

                                if (!voucher.claimable) {
                                    return <Badge bg="secondary">Not available</Badge>;
                                }

                                const isClaiming = claimingPromotionKey === key;
                                return (
                                    <Button
                                        size="sm"
                                        onClick={() => handleClaimPromotion(promotion.id, voucher.id)}
                                        disabled={isClaiming}
                                    >
                                        {isClaiming ? 'Claiming…' : 'Claim voucher'}
                                    </Button>
                                );
                            };

                            return (
                                <Card className="mb-3" key={promotion.id}>
                                    <Card.Body className="d-flex flex-column flex-lg-row gap-3">
                                        <div className="flex-grow-1">
                                            <div className="d-flex align-items-center gap-2 mb-2">
                                                <h3 className="h6 mb-0">{promotion.headline || promotion.name}</h3>
                                                <Badge bg="primary">{promotion.status}</Badge>
                                            </div>
                                            {promotion.description && (
                                                <p className="text-muted mb-2">{promotion.description}</p>
                                            )}
                                            {highlightVoucher && (
                                                <div className="mb-2">
                                                    <strong>{highlightVoucher.name}</strong>
                                                    <ul className="small text-muted mb-2 ps-3">
                                                        {(highlightVoucher.tiers || []).map((tier) => (
                                                            <li key={tier.id || `${tier.minSpendCents}-${tier.discountPercent}`}>
                                                                Spend {formatPrice(tier.minSpendCents)} → {tier.discountPercent}% off
                                                                {tier.maxDiscountCents
                                                                    ? ` (max ${formatPrice(tier.maxDiscountCents)})`
                                                                    : ''}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                    <div className="d-flex align-items-center gap-2">
                                                        {renderClaimAction(highlightVoucher)}
                                                        {highlightVoucher.customerVoucher?.status && (
                                                            <Badge bg="light" text="dark">
                                                                {highlightVoucher.customerVoucher.status}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                            <div className="text-muted small">
                                                {highlightVoucher?.validUntil
                                                    ? `Valid until ${new Date(highlightVoucher.validUntil).toLocaleDateString()}`
                                                    : promotion.endsAt
                                                        ? `Campaign ends ${new Date(promotion.endsAt).toLocaleDateString()}`
                                                        : 'Limited time offer'}
                                            </div>
                                        </div>
                                        {promotion.bannerImageUrl && (
                                            <img
                                                src={resolveAssetUrl(promotion.bannerImageUrl)}
                                                alt={promotion.name}
                                                className="rounded"
                                                style={{
                                                    maxWidth: '220px',
                                                    objectFit: 'cover'
                                                }}
                                            />
                                        )}
                                    </Card.Body>
                                </Card>
                            );
                        })
                    )}
                </section>
            )}

            <section className="menu-section">
                {menuError && <Alert variant="danger">{menuError}</Alert>}

                {loadingMenu ? (
                    <div className="d-flex justify-content-center py-5">
                        <Spinner animation="border" />
                    </div>
                ) : activeCategories.length === 0 ? (
                    <div className="empty-state-card">
                        <p className="mb-0">Menu is not available right now. Check back in a bit.</p>
                    </div>
                ) : (
                    activeCategories.map((category) => (
                        <MenuCategory key={category.id} category={category} onAdd={handleAddToCart} />
                    ))
                )}
            </section>

            {cartQuantity > 0 && (
                <button type="button" className="menu-floating-cart" onClick={() => navigate('/checkout')}>
                    <div className="menu-floating-cart__summary">
                        <span className="menu-floating-cart__count">{cartQuantity} item{cartQuantity > 1 ? 's' : ''}</span>
                        <span className="menu-floating-cart__total">{formatPrice(totalCents)}</span>
                    </div>
                    <span className="menu-floating-cart__cta">Review & checkout</span>
                </button>
            )}
            <Modal show={showMembershipModal} onHide={handleMembershipClose} centered>
                <Form onSubmit={handleMembershipSubmit}>
                    <Modal.Header closeButton>
                        <Modal.Title>Join the loyalty crew</Modal.Title>
                    </Modal.Header>
                    <Modal.Body className="d-flex flex-column gap-3">
                        <p className="text-muted mb-0">
                            {`Current status: ${membershipStatus}.`}
                        </p>
                        <p className="text-muted">We will email you a quick verification link so you can start earning points.</p>
                        {membershipError && (
                            <Alert variant="danger" className="mb-0">
                                {membershipError}
                            </Alert>
                        )}
                        <Form.Group controlId="membershipFirstName">
                            <Form.Label>First name</Form.Label>
                            <Form.Control
                                type="text"
                                name="firstName"
                                placeholder="Jamie"
                                value={membershipForm.firstName}
                                onChange={handleMembershipChange}
                                autoComplete="given-name"
                            />
                        </Form.Group>
                        <Form.Group controlId="membershipLastName">
                            <Form.Label>Last name</Form.Label>
                            <Form.Control
                                type="text"
                                name="lastName"
                                placeholder="Rivera"
                                value={membershipForm.lastName}
                                onChange={handleMembershipChange}
                                autoComplete="family-name"
                            />
                        </Form.Group>
                        <Form.Group controlId="membershipEmail">
                            <Form.Label>Email</Form.Label>
                            <Form.Control
                                type="email"
                                name="email"
                                placeholder="you@example.com"
                                value={membershipForm.email}
                                onChange={handleMembershipChange}
                                required
                                autoComplete="email"
                            />
                            <Form.Text className="text-muted">We will send the verification link to this inbox.</Form.Text>
                        </Form.Group>
                        <Form.Group controlId="membershipPhone">
                            <Form.Label>Phone number</Form.Label>
                            <Form.Control
                                type="tel"
                                name="phoneNumber"
                                placeholder="09xx xxx xxxx"
                                value={membershipForm.phoneNumber}
                                onChange={handleMembershipChange}
                                autoComplete="tel"
                            />
                        </Form.Group>
                    </Modal.Body>
                    <Modal.Footer>
                        <Button variant="outline-secondary" onClick={handleMembershipClose} disabled={membershipSubmitting}>
                            Close
                        </Button>
                        <Button type="submit" disabled={membershipSubmitting}>
                            {membershipSubmitting ? 'Sending…' : 'Send verification email'}
                        </Button>
                    </Modal.Footer>
                </Form>
            </Modal>
            <Modal show={showClaimModal} onHide={handleClaimClose} centered>
                <Form onSubmit={handleClaimSubmit}>
                    <Modal.Header closeButton>
                        <Modal.Title>Claim loyalty points</Modal.Title>
                    </Modal.Header>
                    <Modal.Body className="d-flex flex-column gap-3">
                        <p className="text-muted mb-0">
                            Each point converts to {formatPrice(pointValueCents)}. You currently have {loyaltyPoints} point{loyaltyPoints === 1 ? '' : 's'}.
                        </p>
                        {claimError && (
                            <Alert variant="danger" className="mb-0">
                                {claimError}
                            </Alert>
                        )}
                        <Form.Group controlId="claimPoints">
                            <Form.Label>Points to claim</Form.Label>
                            <Form.Control
                                type="number"
                                min="1"
                                max={loyaltyPoints || undefined}
                                value={claimPointsValue}
                                onChange={ handleClaimChange }
                                placeholder="10"
                            />
                        </Form.Group>
                    </Modal.Body>
                    <Modal.Footer>
                        <Button variant="outline-secondary" onClick={handleClaimClose} disabled={claimSubmitting}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={claimSubmitting || loyaltyPoints <= 0}>
                            {claimSubmitting ? 'Converting...' : 'Convert to discount'}
                        </Button>
                    </Modal.Footer>
                </Form>
            </Modal>
            {/* Verification pending modal: shown when session indicates pending membership verification */}
            <Modal show={session?.membershipPending} onHide={() => updateSession({ membershipPending: false })} centered>
                <Modal.Header>
                    <Modal.Title>Verify your email</Modal.Title>
                </Modal.Header>
                <Modal.Body className="d-flex flex-column gap-3">
                    <p className="mb-0">We've sent a verification link to your email. Please click the link to confirm your membership before placing orders.</p>
                    <p className="text-muted mb-0">If you've already verified, press the button below to refresh your session.</p>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="outline-secondary" onClick={() => updateSession({ membershipPending: false })}>
                        Dismiss
                    </Button>
                    <Button
                        onClick={async () => {
                            // refresh menu/session to pick up membership changes
                            try {
                                await loadMenu();
                                updateSession({ membershipPending: false });
                                toast.success('Session refreshed');
                            } catch (err) {
                                toast.error('Unable to refresh session');
                            }
                        }}
                    >
                        I have verified
                    </Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
};

export default MenuPage;
