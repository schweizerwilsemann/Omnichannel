import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Spinner } from 'react-bootstrap';
import { toast } from 'react-toastify';
import { useSession } from '../context/SessionContext.jsx';
import { fetchMenu, placeCustomerOrder } from '../services/session.js';
import MenuCategory from '../components/menu/MenuCategory.jsx';

const formatPrice = (cents) => `₫${(cents / 100).toFixed(2)}`;

const CartSummary = ({ items, totalCents, onIncrement, onDecrement, onClear, onCheckout, placing }) => {
    if (items.length === 0) {
        return (
            <Card className="shadow-sm">
                <Card.Body className="text-center text-muted">Your cart is empty. Add items to place an order.</Card.Body>
            </Card>
        );
    }

    return (
        <Card className="shadow-sm">
            <Card.Body className="d-flex flex-column gap-3">
                <div className="d-flex justify-content-between align-items-center">
                    <h5 className="mb-0">Your order</h5>
                    <Button variant="link" size="sm" className="text-danger" onClick={onClear}>
                        Clear
                    </Button>
                </div>
                <div className="d-flex flex-column gap-2">
                    {items.map((item) => (
                        <div key={item.id} className="d-flex justify-content-between align-items-center">
                            <div>
                                <div className="fw-semibold">{item.name}</div>
                                <div className="text-muted small">{formatPrice(item.priceCents)}</div>
                            </div>
                            <div className="d-flex align-items-center gap-2">
                                <Button variant="outline-secondary" size="sm" onClick={() => onDecrement(item.id)}>
                                    -
                                </Button>
                                <span className="fw-semibold">{item.quantity}</span>
                                <Button variant="outline-secondary" size="sm" onClick={() => onIncrement(item.id)}>
                                    +
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="d-flex justify-content-between align-items-center">
                    <span className="fw-semibold">Total</span>
                    <span className="fw-bold fs-5">{formatPrice(totalCents)}</span>
                </div>
                <Button onClick={onCheckout} disabled={placing}>
                    {placing ? (
                        <>
                            <Spinner animation="border" size="sm" className="me-2" />
                            Placing order...
                        </>
                    ) : (
                        'Place order'
                    )}
                </Button>
            </Card.Body>
        </Card>
    );
};

const MenuPage = () => {
    const { session, markOrdersDirty } = useSession();
    const [menuData, setMenuData] = useState({ categories: [] });
    const [loadingMenu, setLoadingMenu] = useState(false);
    const [menuError, setMenuError] = useState(null);
    const [cart, setCart] = useState({});
    const [placingOrder, setPlacingOrder] = useState(false);

    const sessionToken = session?.sessionToken;

    const loadMenu = async () => {
        if (!sessionToken) {
            return;
        }

        setLoadingMenu(true);
        setMenuError(null);
        try {
            const response = await fetchMenu(sessionToken);
            setMenuData(response.data?.data || { categories: [] });
        } catch (error) {
            const message = error.response?.data?.message || error.message || 'Unable to load menu';
            setMenuError(message);
        } finally {
            setLoadingMenu(false);
        }
    };

    useEffect(() => {
        loadMenu();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sessionToken]);

    const addToCart = (menuItem) => {
        setCart((prev) => {
            const existing = prev[menuItem.id];
            const quantity = existing ? existing.quantity + 1 : 1;
            return {
                ...prev,
                [menuItem.id]: {
                    id: menuItem.id,
                    name: menuItem.name,
                    priceCents: menuItem.priceCents,
                    quantity
                }
            };
        });
    };

    const incrementItem = (menuItemId) => {
        const menuItem = menuData.categories
            .flatMap((category) => category.items || [])
            .find((item) => item.id === menuItemId);

        if (menuItem) {
            addToCart(menuItem);
        }
    };

    const decrementItem = (menuItemId) => {
        setCart((prev) => {
            const existing = prev[menuItemId];
            if (!existing) {
                return prev;
            }
            const nextQuantity = existing.quantity - 1;
            if (nextQuantity <= 0) {
                const { [menuItemId]: _removed, ...rest } = prev;
                return rest;
            }
            return {
                ...prev,
                [menuItemId]: {
                    ...existing,
                    quantity: nextQuantity
                }
            };
        });
    };

    const clearCart = () => setCart({});

    const cartItems = useMemo(() => Object.values(cart), [cart]);
    const cartTotalCents = useMemo(
        () => cartItems.reduce((total, item) => total + item.priceCents * item.quantity, 0),
        [cartItems]
    );

    const handlePlaceOrder = async () => {
        if (!sessionToken) {
            toast.error('Session expired. Please refresh the page.');
            return;
        }
        if (cartItems.length === 0) {
            toast.info('Add items to the cart before placing an order.');
            return;
        }

        try {
            setPlacingOrder(true);
            await placeCustomerOrder({
                sessionToken,
                items: cartItems.map((item) => ({
                    menuItemId: item.id,
                    quantity: item.quantity
                }))
            });
            toast.success('Order placed! Check the Orders tab for updates.');
            clearCart();
            markOrdersDirty();
        } catch (error) {
            const message = error.response?.data?.message || error.message || 'Unable to place order';
            toast.error(message);
        } finally {
            setPlacingOrder(false);
        }
    };

    return (
        <div className="d-flex flex-column gap-4">
            <div className="d-flex justify-content-between align-items-center">
                <div>
                    <h2 className="mb-0">Menu</h2>
                    <p className="text-muted mb-0">Select your favorites and send your order to the kitchen.</p>
                </div>
                <Button variant="outline-secondary" size="sm" onClick={loadMenu} disabled={loadingMenu}>
                    {loadingMenu ? 'Refreshing...' : 'Refresh'}
                </Button>
            </div>

            {menuError && <Alert variant="danger">{menuError}</Alert>}

            {loadingMenu ? (
                <div className="d-flex justify-content-center py-5">
                    <Spinner animation="border" />
                </div>
            ) : menuData.categories.length === 0 ? (
                <Card className="shadow-sm">
                    <Card.Body className="text-center text-muted">Menu is not available right now. Please check back soon.</Card.Body>
                </Card>
            ) : (
                menuData.categories.map((category) => (
                    <MenuCategory key={category.id} category={category} onAdd={addToCart} />
                ))
            )}

            <CartSummary
                items={cartItems}
                totalCents={cartTotalCents}
                onIncrement={incrementItem}
                onDecrement={decrementItem}
                onClear={clearCart}
                onCheckout={handlePlaceOrder}
                placing={placingOrder}
            />
        </div>
    );
};

export default MenuPage;
