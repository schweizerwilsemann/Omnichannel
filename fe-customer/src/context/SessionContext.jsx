import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    startSession as startSessionApi,
    lookupTableBySlug,
    fetchMenu,
    fetchCustomerPromotions,
    fetchCustomerVouchers,
    claimCustomerVoucher as claimVoucherApi
} from '../services/session.js';
import { openOrdersStream } from '../services/session.js';
import { toast } from 'react-toastify';

const SessionContext = createContext(null);

const STORAGE_KEY = 'omnichannel.customer.session';
const LOYALTY_POINT_VALUE_CENTS = 10;

const loadFromStorage = () => {
    if (typeof window === 'undefined') {
        return null;
    }

    try {
        const raw = window.sessionStorage.getItem(STORAGE_KEY);
        if (!raw) {
            return null;
        }
        return JSON.parse(raw);
    } catch (error) {
        console.warn('Unable to load session from storage', error);
        return null;
    }
};

const saveToStorage = (session) => {
    if (typeof window === 'undefined') {
        return;
    }

    try {
        window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch (error) {
        console.warn('Unable to persist session', error);
    }
};

const clearStorage = () => {
    if (typeof window === 'undefined') {
        return;
    }

    try {
        window.sessionStorage.removeItem(STORAGE_KEY);
    } catch (error) {
        console.warn('Unable to clear session storage', error);
    }
};

export const SessionProvider = ({ children }) => {
    const location = useLocation();
    const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
    const qrSlug = searchParams.get('qr');

    const [session, setSession] = useState(null);
    const [status, setStatus] = useState('idle');
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    const [ordersVersion, setOrdersVersion] = useState(0);
    const [tableInfo, setTableInfo] = useState(null);
    const [tableLoading, setTableLoading] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);
    const [promotions, setPromotions] = useState([]);
    const [voucherInventory, setVoucherInventory] = useState({
        available: [],
        redeemed: [],
        expired: [],
        revoked: []
    });
    const [promotionsLoading, setPromotionsLoading] = useState(false);
    const navigate = useNavigate();

    const refreshTableInfo = useCallback(() => {
        setRefreshKey((prev) => prev + 1);
    }, []);

    const loadPerks = useCallback(
        async (sessionToken) => {
            if (!sessionToken) {
                setPromotions([]);
                setVoucherInventory({ available: [], redeemed: [], expired: [], revoked: [] });
                return;
            }

            setPromotionsLoading(true);
            try {
                const [promotionsResponse, vouchersResponse] = await Promise.all([
                    fetchCustomerPromotions(sessionToken),
                    fetchCustomerVouchers(sessionToken)
                ]);
                const promotionsPayload = promotionsResponse.data?.data || [];
                const voucherPayload = vouchersResponse.data?.data || {
                    available: [],
                    redeemed: [],
                    expired: [],
                    revoked: []
                };
                setPromotions(promotionsPayload);
                setVoucherInventory({
                    available: voucherPayload.available || [],
                    redeemed: voucherPayload.redeemed || [],
                    expired: voucherPayload.expired || [],
                    revoked: voucherPayload.revoked || []
                });
            } catch (err) {
                console.warn('Unable to load promotions for session', err);
                setPromotions([]);
                setVoucherInventory({ available: [], redeemed: [], expired: [], revoked: [] });
            } finally {
                setPromotionsLoading(false);
            }
        },
        []
    );

    const claimPromotionVoucher = useCallback(
        async ({ promotionId, voucherId, channel = 'CUSTOMER_APP' } = {}) => {
            if (!session?.sessionToken) {
                throw new Error('An active session is required to claim vouchers');
            }

            const response = await claimVoucherApi({
                sessionToken: session.sessionToken,
                promotionId,
                voucherId,
                channel
            });

            await loadPerks(session.sessionToken);

            return response.data?.data || null;
        },
        [loadPerks, session?.sessionToken]
    );

    useEffect(() => {
        let cancelled = false;

        const stored = loadFromStorage();

        if (!qrSlug) {
            if (stored) {
                setSession(stored);
                setStatus('ready');
                setError(null);
                setTableInfo((prev) =>
                    prev || (stored.restaurant || stored.table
                        ? {
                              qrSlug: stored.qrSlug || null,
                              restaurant: stored.restaurant || null,
                              table: stored.table || null,
                              activeSession: {
                                  sessionToken: stored.sessionToken,
                                  startedAt: stored.startedAt || stored.createdAt || new Date().toISOString()
                              }
                          }
                        : null)
                );
            } else {
                setStatus('error');
                setError('Missing QR code. Please scan the table QR again.');
                setSession(null);
                setTableInfo(null);
                clearStorage();
            }
            setTableLoading(false);
            return () => {
                cancelled = true;
            };
        }

        setStatus('loading');
        setTableLoading(true);
        setError(null);

        lookupTableBySlug(qrSlug)
            .then((response) => {
                if (cancelled) {
                    return;
                }
                const info = response.data?.data || null;
                setTableInfo(info);

                const stored = loadFromStorage();
                if (stored && stored.qrSlug === qrSlug) {
                    setSession(stored);
                    setStatus('ready');
                } else {
                    setSession(null);
                    setStatus('needsSetup');
                }
                setError(null);
            })
            .catch((err) => {
                if (cancelled) {
                    return;
                }
                const statusCode = err.response?.status;
                const message =
                    statusCode === 404
                        ? `We couldn't find a restaurant table for code "${qrSlug}". Please rescan the QR code at your seat or ask the staff for help.`
                        : err.response?.data?.message || err.message || 'Unable to validate the table QR code.';
                setSession(null);
                setStatus('error');
                setError(message);
                setTableInfo(null);
                clearStorage();
            })
            .finally(() => {
                if (!cancelled) {
                    setTableLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [qrSlug, refreshKey]);

    useEffect(() => {
        if (session?.sessionToken) {
            loadPerks(session.sessionToken);
        } else {
            loadPerks(null);
        }
    }, [session?.sessionToken, loadPerks]);

    // Listen for session-level server-sent events (session.closed) so we can react in real-time
    useEffect(() => {
        if (!session?.sessionToken) {
            return () => {};
        }

        let source;
        try {
            source = openOrdersStream(session.sessionToken);
        } catch (err) {
            console.warn('Unable to open session stream', err);
            return () => {};
        }

        const handleClosed = (event) => {
            try {
                const payload = JSON.parse(event.data);
                // Clear local session and navigate to table setup so a new guest can start a session
                clearSession();
                // If the server provided a qrSlug, navigate to it; otherwise, go to root
                const qr = payload?.qrSlug || null;
                if (qr) {
                    navigate(`/?qr=${encodeURIComponent(qr)}`);
                } else {
                    navigate('/');
                }
            } catch (e) {
                console.warn('Failed to handle session.closed payload', e);
            }
        };

        source.addEventListener('session.closed', handleClosed);
        source.onerror = (evt) => {
            console.warn('Session SSE disconnected', evt);
        };

        return () => {
            if (source) {
                source.removeEventListener('session.closed', handleClosed);
                source.close();
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [session?.sessionToken]);

    // If user is redirected back from email verification, refresh menu/session
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const membershipVerified = params.get('membershipVerified');
        if (membershipVerified) {
            const customerIdParam = params.get('customerId');
            const restaurantIdParam = params.get('restaurantId');
            const membershipStatusParam = params.get('membershipStatus');
            (async () => {
                try {
                    const stored = loadFromStorage();
                    // prefer sessionToken param from redirect, else in-memory, else stored
                    const sessionTokenParam = params.get('sessionToken');
                    const token = sessionTokenParam || session?.sessionToken || stored?.sessionToken;

                    let fetchSucceeded = false;

                    // If we have a token from the redirect, call fetchMenu with it and persist the returned membership
                    if (token) {
                        try {
                            const res = await fetchMenu(token);
                            const payload = res.data?.data;
                            if (payload && payload.session) {
                                const membership = payload.session.membership || null;
                                const membershipStatus = payload.session.membershipStatus || (membership && membership.status) || null;
                                // merge into stored session (if present) so we preserve restaurant/table data
                                const next = stored || {};
                                next.sessionToken = token;
                                next.membership = membership;
                                next.membershipStatus = membershipStatus;
                                try {
                                    saveToStorage(next);
                                } catch (e) {
                                    // ignore storage errors
                                }
                                setSession(next);
                                fetchSucceeded = true;
                                if (membershipStatus === 'MEMBER') {
                                    // ensure we preserve entered customer info if payload doesn't include it
                                    const existingCustomer = next.customer || next.customerMeta || stored?.customer || stored?.customerMeta || null;
                                    if (existingCustomer) {
                                        next.customer = existingCustomer;
                                    }
                                    updateSession({ membershipPending: false });
                                    // Hard-reload to ensure all UI pieces pick up the new membership state
                                    try {
                                        const base = window.location.pathname || '/';
                                        window.location.replace(base);
                                        return;
                                    } catch (e) {
                                        // fallback to navigate
                                        try {
                                            navigate('/');
                                        } catch (_) {}
                                    }
                                }
                            }
                        } catch (e) {
                            // fetchMenu might fail if the session is closed or token invalid — fall back to stored matching logic
                            fetchSucceeded = false;
                        }
                    }

                    // If fetch didn't succeed (no token or fetch failed), try to force membership flag if stored session matches customer & restaurant
                    if (!fetchSucceeded && stored && customerIdParam && restaurantIdParam) {
                        const storedCustomerId = stored.customerId || stored.customer?.id || stored.membership?.customerId || null;
                        const storedRestaurantId = stored.restaurant?.id || stored.restaurantId || null;
                        if (String(storedCustomerId) === String(customerIdParam) && String(storedRestaurantId) === String(restaurantIdParam)) {
                            const forcedStatus = membershipStatusParam || 'MEMBER';
                            // try server-side membership lookup to confirm status
                            try {
                                const statusRes = await (await import('../services/session.js')).getMembershipStatus({ customerId: customerIdParam, restaurantId: restaurantIdParam });
                                const serverData = statusRes.data?.data;
                                if (serverData && serverData.status) {
                                    const serverStatus = serverData.status;
                                    if (serverStatus !== forcedStatus) {
                                        // prefer server-reported status
                                        forcedStatus = serverStatus;
                                    }
                                }
                            } catch (err) {
                                // ignore lookup errors and proceed with forcedStatus
                            }
                            // ensure stored customer info and membership is applied to session so UI shows the entered name/email
                            const customerInfo = stored.customer || stored.customerMeta || null;
                            const existingMembership = stored.membership || null;
                            const membershipObj = existingMembership
                                ? { ...existingMembership, status: forcedStatus }
                                : { status: forcedStatus, loyaltyPoints: 0, discountBalanceCents: 0 };

                            updateSession({
                                membership: membershipObj,
                                membershipStatus: forcedStatus,
                                customer: customerInfo
                            });

                            if (forcedStatus === 'MEMBER') {
                                updateSession({ membershipPending: false });
                            }
                        }
                    }
                } catch (e) {
                    // ignore overall errors
                }
            })();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.search]);

    const initializeSession = useCallback(async (customerPayload) => {
        if (!qrSlug) {
            throw new Error('QR code is required to start a session');
        }

        setLoading(true);
        setError(null);
        try {
            const response = await startSessionApi({
                qrSlug,
                customer: customerPayload && Object.keys(customerPayload).length > 0 ? customerPayload : undefined
            });
            const data = response.data?.data;
            if (!data) {
                throw new Error('Unexpected session response');
            }

            const nextSession = { ...data, qrSlug };
            setSession(nextSession);
            saveToStorage(nextSession);
            setStatus('ready');
            setError(null);
            if (data.table || data.restaurant) {
                setTableInfo((prev) => ({
                    qrSlug,
                    restaurant: data.restaurant || prev?.restaurant || null,
                    table: data.table || prev?.table || null,
                    activeSession: {
                        sessionToken: nextSession.sessionToken,
                        startedAt: new Date().toISOString()
                    }
                }));
            }
            return nextSession;
        } catch (err) {
            const message = err.response?.data?.message || err.message || 'Unable to start session';
            setError(message);
            if (err.response?.status === 404) {
                setStatus('error');
                setTableInfo(null);
            } else {
                setStatus('needsSetup');
            }
            throw err;
        } finally {
            setLoading(false);
        }
    }, [qrSlug]);

    const clearSession = useCallback(() => {
        clearStorage();
        setSession(null);
        setOrdersVersion(0);
        setError(null);
        setStatus(tableInfo ? 'needsSetup' : 'idle');
        setPromotions([]);
        setVoucherInventory({ available: [], redeemed: [], expired: [], revoked: [] });
        setPromotionsLoading(false);
    }, [tableInfo]);

    const markOrdersDirty = useCallback(() => {
        setOrdersVersion((prev) => prev + 1);
    }, []);

    const updateSession = useCallback((patch) => {
        let snapshot = null;
        setSession((prev) => {
            const base = prev || {};
            const merged = { ...base, ...patch };

            if (base.membership && patch && patch.membership) {
                merged.membership = { ...base.membership, ...patch.membership };
            }

            try {
                saveToStorage(merged);
            } catch (e) {
                console.warn('Unable to persist updated session', e);
            }

            snapshot = merged;
            return merged;
        });

        if (snapshot?.sessionToken) {
            setStatus('ready');
            setError(null);
            setTableInfo((prev) => {
                const next = { ...(prev || {}) };

                if (patch?.qrSlug || snapshot.qrSlug) {
                    next.qrSlug = patch?.qrSlug || snapshot.qrSlug || prev?.qrSlug || null;
                }
                if (patch?.restaurant || snapshot.restaurant) {
                    next.restaurant = patch?.restaurant || snapshot.restaurant || prev?.restaurant || null;
                }
                if (patch?.table || snapshot.table) {
                    next.table = patch?.table || snapshot.table || prev?.table || null;
                }

                next.activeSession = {
                    sessionToken: snapshot.sessionToken,
                    startedAt: snapshot.startedAt || prev?.activeSession?.startedAt || new Date().toISOString()
                };

                return next;
            });
        }
    }, []);

    const clearMembershipPending = useCallback(() => {
        updateSession({ membershipPending: false });
    }, [updateSession]);

    const value = {
        session,
        status,
        error,
        loading,
        qrSlug,
        tableInfo,
        tableLoading,
        initializeSession,
        updateSession,
        clearSession,
        clearMembershipPending,
        ordersVersion,
        markOrdersDirty,
        refreshTableInfo,
        promotions,
        promotionsLoading,
        vouchers: voucherInventory,
        claimPromotionVoucher,
        refreshPromotions: () => (session?.sessionToken ? loadPerks(session.sessionToken) : undefined),
        loyaltyPointValueCents: LOYALTY_POINT_VALUE_CENTS
    };

    return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
};

export const useSession = () => {
    const context = useContext(SessionContext);
    if (!context) {
        throw new Error('useSession must be used within a SessionProvider');
    }
    return context;
};


