import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useSession } from './SessionContext.jsx';

const CartContext = createContext(null);
const STORAGE_PREFIX = 'omnichannel.customer.cart';

const readFromStorage = (key) => {
    if (typeof window === 'undefined' || !key) {
        return {};
    }

    try {
        const raw = window.localStorage.getItem(key);
        if (!raw) {
            return {};
        }
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
            return parsed;
        }
        return {};
    } catch (error) {
        console.warn('Unable to read cart from storage', error);
        return {};
    }
};

const writeToStorage = (key, value) => {
    if (typeof window === 'undefined' || !key) {
        return;
    }

    try {
        if (!value || Object.keys(value).length === 0) {
            window.localStorage.removeItem(key);
        } else {
            window.localStorage.setItem(key, JSON.stringify(value));
        }
    } catch (error) {
        console.warn('Unable to persist cart', error);
    }
};

export const CartProvider = ({ children }) => {
    const { session } = useSession();
    const sessionToken = session?.sessionToken;
    const storageKey = sessionToken ? `${STORAGE_PREFIX}.${sessionToken}` : null;
    const previousStorageKeyRef = useRef(storageKey);
    const [items, setItems] = useState({});

    useEffect(() => {
        if (previousStorageKeyRef.current && previousStorageKeyRef.current !== storageKey) {
            writeToStorage(previousStorageKeyRef.current, {});
        }
        previousStorageKeyRef.current = storageKey;
    }, [storageKey]);

    useEffect(() => {
        if (!storageKey) {
            setItems({});
            return;
        }
        const initial = readFromStorage(storageKey);
        setItems(initial);
    }, [storageKey]);

    const updateItems = (updater) => {
        setItems((prev) => {
            const next = typeof updater === 'function' ? updater(prev) : updater;
            writeToStorage(storageKey, next);
            return next;
        });
    };

    const addItem = (menuItem) => {
        if (!menuItem) {
            return;
        }

        updateItems((prev) => {
            const existing = prev[menuItem.id];
            const quantity = existing ? existing.quantity + 1 : 1;
            return {
                ...prev,
                [menuItem.id]: {
                    id: menuItem.id,
                    name: menuItem.name,
                    priceCents: menuItem.priceCents,
                    description: menuItem.description || '',
                    imageUrl: menuItem.imageUrl || '',
                    quantity
                }
            };
        });
    };

    const incrementItem = (itemId) => {
        if (!itemId) {
            return;
        }

        updateItems((prev) => {
            const existing = prev[itemId];
            if (!existing) {
                return prev;
            }
            return {
                ...prev,
                [itemId]: {
                    ...existing,
                    quantity: existing.quantity + 1
                }
            };
        });
    };

    const decrementItem = (itemId) => {
        if (!itemId) {
            return;
        }

        updateItems((prev) => {
            const existing = prev[itemId];
            if (!existing) {
                return prev;
            }
            const nextQuantity = existing.quantity - 1;
            if (nextQuantity <= 0) {
                const { [itemId]: _removed, ...rest } = prev;
                return rest;
            }
            return {
                ...prev,
                [itemId]: {
                    ...existing,
                    quantity: nextQuantity
                }
            };
        });
    };

    const clearCart = () => {
        updateItems({});
    };

    const cartItems = useMemo(() => Object.values(items), [items]);
    const cartQuantity = useMemo(() => cartItems.reduce((total, item) => total + item.quantity, 0), [cartItems]);
    const totalCents = useMemo(
        () => cartItems.reduce((total, item) => total + item.priceCents * item.quantity, 0),
        [cartItems]
    );

    const value = {
        items,
        cartItems,
        cartQuantity,
        totalCents,
        addItem,
        incrementItem,
        decrementItem,
        clearCart
    };

    return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export const useCart = () => {
    const context = useContext(CartContext);
    if (!context) {
        throw new Error('useCart must be used within a CartProvider');
    }
    return context;
};
