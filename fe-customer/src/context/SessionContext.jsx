import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { startSession as startSessionApi } from '../services/session.js';

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

    useEffect(() => {
        if (!qrSlug) {
            setStatus('error');
            setError('Missing QR code. Please scan the table QR again.');
            setSession(null);
            return;
        }

        const stored = loadFromStorage();
        if (stored && stored.qrSlug === qrSlug) {
            setSession(stored);
            setStatus('ready');
            setError(null);
        } else {
            setSession(null);
            setStatus('needsSetup');
        }
    }, [qrSlug]);

    const initializeSession = async (customerPayload) => {
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
            return nextSession;
        } catch (err) {
            const message = err.response?.data?.message || err.message || 'Unable to start session';
            setError(message);
            setStatus('needsSetup');
            throw err;
        } finally {
            setLoading(false);
        }
    };

    const clearSession = () => {
        clearStorage();
        setSession(null);
        setStatus('needsSetup');
        setOrdersVersion(0);
    };

    const markOrdersDirty = () => {
        setOrdersVersion((prev) => prev + 1);
    };

    const value = {
        session,
        status,
        error,
        loading,
        qrSlug,
        initializeSession,
        clearSession,
        ordersVersion,
        markOrdersDirty
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
