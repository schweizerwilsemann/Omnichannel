import { useCallback, useEffect, useRef, useState } from 'react';
import { Badge, Button, Card, Modal, Spinner } from 'react-bootstrap';
import { toast } from 'react-toastify';
import { useSession } from '../context/SessionContext.jsx';
import { fetchCustomerOrders, openOrdersStream } from '../services/session.js';

const formatPrice = (cents) => `USD ${(cents / 100).toFixed(2)}`;

const statusVariant = {
    PLACED: 'secondary',
    ACCEPTED: 'primary',
    IN_PREP: 'info',
    READY: 'success',
    COMPLETED: 'success',
    CANCELLED: 'danger'
};

const friendlyStatus = {
    PLACED: 'Placed',
    ACCEPTED: 'Accepted',
    IN_PREP: 'In preparation',
    READY: 'Ready for pickup',
    COMPLETED: 'Completed',
    CANCELLED: 'Cancelled'
};

const sortOrders = (list) =>
    [...list].sort((a, b) => {
        const left = a.placedAt ? new Date(a.placedAt).getTime() : 0;
        const right = b.placedAt ? new Date(b.placedAt).getTime() : 0;
        return right - left;
    });

const buildDisplayCode = (order) => {
    if (order.ticket?.sequenceNo) {
        return `Ticket ${order.ticket.sequenceNo}`;
    }
    return `Order ${order.id.slice(0, 8)}`;
};

const OrdersPage = () => {
    const { session, ordersVersion } = useSession();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(false);
    const [highlightOrder, setHighlightOrder] = useState(null);
    const statusRef = useRef(new Map());
    const audioRef = useRef(null);

    const sessionToken = session?.sessionToken;

    useEffect(() => {
        if (typeof window === 'undefined' || !('Notification' in window)) {
            return;
        }
        if (Notification.permission === 'default') {
            Notification.requestPermission().catch(() => {});
        }
    }, []);

    useEffect(() => {
        return () => {
            const ctx = audioRef.current;
            if (ctx && ctx.state && ctx.state !== 'closed') {
                ctx.close().catch(() => {});
            }
        };
    }, []);

    const playNotificationTone = useCallback((type) => {
        if (typeof window === 'undefined') {
            return;
        }
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) {
            return;
        }
        let ctx = audioRef.current;
        if (!ctx || ctx.state === 'closed') {
            ctx = new AudioContext();
            audioRef.current = ctx;
        }
        if (ctx.state === 'suspended') {
            ctx.resume().catch(() => {});
        }
        try {
            const oscillator = ctx.createOscillator();
            const gain = ctx.createGain();
            const now = ctx.currentTime;
            oscillator.type = 'triangle';
            const frequency = type === 'COMPLETED' ? 660 : 880;
            oscillator.frequency.setValueAtTime(frequency, now);
            gain.gain.setValueAtTime(0.0001, now);
            gain.gain.exponentialRampToValueAtTime(0.25, now + 0.015);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
            oscillator.connect(gain);
            gain.connect(ctx.destination);
            oscillator.start(now);
            oscillator.stop(now + 0.6);
        } catch (audioError) {
            console.warn('Unable to play notification tone', audioError);
        }
    }, []);

    const showAttentionPrompt = useCallback((order, status) => {
        const displayCode = buildDisplayCode(order);
        const verb = status === 'COMPLETED' ? 'has been completed' : 'is ready for pickup';
        toast.success(`${displayCode} ${verb}.`, {
            toastId: `order-${status.toLowerCase()}-${order.id}`
        });
        if (typeof window !== 'undefined') {
            if (navigator.vibrate) {
                navigator.vibrate(status === 'COMPLETED' ? [300, 160, 300] : [200, 80, 200]);
            }
            if ('Notification' in window && Notification.permission === 'granted') {
                try {
                    new Notification('Order update', {
                        body: `${displayCode} ${verb}.`
                    });
                } catch (notificationError) {
                    console.warn('Unable to show notification', notificationError);
                }
            }
        }
        playNotificationTone(status);
        setHighlightOrder({
            ...order,
            attentionStatus: status,
            displayCode,
            placedAt: order.placedAt || null
        });
    }, [playNotificationTone]);

    const mergeOrder = useCallback(
        (incoming) => {
            if (!incoming) {
                return;
            }

            let mergedSnapshot = incoming;
            setOrders((prev) => {
                const index = prev.findIndex((order) => order.id === incoming.id);
                if (index !== -1) {
                    const existing = prev[index];
                    mergedSnapshot = {
                        ...existing,
                        ...incoming
                    };
                    if (!incoming.items && existing.items) {
                        mergedSnapshot.items = existing.items;
                    }
                    if (!incoming.ticket && existing.ticket) {
                        mergedSnapshot.ticket = existing.ticket;
                    }
                    const next = [...prev];
                    next[index] = mergedSnapshot;
                    return sortOrders(next);
                }
                return sortOrders([mergedSnapshot, ...prev]);
            });

            const previousStatus = statusRef.current.get(incoming.id);
            statusRef.current.set(incoming.id, mergedSnapshot.status);
            const attentionStatuses = ['READY', 'COMPLETED'];
            if (attentionStatuses.includes(mergedSnapshot.status) && mergedSnapshot.status !== previousStatus) {
                showAttentionPrompt(mergedSnapshot, mergedSnapshot.status);
            }
        },
        [showAttentionPrompt]
    );

    const loadOrders = useCallback(async () => {
        if (!sessionToken) {
            setOrders([]);
            statusRef.current.clear();
            return;
        }

        setLoading(true);
        try {
            const response = await fetchCustomerOrders(sessionToken);
            const nextOrders = sortOrders(response.data?.data || []);
            statusRef.current = new Map(nextOrders.map((order) => [order.id, order.status]));
            setOrders(nextOrders);
        } catch (error) {
            const message = error.response?.data?.message || error.message || 'Unable to load orders';
            toast.error(message);
        } finally {
            setLoading(false);
        }
    }, [sessionToken]);

    useEffect(() => {
        loadOrders();
    }, [loadOrders, ordersVersion]);

    useEffect(() => {
        if (!sessionToken) {
            return () => {};
        }

        let source;
        try {
            source = openOrdersStream(sessionToken);
        } catch (err) {
            console.warn('Unable to open customer order stream', err);
            return () => {};
        }

        const handlePayload = (event) => {
            try {
                const payload = JSON.parse(event.data);
                mergeOrder(payload);
            } catch (parseError) {
                console.warn('Failed to parse order stream payload', parseError);
            }
        };

        source.addEventListener('order.created', handlePayload);
        source.addEventListener('order.updated', handlePayload);
        source.onerror = (evt) => {
            console.warn('Customer order stream disconnected', evt);
        };

        return () => {
            source.removeEventListener('order.created', handlePayload);
            source.removeEventListener('order.updated', handlePayload);
            source.close();
        };
    }, [sessionToken, mergeOrder]);

    const dismissHighlight = () => setHighlightOrder(null);

    if (loading && orders.length === 0) {
        return (
            <div className="d-flex justify-content-center py-5">
                <Spinner animation="border" />
            </div>
        );
    }

    if (!orders.length) {
        return <p className="text-muted">You have not placed any orders during this visit yet.</p>;
    }

    return (
        <>
            <div className="d-flex flex-column gap-3">
                {orders.map((order) => (
                    <Card key={order.id} className={`shadow-sm ${order.status === 'READY' ? 'border-success' : ''}`}>
                        <Card.Body className="d-flex flex-column gap-3">
                            <div className="d-flex justify-content-between align-items-center">
                                <div>
                                    <div className="text-muted small">{buildDisplayCode(order)}</div>
                                    <div className="fw-semibold">Total {formatPrice(order.totalCents)}</div>
                                </div>
                                <div className="d-flex flex-column align-items-end gap-1">
                                    <Badge bg={statusVariant[order.status] || 'secondary'}>
                                        {friendlyStatus[order.status] || order.status}
                                    </Badge>
                                    {order.ticket && (
                                        <Badge bg="light" text="dark">Ticket {order.ticket.sequenceNo}</Badge>
                                    )}
                                </div>
                            </div>
                            <div className="d-flex flex-column gap-2">
                                {order.items.map((item) => (
                                    <div key={item.id || `${item.menuItemId}-${item.quantity}`} className="d-flex justify-content-between">
                                        <span>{item.quantity} x {item.name || item.menuItemId.slice(0, 6)}</span>
                                        <span>{formatPrice(item.priceCents * item.quantity)}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="d-flex justify-content-between align-items-center text-muted small">
                                <span>Placed {order.placedAt ? new Date(order.placedAt).toLocaleTimeString() : '-'}</span>
                                <Button variant="outline-secondary" size="sm" onClick={loadOrders} disabled={loading}>
                                    Refresh status
                                </Button>
                            </div>
                        </Card.Body>
                    </Card>
                ))}
            </div>
            <Modal show={Boolean(highlightOrder)} onHide={dismissHighlight} centered>
                <Modal.Header closeButton>
                    <Modal.Title>
                        {highlightOrder?.attentionStatus === 'COMPLETED'
                            ? 'Order ready to pick up'
                            : 'Your order is ready!'}
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body className="d-flex flex-column gap-2">
                    <p className="mb-0">
                        {highlightOrder?.displayCode} {highlightOrder?.attentionStatus === 'COMPLETED'
                            ? 'is marked complete.'
                            : 'is now ready for pickup at the counter.'}
                    </p>
                    {highlightOrder?.items && (
                        <div className="small text-muted">
                            <div className="fw-semibold">Items</div>
                            <ul className="mb-0 ps-3">
                                {highlightOrder.items.map((item) => (
                                    <li key={item.id || `${item.menuItemId}-${item.quantity}`}>
                                        {item.quantity} x {item.name || 'Item'}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="success" onClick={dismissHighlight}>
                        Got it
                    </Button>
                </Modal.Footer>
            </Modal>
        </>
    );
};

export default OrdersPage;
