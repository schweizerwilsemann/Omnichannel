import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { Alert, Badge, Button, Card, Spinner } from 'react-bootstrap';
import { toast } from 'react-toastify';
import MainLayout from '../components/layout/MainLayout.jsx';
import { closeGuestSession, listActiveTables } from '../services/session.service.js';

const MEMBERSHIP_VARIANTS = {
    MEMBER: 'success',
    GUEST: 'secondary'
};

const formatRelativeTime = (iso) => {
    if (!iso) {
        return '-';
    }
    const value = new Date(iso).getTime();
    if (Number.isNaN(value)) {
        return '-';
    }
    const diffMs = Date.now() - value;
    if (diffMs < 0) {
        return 'just now';
    }
    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 1) {
        return 'just now';
    }
    if (minutes < 60) {
        return `${minutes}m ago`;
    }
    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
        return `${hours}h ${minutes % 60}m ago`;
    }
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
};

const formatDateTime = (iso) => {
    if (!iso) {
        return '-';
    }
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
        return '-';
    }
    return date.toLocaleString();
};

const resolveGuestDisplay = (guest = {}) => {
    const name = [guest.firstName, guest.lastName].filter(Boolean).join(' ').trim();
    if (name) {
        return name;
    }
    if (guest.email) {
        return guest.email;
    }
    if (guest.phoneNumber) {
        return guest.phoneNumber;
    }
    return 'Guest';
};

const TablesPage = () => {
    const accessToken = useSelector((state) => state.auth.accessToken);
    const [tables, setTables] = useState([]);
    const [loading, setLoading] = useState(false);
    const [refreshCounter, setRefreshCounter] = useState(0);
    const [closing, setClosing] = useState({});

    const loadTables = useCallback(async () => {
        try {
            setLoading(true);
            const response = await listActiveTables();
            setTables(response.data?.data || []);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Unable to load active tables');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!accessToken) {
            return;
        }
        loadTables();
    }, [accessToken, loadTables, refreshCounter]);

    const handleRefresh = () => {
        setRefreshCounter((prev) => prev + 1);
    };

    const handleCloseSession = async (sessionId) => {
        setClosing((prev) => ({ ...prev, [sessionId]: true }));
        try {
            const response = await closeGuestSession(sessionId);
            const message = response.data?.data?.message || 'Session closed';
            toast.success(message);
            setTables((prev) => prev.filter((entry) => entry.sessionId !== sessionId));
        } catch (error) {
            toast.error(error.response?.data?.message || 'Unable to close session');
        } finally {
            setClosing((prev) => {
                const next = { ...prev };
                delete next[sessionId];
                return next;
            });
        }
    };

    const tableCards = useMemo(() => tables, [tables]);

    return (
        <MainLayout>
            <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
                <div>
                    <h2 className="mb-1">Active Tables</h2>
                    <p className="text-muted mb-0">Monitor every guest session that is still open and intervene when needed.</p>
                </div>
                <Button variant="outline-secondary" onClick={handleRefresh} disabled={loading}>
                    {loading ? 'Refreshing…' : 'Refresh'}
                </Button>
            </div>

            {loading && tableCards.length === 0 ? (
                <div className="d-flex justify-content-center py-5">
                    <Spinner animation="border" role="status" />
                </div>
            ) : null}

            {!loading && tableCards.length === 0 ? (
                <Alert variant="light">No active tables right now. Sessions will appear here as soon as guests check in.</Alert>
            ) : null}

            <div className="d-flex flex-column gap-3">
                {tableCards.map((entry) => {
                    const membershipStatus = entry.membershipStatus || 'GUEST';
                    const membershipVariant = MEMBERSHIP_VARIANTS[membershipStatus] || 'secondary';
                    const lastOrderLabel = entry.orderSummary?.lastOrderAt
                        ? `${formatRelativeTime(entry.orderSummary.lastOrderAt)} (${formatDateTime(entry.orderSummary.lastOrderAt)})`
                        : 'No orders yet';

                    return (
                        <Card key={entry.sessionId} className="shadow-sm">
                            <Card.Body className="d-flex flex-column flex-lg-row gap-4 justify-content-between">
                                <div className="d-flex flex-column gap-2">
                                    <div className="d-flex align-items-center gap-3 flex-wrap">
                                        <h5 className="mb-0">
                                            {entry.table?.name || 'Unknown table'}
                                            {entry.restaurant?.name ? <span className="text-muted"> · {entry.restaurant.name}</span> : null}
                                        </h5>
                                        <Badge bg={membershipVariant}>{membershipStatus.toLowerCase()}</Badge>
                                        {entry.table?.status ? <Badge bg="light" text="dark">{entry.table.status.toLowerCase()}</Badge> : null}
                                    </div>
                                    <div className="text-muted small">
                                        Session started {formatRelativeTime(entry.startedAt)} ({formatDateTime(entry.startedAt)})
                                    </div>
                                    <div>
                                        <span className="fw-semibold">Guest:</span> {resolveGuestDisplay(entry.guest)}
                                    </div>
                                    <div className="text-muted small">
                                        Total orders: {entry.orderSummary?.totalOrders ?? 0} · Open orders: {entry.orderSummary?.openOrders ?? 0}
                                    </div>
                                    <div className="text-muted small">Last order: {lastOrderLabel}</div>
                                </div>
                                <div className="d-flex flex-column align-items-start align-items-lg-end gap-2">
                                    <Button
                                        variant="outline-danger"
                                        onClick={() => handleCloseSession(entry.sessionId)}
                                        disabled={Boolean(closing[entry.sessionId])}
                                    >
                                        {closing[entry.sessionId] ? (
                                            <>
                                                <Spinner animation="border" size="sm" className="me-2" /> Ending…
                                            </>
                                        ) : (
                                            'End session'
                                        )}
                                    </Button>
                                </div>
                            </Card.Body>
                        </Card>
                    );
                })}
            </div>
        </MainLayout>
    );
};

export default TablesPage;
