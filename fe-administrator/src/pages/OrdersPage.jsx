import { useEffect, useState } from 'react';
import { Table, Badge, Spinner } from 'react-bootstrap';
import { toast } from 'react-toastify';
import MainLayout from '../components/layout/MainLayout.jsx';
import { fetchOrders } from '../services/order.service.js';

const statusVariantMap = {
    PLACED: 'secondary',
    ACCEPTED: 'primary',
    IN_PREP: 'warning',
    READY: 'success',
    COMPLETED: 'dark',
    CANCELLED: 'danger'
};

const OrdersPage = () => {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const loadOrders = async () => {
            try {
                setLoading(true);
                const { data } = await fetchOrders();
                setOrders(data?.data || []);
            } catch (error) {
                toast.error(error.response?.data?.message || 'Unable to load orders');
            } finally {
                setLoading(false);
            }
        };

        loadOrders();
    }, []);

    return (
        <MainLayout>
            <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h2>Orders</h2>
                    <p className="text-muted mb-0">Track live QR-originated orders across restaurants.</p>
                </div>
            </div>
            {loading ? (
                <div className="d-flex justify-content-center py-5">
                    <Spinner animation="border" />
                </div>
            ) : (
                <Table striped hover responsive className="bg-white shadow-sm">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Restaurant</th>
                            <th>Table</th>
                            <th>Status</th>
                            <th>Total (₫)</th>
                            <th>Placed At</th>
                        </tr>
                    </thead>
                    <tbody>
                        {orders.length === 0 && (
                            <tr>
                                <td colSpan="6" className="text-center py-4">
                                    No orders to display yet.
                                </td>
                            </tr>
                        )}
                        {orders.map((order) => (
                            <tr key={order.id}>
                                <td>{order.shortCode || order.id.slice(0, 8)}</td>
                                <td>{order.restaurant?.name || '—'}</td>
                                <td>{order.table?.name || '—'}</td>
                                <td>
                                    <Badge bg={statusVariantMap[order.status] || 'secondary'}>{order.status}</Badge>
                                </td>
                                <td>{(order.totalCents || 0) / 100}</td>
                                <td>{order.placedAt ? new Date(order.placedAt).toLocaleString() : '—'}</td>
                            </tr>
                        ))}
                    </tbody>
                </Table>
            )}
        </MainLayout>
    );
};

export default OrdersPage;
