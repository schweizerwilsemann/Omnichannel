import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { Alert, Badge, Button, Card, Modal, Pagination, Spinner } from 'react-bootstrap';
import { toast } from 'react-toastify';
import MainLayout from '../components/layout/MainLayout.jsx';
import { fetchOrders, updateOrderStatus, updateOrderPaymentStatus } from '../services/order.service.js';
import { closeGuestSession } from '../services/session.service.js';
import { createOrderStream } from '../services/orderEvents.service.js';

const statusVariantMap = {
    PLACED: 'secondary',
    ACCEPTED: 'primary',
    IN_PREP: 'warning',
    READY: 'success',
    COMPLETED: 'dark',
    CANCELLED: 'danger'
};

const paymentStatusVariantMap = {
    SUCCEEDED: 'success',
    PENDING: 'warning',
    FAILED: 'danger'
};

const actionableStatuses = {
    PLACED: [
        { status: 'ACCEPTED', label: 'Accept order', variant: 'primary' },
        { status: 'CANCELLED', label: 'Cancel', variant: 'outline-danger' }
    ],
    ACCEPTED: [
        { status: 'IN_PREP', label: 'Start prep', variant: 'primary' },
        { status: 'CANCELLED', label: 'Cancel', variant: 'outline-danger' }
    ],
    IN_PREP: [
        { status: 'READY', label: 'Mark ready', variant: 'success' }
    ],
    READY: [
        { status: 'COMPLETED', label: 'Complete', variant: 'dark' }
    ],
    COMPLETED: [],
    CANCELLED: []
};

const sortOrders = (list) =>
    [...list].sort((a, b) => {
        const left = a.placedAt ? new Date(a.placedAt).getTime() : 0;
        const right = b.placedAt ? new Date(b.placedAt).getTime() : 0;
        return right - left;
    });

const formatCurrency = (cents) => `USD ${(cents / 100).toFixed(2)}`;

const formatAge = (iso) => {
    if (!iso) {
        return '-';
    }
    const placed = new Date(iso).getTime();
    const diff = Date.now() - placed;
    if (diff < 0) {
        return 'just now';
    }
    const minutes = Math.floor(diff / 60000);
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

const PAGE_SIZE = 10;

const OrdersPage = () => {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(false);
    const [updating, setUpdating] = useState({});
    const [paymentUpdating, setPaymentUpdating] = useState({});
    const [readyModalOrder, setReadyModalOrder] = useState(null);
    const [page, setPage] = useState(1);
    const accessToken = useSelector((state) => state.auth.accessToken);
    const restaurantIds = useSelector((state) => state.auth.user?.restaurantIds || []);

    const loadOrders = useCallback(async () => {
        try {
            setLoading(true);
            const { data } = await fetchOrders();
            setOrders(sortOrders(data?.data || []));
            setPage(1);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Unable to load orders');
        } finally {
            setLoading(false);
        }
    }, []);

    const mergeIncomingOrder = useCallback((incoming, { toastOnCreate = false } = {}) => {
        if (!incoming) {
            return;
        }

        let inserted = false;
        setOrders((prev) => {
            const index = prev.findIndex((order) => order.id === incoming.id);
            if (index !== -1) {
                const next = [...prev];
                next[index] = { ...next[index], ...incoming };
                return sortOrders(next);
            }
            inserted = true;
            const next = sortOrders([incoming, ...prev]);
            return next.slice(0, 200);
        });

        if (toastOnCreate && inserted) {
            const displayCode = incoming.shortCode || incoming.id.slice(0, 6).toUpperCase();
            toast.info(`New order ${displayCode} just landed`, {
                toastId: `order-created-${incoming.id}`
            });
        }
    }, []);

    useEffect(() => {
        if (!accessToken) {
            return;
        }
        loadOrders();
    }, [accessToken, loadOrders]);

    useEffect(() => {
        if (!accessToken || restaurantIds.length === 0) {
            return () => {};
        }

        let source;
        try {
            source = createOrderStream(accessToken);
        } catch (error) {
            console.warn('Unable to start order stream', error);
            return () => {};
        }

        const handleCreated = (event) => {
            try {
                const payload = JSON.parse(event.data);
                mergeIncomingOrder(payload, { toastOnCreate: true });
            } catch (parseError) {
                console.warn('Failed to parse order.created payload', parseError);
            }
        };

        const handleUpdated = (event) => {
            try {
                const payload = JSON.parse(event.data);
                mergeIncomingOrder(payload);
            } catch (parseError) {
                console.warn('Failed to parse order.updated payload', parseError);
            }
        };

        source.addEventListener('order.created', handleCreated);
        source.addEventListener('order.updated', handleUpdated);
        source.onerror = (event) => {
            console.warn('Order stream disconnected', event);
        };

        return () => {
            source.removeEventListener('order.created', handleCreated);
            source.removeEventListener('order.updated', handleUpdated);
            source.close();
        };
    }, [accessToken, restaurantIds.join(','), mergeIncomingOrder]);

    const handleStatusChange = useCallback(
        async (orderId, nextStatus) => {
            setUpdating((prev) => ({ ...prev, [orderId]: nextStatus }));
            try {
                const { data } = await updateOrderStatus(orderId, { status: nextStatus });
                const updated = data?.data || { id: orderId, status: nextStatus };
                mergeIncomingOrder(updated);
                toast.success(`Order updated to ${nextStatus}`);
                if (nextStatus === 'READY') {
                    setReadyModalOrder(updated);
                }
            } catch (error) {
                toast.error(error.response?.data?.message || 'Unable to update order');
            } finally {
                setUpdating((prev) => {
                    const next = { ...prev };
                    delete next[orderId];
                    return next;
                });
            }
        },
        [mergeIncomingOrder]
    );

    const handlePaymentStatusChange = useCallback(
        async (orderId, nextStatus) => {
            setPaymentUpdating((prev) => ({ ...prev, [orderId]: nextStatus }));
            try {
                const { data } = await updateOrderPaymentStatus(orderId, { status: nextStatus });
                const updated = data?.data || { id: orderId };
                mergeIncomingOrder(updated);
                toast.success(nextStatus === 'SUCCEEDED' ? 'Payment marked as received' : 'Payment marked as pending');
            } catch (error) {
                toast.error(error.response?.data?.message || 'Unable to update payment status');
            } finally {
                setPaymentUpdating((prev) => {
                    const next = { ...prev };
                    delete next[orderId];
                    return next;
                });
            }
        },
        [mergeIncomingOrder]
    );

    useEffect(() => {
        const totalPages = Math.max(1, Math.ceil(Math.max(orders.length, 1) / PAGE_SIZE));
        if (page > totalPages) {
            setPage(totalPages);
        }
    }, [orders.length, page]);

    const rows = useMemo(() => orders, [orders]);
    const totalPages = Math.max(1, Math.ceil(Math.max(rows.length, 1) / PAGE_SIZE));
    const currentPage = Math.min(page, totalPages);
    const paginatedRows = rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
    const hasRows = paginatedRows.length > 0;
    const startEntry = hasRows ? (currentPage - 1) * PAGE_SIZE + 1 : 0;
    const endEntry = hasRows ? startEntry + paginatedRows.length - 1 : 0;

    const handlePageChange = (nextPage) => {
        if (nextPage < 1 || nextPage > totalPages || nextPage === currentPage) {
            return;
        }
        setPage(nextPage);
    };

    const renderPagination = () => {
        if (rows.length <= PAGE_SIZE) {
            return null;
        }
        const maxPagesToShow = 5;
        let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
        let endPage = startPage + maxPagesToShow - 1;
        if (endPage > totalPages) {
            endPage = totalPages;
            startPage = Math.max(1, endPage - maxPagesToShow + 1);
        }
        const items = [];
        for (let idx = startPage; idx <= endPage; idx += 1) {
            items.push(
                <Pagination.Item key={idx} active={idx === currentPage} onClick={() => handlePageChange(idx)}>
                    {idx}
                </Pagination.Item>
            );
        }
        return (
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mt-3 gap-2">
                <div className="text-muted small">
                    Showing {startEntry}-{endEntry} of {rows.length} orders
                </div>
                <Pagination className="mb-0">
                    <Pagination.First disabled={currentPage === 1} onClick={() => handlePageChange(1)} />
                    <Pagination.Prev disabled={currentPage === 1} onClick={() => handlePageChange(currentPage - 1)} />
                    {items}
                    <Pagination.Next
                        disabled={currentPage === totalPages}
                        onClick={() => handlePageChange(currentPage + 1)}
                    />
                    <Pagination.Last
                        disabled={currentPage === totalPages}
                        onClick={() => handlePageChange(totalPages)}
                    />
                </Pagination>
            </div>
        );
    };

    return (
        <MainLayout>
            <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h2>Kitchen Orders</h2>
                    <p className="text-muted mb-0">Everything coming from the QR tables, ready for the line.</p>
                </div>
                <Button variant="outline-secondary" onClick={loadOrders} disabled={loading}>
                    {loading ? 'Refreshing...' : 'Refresh'}
                </Button>
            </div>
            {loading && rows.length === 0 ? (
                <div className="d-flex justify-content-center py-5">
                    <Spinner animation="border" />
                </div>
            ) : rows.length === 0 ? (
                <Alert variant="light" className="border text-center">No orders on deck right now.</Alert>
            ) : (
                <div className="d-flex flex-column gap-3">
                    {paginatedRows.map((order) => {
                        const actions = actionableStatuses[order.status] || [];
                        const isUpdating = Boolean(updating[order.id]);
                        const payment = order.payment || {};
                        const paymentStatus = payment.status || 'PENDING';
                        const paymentMethod = payment.method || 'CARD';
                        const isCashOrder = paymentMethod === 'CASH';
                        const isPaymentUpdating = Boolean(paymentUpdating[order.id]);
                        return (
                            <Card key={order.id} className={`shadow-sm ${order.status === 'READY' ? 'border-success' : ''}`}>
                                <Card.Body className="d-flex flex-column gap-3">
                                    <div className="d-flex justify-content-between align-items-start gap-3">
                                        <div className="d-flex flex-column gap-1">
                                            <div className="text-muted small">
                                                {order.restaurant?.name || 'Unknown restaurant'} - Table {order.table?.name || '-'}
                                            </div>
                                            <h4 className="mb-0">{order.shortCode || order.id.slice(0, 8)}</h4>
                                            <div className="text-muted small">
                                                Placed {order.placedAt ? new Date(order.placedAt).toLocaleString() : '-'} ({formatAge(order.placedAt)})
                                            </div>
                                        </div>
                                        <Badge bg={statusVariantMap[order.status] || 'secondary'}>{order.status}</Badge>
                                    </div>
                                    <div className="d-flex flex-column gap-2">
                                        {order.items?.map((item) => (
                                            <div key={item.id || `${item.menuItemId}-${item.quantity}`} className="d-flex flex-column">
                                                <div className="d-flex justify-content-between">
                                                    <span>{item.quantity} x {item.name || 'Item'}</span>
                                                    <span className="fw-semibold">{formatCurrency(item.priceCents * item.quantity)}</span>
                                                </div>
                                                {item.notes && <span className="text-muted small">Note: {item.notes}</span>}
                                            </div>
                                        ))}
                                    </div>
                                    {order.specialRequest && (
                                        <Alert variant="warning" className="mb-0">
                                            <strong>Special request:</strong> {order.specialRequest}
                                        </Alert>
                                    )}
                                    <div className="d-flex flex-column gap-1">
                                        <span className="text-muted small">Payment</span>
                                        <div className="d-flex flex-wrap align-items-center gap-2">
                                            <Badge bg="secondary">{paymentMethod}</Badge>
                                            <Badge bg={paymentStatusVariantMap[paymentStatus] || 'secondary'}>{paymentStatus}</Badge>
                                            {payment.card ? (
                                                <span className="text-muted small">
                                                    {payment.card.brand ? payment.card.brand.toUpperCase() : 'CARD'} ••••{payment.card.last4 || '####'}
                                                </span>
                                            ) : null}
                                            {payment.instructions ? (
                                                <span className="text-muted small">{payment.instructions}</span>
                                            ) : null}
                                            {payment.confirmedAt && paymentStatus === 'SUCCEEDED' ? (
                                                <span className="text-muted small">Paid {new Date(payment.confirmedAt).toLocaleString()}</span>
                                            ) : null}
                                        </div>
                                    </div>
                                    <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                                        <div className="fw-semibold">Total {formatCurrency(order.totalCents)}</div>
                                        <div className="d-flex flex-wrap gap-2">
                                            {/* Admin control: End guest session for the table */}
                                            {order.session?.id && (
                                                <Button
                                                    size="sm"
                                                    variant="outline-danger"
                                                    onClick={async () => {
                                                        if (!confirm('End guest session for this table? This will free the table for the next customer.')) {
                                                            return;
                                                        }
                                                        try {
                                                            await closeGuestSession(order.session.id);
                                                            toast.success('Session closed — table is now free.');
                                                            // refresh orders and UI
                                                            await loadOrders();
                                                        } catch (err) {
                                                            toast.error(err.response?.data?.message || 'Unable to close session');
                                                        }
                                                    }}
                                                >
                                                    End session
                                                </Button>
                                            )}
                                            {isCashOrder ? (
                                                <Button
                                                    size="sm"
                                                    variant={paymentStatus === 'SUCCEEDED' ? 'outline-warning' : 'success'}
                                                    disabled={isPaymentUpdating}
                                                    onClick={() => handlePaymentStatusChange(order.id, paymentStatus === 'SUCCEEDED' ? 'PENDING' : 'SUCCEEDED')}
                                                >
                                                    {isPaymentUpdating ? (
                                                        <>
                                                            <Spinner animation="border" size="sm" className="me-2" />
                                                            Updating...
                                                        </>
                                                    ) : paymentStatus === 'SUCCEEDED' ? (
                                                        'Mark unpaid'
                                                    ) : (
                                                        'Mark paid'
                                                    )}
                                                </Button>
                                            ) : null}
                                            {actions.length === 0 ? (
                                                <Button variant="outline-secondary" size="sm" disabled>
                                                    No actions
                                                </Button>
                                            ) : (
                                                actions.map((action) => (
                                                    <Button
                                                        key={action.status}
                                                        size="sm"
                                                        variant={action.variant}
                                                        disabled={isUpdating}
                                                        onClick={() => handleStatusChange(order.id, action.status)}
                                                    >
                                                        {isUpdating && updating[order.id] === action.status ? (
                                                            <>
                                                                <Spinner animation="border" size="sm" className="me-2" />
                                                                Updating...
                                                            </>
                                                        ) : (
                                                            action.label
                                                        )}
                                                    </Button>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                </Card.Body>
                            </Card>
                        );
                    })}
                    {renderPagination()}
                </div>
            )}
            <Modal show={Boolean(readyModalOrder)} onHide={() => setReadyModalOrder(null)} centered>
                <Modal.Header closeButton>
                    <Modal.Title>Customer notified</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <p className="mb-2">
                        {readyModalOrder?.shortCode || readyModalOrder?.id?.slice(0, 8) || 'The order'} is now marked READY.
                    </p>
                    <p className="mb-0 text-muted">The guest has been alerted on their device to collect the order.</p>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="success" onClick={() => setReadyModalOrder(null)}>
                        Great
                    </Button>
                </Modal.Footer>
            </Modal>
        </MainLayout>
    );
};

export default OrdersPage;
