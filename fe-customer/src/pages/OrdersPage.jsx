import { useEffect, useState } from 'react';
import { Badge, Button, Card, Spinner } from 'react-bootstrap';
import { toast } from 'react-toastify';
import { useSession } from '../context/SessionContext.jsx';
import { fetchCustomerOrders } from '../services/session.js';

const formatPrice = (cents) => `₫${(cents / 100).toFixed(2)}`;

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

const OrdersPage = () => {
    const { session, ordersVersion } = useSession();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(false);

    const sessionToken = session?.sessionToken;

    const loadOrders = async () => {
        if (!sessionToken) {
            return;
        }

        setLoading(true);
        try {
            const response = await fetchCustomerOrders(sessionToken);
            setOrders(response.data?.data || []);
        } catch (error) {
            const message = error.response?.data?.message || error.message || 'Unable to load orders';
            toast.error(message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadOrders();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sessionToken, ordersVersion]);

    if (loading) {
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
        <div className="d-flex flex-column gap-3">
            {orders.map((order) => (
                <Card key={order.id} className="shadow-sm">
                    <Card.Body className="d-flex flex-column gap-3">
                        <div className="d-flex justify-content-between align-items-center">
                            <div>
                                <div className="text-muted small">Order #{order.id.slice(0, 8)}</div>
                                <div className="fw-semibold">Total {formatPrice(order.totalCents)}</div>
                            </div>
                            <div className="d-flex flex-column align-items-end gap-1">
                                <Badge bg={statusVariant[order.status] || 'secondary'}>{friendlyStatus[order.status] || order.status}</Badge>
                                {order.ticket && (
                                    <Badge bg="light" text="dark">Ticket {order.ticket.sequenceNo}</Badge>
                                )}
                            </div>
                        </div>
                        <div className="d-flex flex-column gap-2">
                            {order.items.map((item) => (
                                <div key={item.id} className="d-flex justify-content-between">
                                    <span>{item.quantity} × {item.name || item.menuItemId.slice(0, 6)}</span>
                                    <span>{formatPrice(item.priceCents * item.quantity)}</span>
                                </div>
                            ))}
                        </div>
                        <div className="d-flex justify-content-between align-items-center text-muted small">
                            <span>Placed {new Date(order.placedAt).toLocaleTimeString()}</span>
                            <Button variant="outline-secondary" size="sm" onClick={loadOrders}>
                                Refresh status
                            </Button>
                        </div>
                    </Card.Body>
                </Card>
            ))}
        </div>
    );
};

export default OrdersPage;
