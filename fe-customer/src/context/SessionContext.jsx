import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { startSession as startSessionApi, lookupTableBySlug } from '../services/session.js';

const SessionContext = createContext(null);

const STORAGE_KEY = 'omnichannel.customer.session';

const loadFromStorage = () => {
    if (typeof window === 'undefined') {
        return null;
    }

    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
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
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch (error) {
        console.warn('Unable to persist session', error);
    }
};

const clearStorage = () => {
    if (typeof window === 'undefined') {
        return;
    }

    try {
        window.localStorage.removeItem(STORAGE_KEY);
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

    const refreshTableInfo = useCallback(() => {
        setRefreshKey((prev) => prev + 1);
    }, []);

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
    }, [tableInfo]);

    const markOrdersDirty = useCallback(() => {
        setOrdersVersion((prev) => prev + 1);
    }, []);

    const value = {
        session,
        status,
        error,
        loading,
        qrSlug,
        tableInfo,
        tableLoading,
        initializeSession,
        clearSession,
        ordersVersion,
        markOrdersDirty,
        refreshTableInfo
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
