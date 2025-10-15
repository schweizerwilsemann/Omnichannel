import { useEffect, useState, useMemo } from 'react';
import { Alert, Card, Col, ProgressBar, Row, Spinner, Table } from 'react-bootstrap';
import { toast } from 'react-toastify';
import MainLayout from '../components/layout/MainLayout.jsx';
import { fetchDashboardOverview } from '../services/dashboard.service.js';

const formatCurrency = (cents) => `USD ${(cents / 100).toFixed(2)}`;

const statusVariantMap = {
    PLACED: 'secondary',
    ACCEPTED: 'info',
    IN_PREP: 'warning',
    READY: 'primary',
    COMPLETED: 'success',
    CANCELLED: 'danger'
};

const formatDateLabel = (isoDate) => {
    try {
        const date = new Date(isoDate);
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch (error) {
        return isoDate;
    }
};

const TrendRow = ({ date, revenueCents, orders, maxRevenue }) => {
    const percent = maxRevenue > 0 ? Math.round((revenueCents / maxRevenue) * 100) : 0;
    return (
        <div className="d-flex align-items-center gap-3 py-2">
            <div style={{ width: 72 }} className="text-muted small">
                {formatDateLabel(date)}
            </div>
            <div className="flex-grow-1">
                <div className="bg-light rounded" style={{ height: 12 }}>
                    <div
                        className="bg-primary rounded"
                        style={{ width: `${Math.max(percent, orders > 0 ? 4 : 0)}%`, height: '100%' }}
                    />
                </div>
            </div>
            <div style={{ width: 140 }} className="text-end fw-semibold">
                {formatCurrency(revenueCents)}
            </div>
            <div style={{ width: 90 }} className="text-end text-muted small">
                {orders} order{orders === 1 ? '' : 's'}
            </div>
        </div>
    );
};

const DashboardPage = () => {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setLoading(true);
            setError(null);
            try {
                const response = await fetchDashboardOverview();
                const payload = response.data?.data;
                if (!cancelled) {
                    setData(payload || null);
                }
            } catch (err) {
                if (!cancelled) {
                    const message = err.response?.data?.message || err.message || 'Unable to load dashboard';
                    setError(message);
                    toast.error(message);
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        load();
        return () => {
            cancelled = true;
        };
    }, []);

    const totals = data?.totals || {
        ordersToday: 0,
        completedOrdersToday: 0,
        revenueTodayCents: 0,
        averageOrderValueTodayCents: 0,
        activeGuestSessions: 0
    };

    const statusDistribution = data?.orderStatusDistribution || [];
    const revenueTrend = data?.revenueTrend || [];
    const topMenuItems = data?.topMenuItems || [];

    const statusTotal = statusDistribution.reduce((acc, item) => acc + item.count, 0);
    const maxRevenue = useMemo(
        () => revenueTrend.reduce((acc, item) => Math.max(acc, item.revenueCents || 0), 0),
        [revenueTrend]
    );

    return (
        <MainLayout>
            <div className="d-flex flex-column gap-4">
                <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
                    <div>
                        <h2 className="mb-1">Dashboard</h2>
                        <p className="text-muted mb-0">Snapshot of guest sessions, order flow, and top performers.</p>
                    </div>
                </div>

                {loading ? (
                    <div className="d-flex justify-content-center py-5">
                        <Spinner animation="border" role="status" />
                    </div>
                ) : null}

                {!loading && error ? <Alert variant="danger">{error}</Alert> : null}

                {!loading && !error ? (
                    <>
                        <Row xs={1} md={2} xl={4} className="g-3">
                            <Col>
                                <Card className="shadow-sm h-100">
                                    <Card.Body>
                                        <Card.Title className="text-muted text-uppercase small">Orders today</Card.Title>
                                        <div className="display-6 fw-semibold">{totals.ordersToday}</div>
                                        <Card.Text className="text-muted mb-0">{totals.completedOrdersToday} completed</Card.Text>
                                    </Card.Body>
                                </Card>
                            </Col>
                            <Col>
                                <Card className="shadow-sm h-100">
                                    <Card.Body>
                                        <Card.Title className="text-muted text-uppercase small">Revenue today</Card.Title>
                                        <div className="display-6 fw-semibold">{formatCurrency(totals.revenueTodayCents)}</div>
                                        <Card.Text className="text-muted mb-0">
                                            Avg. order {formatCurrency(totals.averageOrderValueTodayCents)}
                                        </Card.Text>
                                    </Card.Body>
                                </Card>
                            </Col>
                            <Col>
                                <Card className="shadow-sm h-100">
                                    <Card.Body>
                                        <Card.Title className="text-muted text-uppercase small">Active tables</Card.Title>
                                        <div className="display-6 fw-semibold">{totals.activeGuestSessions}</div>
                                        <Card.Text className="text-muted mb-0">Guest sessions currently open</Card.Text>
                                    </Card.Body>
                                </Card>
                            </Col>
                            <Col>
                                <Card className="shadow-sm h-100">
                                    <Card.Body>
                                        <Card.Title className="text-muted text-uppercase small">Status health</Card.Title>
                                        <div className="display-6 fw-semibold">{statusTotal}</div>
                                        <Card.Text className="text-muted mb-0">Orders in the past 7 days</Card.Text>
                                    </Card.Body>
                                </Card>
                            </Col>
                        </Row>

                        <Row xs={1} xl={2} className="g-3">
                            <Col>
                                <Card className="shadow-sm h-100">
                                    <Card.Body className="d-flex flex-column gap-3">
                                        <div>
                                            <Card.Title className="mb-0">Order status distribution</Card.Title>
                                            <Card.Text className="text-muted small mb-0">Past 7 days</Card.Text>
                                        </div>
                                        {statusDistribution.length === 0 ? (
                                            <div className="text-muted small">No orders yet.</div>
                                        ) : (
                                            <>
                                                <ProgressBar style={{ height: 12 }}>
                                                    {statusDistribution.map((item) => {
                                                        const value = item.count;
                                                        const variant = statusVariantMap[item.status] || 'secondary';
                                                        const percent = statusTotal > 0 ? (value / statusTotal) * 100 : 0;
                                                        return (
                                                            <ProgressBar
                                                                key={item.status}
                                                                now={percent}
                                                                variant={variant}
                                                            />
                                                        );
                                                    })}
                                                </ProgressBar>
                                                <Table striped bordered hover size="sm" className="mb-0">
                                                    <thead>
                                                        <tr>
                                                            <th>Status</th>
                                                            <th className="text-end">Orders</th>
                                                            <th className="text-end">Share</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {statusDistribution.map((item) => {
                                                            const share = statusTotal > 0 ? Math.round((item.count / statusTotal) * 100) : 0;
                                                            return (
                                                                <tr key={item.status}>
                                                                    <td>{item.status}</td>
                                                                    <td className="text-end">{item.count}</td>
                                                                    <td className="text-end text-muted">{share}%</td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </Table>
                                            </>
                                        )}
                                    </Card.Body>
                                </Card>
                            </Col>
                            <Col>
                                <Card className="shadow-sm h-100">
                                    <Card.Body className="d-flex flex-column gap-3">
                                        <div>
                                            <Card.Title className="mb-0">Top menu items</Card.Title>
                                            <Card.Text className="text-muted small mb-0">Past 7 days</Card.Text>
                                        </div>
                                        {topMenuItems.length === 0 ? (
                                            <div className="text-muted small">No items sold yet.</div>
                                        ) : (
                                            <Table striped bordered hover size="sm" className="mb-0">
                                                <thead>
                                                    <tr>
                                                        <th>Item</th>
                                                        <th className="text-end">Qty</th>
                                                        <th className="text-end">Revenue</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {topMenuItems.map((item) => (
                                                        <tr key={item.menuItemId}>
                                                            <td>{item.name}</td>
                                                            <td className="text-end">{item.quantity}</td>
                                                            <td className="text-end">{formatCurrency(item.revenueCents)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </Table>
                                        )}
                                    </Card.Body>
                                </Card>
                            </Col>
                        </Row>

                        <Card className="shadow-sm">
                            <Card.Body className="d-flex flex-column gap-3">
                                <div>
                                    <Card.Title className="mb-0">Revenue trend</Card.Title>
                                    <Card.Text className="text-muted small mb-0">Daily totals · Past 7 days</Card.Text>
                                </div>
                                {revenueTrend.length === 0 ? (
                                    <div className="text-muted small">No revenue recorded yet.</div>
                                ) : (
                                    <div>
                                        {revenueTrend.map((entry) => (
                                            <TrendRow
                                                key={entry.date}
                                                date={entry.date}
                                                revenueCents={entry.revenueCents}
                                                orders={entry.orders}
                                                maxRevenue={maxRevenue}
                                            />
                                        ))}
                                    </div>
                                )}
                            </Card.Body>
                        </Card>
                    </>
                ) : null}
            </div>
        </MainLayout>
    );
};

export default DashboardPage;






