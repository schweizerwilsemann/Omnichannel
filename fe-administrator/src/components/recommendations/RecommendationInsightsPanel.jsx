import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Card, Col, Form, Pagination, Row, Spinner, Table } from 'react-bootstrap';
import { fetchRecommendationAnalytics } from '../../services/recommendation.service.js';
import TrendSparkline from './TrendSparkline.jsx';

const defaultSummary = Object.freeze({
    totalPairs: 0,
    averageAttachRate: 0,
    averageConfidence: 0,
    averageLift: 0,
    lastUpdatedAt: null,
    trendWindowDays: 30
});

const PAGE_SIZE = 25;

const formatPercent = (value, digits = 1) => {
    const ratio = Number(value);
    if (!Number.isFinite(ratio)) {
        return '0%';
    }
    return `${(ratio * 100).toFixed(digits)}%`;
};

const formatCurrency = (value) => {
    const cents = Number(value);
    if (!Number.isFinite(cents)) {
        return 'USD 0.00';
    }
    return `USD ${(cents / 100).toFixed(2)}`;
};

const describeSources = (metadata = {}) => {
    const sources = metadata.sources || {};
    const synthetic = sources.synthetic || 0;
    const historical = sources.historical || 0;
    if (synthetic === 0 && historical === 0) {
        return null;
    }
    return { synthetic, historical };
};

const RecommendationInsightsPanel = () => {
    const [filters, setFilters] = useState({ restaurantId: '', minAttachRate: 0.1, trendWindowDays: 30 });
    const [analytics, setAnalytics] = useState({ rows: [], restaurants: [], summary: defaultSummary });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [page, setPage] = useState(1);
    const [paginationInfo, setPaginationInfo] = useState({
        page: 1,
        pageSize: PAGE_SIZE,
        total: 0,
        totalPages: 1
    });

    const loadAnalytics = useCallback(async (params) => {
        const effectiveFilters = params || { restaurantId: '', minAttachRate: 0, trendWindowDays: 30, page: 1 };
        const requestedPage = effectiveFilters.page ?? 1;
        setLoading(true);
        setError('');
        try {
            const response = await fetchRecommendationAnalytics({
                limit: PAGE_SIZE,
                page: requestedPage,
                ...(effectiveFilters.restaurantId ? { restaurantId: effectiveFilters.restaurantId } : {}),
                minAttachRate: effectiveFilters.minAttachRate ?? 0,
                trendWindowDays: effectiveFilters.trendWindowDays ?? 30
            });
            const payload = response?.data?.data || {};
            setAnalytics({
                rows: payload.rows || [],
                restaurants: payload.restaurants || [],
                summary: { ...defaultSummary, ...(payload.summary || {}) }
            });
            const serverPagination = payload.pagination || {};
            setPaginationInfo({
                page: serverPagination.page || requestedPage,
                pageSize: serverPagination.pageSize || PAGE_SIZE,
                total: serverPagination.total ?? payload.summary?.totalPairs ?? (payload.rows || []).length,
                totalPages:
                    serverPagination.totalPages ||
                    Math.max(
                        1,
                        Math.ceil(
                            (serverPagination.total ??
                                payload.summary?.totalPairs ??
                                (payload.rows || []).length) / (serverPagination.pageSize || PAGE_SIZE)
                        )
                    )
            });
            const resolvedPage = serverPagination.page || requestedPage;
            if (resolvedPage !== requestedPage) {
                setPage(resolvedPage);
            }
        } catch (err) {
            const message = err?.response?.data?.message || err?.message || 'Unable to load recommendation analytics.';
            setError(message);
            setAnalytics((prev) => ({ ...prev, rows: [] }));
            setPaginationInfo((prev) => ({ ...prev, total: 0, totalPages: 1 }));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadAnalytics({ ...filters, page });
    }, [filters, page, loadAnalytics]);

    const restaurantOptions = useMemo(() => analytics.restaurants || [], [analytics.restaurants]);
    const lastUpdated = analytics.summary.lastUpdatedAt
        ? new Date(analytics.summary.lastUpdatedAt).toLocaleString()
        : '—';
    const totalPages = paginationInfo.totalPages || 1;
    const pageSize = paginationInfo.pageSize || PAGE_SIZE;
    const hasResults = analytics.rows.length > 0;
    const startEntry = hasResults ? (paginationInfo.page - 1) * pageSize + 1 : 0;
    const endEntry = hasResults ? startEntry + analytics.rows.length - 1 : 0;

    const handlePageChange = (nextPage) => {
        if (nextPage < 1 || nextPage > totalPages || nextPage === page) {
            return;
        }
        setPage(nextPage);
    };

    const maxPagesToShow = 5;
    let startPage = Math.max(1, page - Math.floor(maxPagesToShow / 2));
    let endPage = startPage + maxPagesToShow - 1;
    if (endPage > totalPages) {
        endPage = totalPages;
        startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }
    const paginationItems = [];
    for (let index = startPage; index <= endPage; index += 1) {
        paginationItems.push(
            <Pagination.Item key={index} active={index === page} onClick={() => handlePageChange(index)}>
                {index}
            </Pagination.Item>
        );
    }

    return (
        <div className="pt-4 d-flex flex-column gap-4">
            <Card className="shadow-sm">
                <Card.Body>
                    <Row className="g-3 align-items-end">
                        <Col md={4}>
                            <Form.Group controlId="recommendation-restaurant">
                                <Form.Label>Restaurant</Form.Label>
                                <Form.Select
                                    value={filters.restaurantId}
                                    onChange={(event) => {
                                        setFilters((prev) => ({ ...prev, restaurantId: event.target.value || '' }));
                                        setPage(1);
                                    }}
                                >
                                    <option value="">All venues</option>
                                    {restaurantOptions.map((restaurant) => (
                                        <option key={restaurant.id} value={restaurant.id}>
                                            {restaurant.name}
                                        </option>
                                    ))}
                                </Form.Select>
                            </Form.Group>
                        </Col>
                        <Col md={4}>
                            <Form.Group controlId="recommendation-attach-rate">
                                <Form.Label>
                                    Minimum attach rate{' '}
                                    <Badge bg="secondary" className="ms-2">
                                        {formatPercent(filters.minAttachRate, 0)}
                                    </Badge>
                                </Form.Label>
                                <Form.Range
                                    min={0}
                                    max={100}
                                    step={5}
                                    value={Math.round(filters.minAttachRate * 100)}
                                    onChange={(event) => {
                                        setFilters((prev) => ({
                                            ...prev,
                                            minAttachRate: Number(event.target.value) / 100
                                        }));
                                        setPage(1);
                                    }}
                                />
                            </Form.Group>
                        </Col>
                        <Col md={4}>
                            <Form.Group controlId="recommendation-trend-window">
                                <Form.Label>Trend window</Form.Label>
                                <Form.Select
                                    value={filters.trendWindowDays}
                                    onChange={(event) => {
                                        setFilters((prev) => ({
                                            ...prev,
                                            trendWindowDays: Number(event.target.value)
                                        }));
                                        setPage(1);
                                    }}
                                >
                                    {[7, 14, 30, 60, 90, 120].map((days) => (
                                        <option key={days} value={days}>
                                            Last {days} days
                                        </option>
                                    ))}
                                </Form.Select>
                            </Form.Group>
                            <div className="d-flex flex-wrap gap-2 justify-content-between align-items-center mt-2">
                                <div className="text-muted small">
                                    Updated: <span className="fw-semibold">{lastUpdated}</span>
                                </div>
                                <Button
                                    variant="outline-secondary"
                                    onClick={() => loadAnalytics({ ...filters, page })}
                                    disabled={loading}
                                >
                                    {loading ? (
                                        <>
                                            <Spinner animation="border" size="sm" className="me-2" /> Refreshing…
                                        </>
                                    ) : (
                                        'Refresh'
                                    )}
                                </Button>
                            </div>
                        </Col>
                    </Row>
                </Card.Body>
            </Card>

            <Row className="g-3">
                <Col md={3}>
                    <Card className="shadow-sm h-100">
                        <Card.Body>
                            <div className="text-muted small">Tracked pairs</div>
                            <div className="display-6 fw-bold mb-0">{analytics.summary.totalPairs}</div>
                        </Card.Body>
                    </Card>
                </Col>
                <Col md={3}>
                    <Card className="shadow-sm h-100">
                        <Card.Body>
                            <div className="text-muted small">Avg attach rate</div>
                            <div className="display-6 fw-bold mb-0">
                                {formatPercent(analytics.summary.averageAttachRate, 1)}
                            </div>
                        </Card.Body>
                    </Card>
                </Col>
                <Col md={3}>
                    <Card className="shadow-sm h-100">
                        <Card.Body>
                            <div className="text-muted small">Avg lift</div>
                            <div className="display-6 fw-bold mb-0">{analytics.summary.averageLift.toFixed(2)}</div>
                        </Card.Body>
                    </Card>
                </Col>
                <Col md={3}>
                    <Card className="shadow-sm h-100">
                        <Card.Body>
                            <div className="text-muted small">Avg confidence</div>
                            <div className="display-6 fw-bold mb-0">
                                {formatPercent(analytics.summary.averageConfidence, 1)}
                            </div>
                        </Card.Body>
                    </Card>
                </Col>
            </Row>

            <Card className="shadow-sm">
                <Card.Body className="d-flex flex-column gap-3">
                    <div className="d-flex justify-content-between align-items-center">
                        <h5 className="mb-0">Top recommendation pairs</h5>
                        {loading && (
                            <span className="text-muted small d-flex align-items-center gap-2">
                                <Spinner animation="border" size="sm" /> Updating…
                            </span>
                        )}
                    </div>

                    <div className="text-muted small">
                        Trend window: last{' '}
                        <span className="fw-semibold">
                            {analytics.summary.trendWindowDays || filters.trendWindowDays} days
                        </span>
                    </div>

                    {error ? <Alert variant="warning">{error}</Alert> : null}
                    {!loading && !error && analytics.rows.length === 0 ? (
                        <Alert variant="light" className="mb-0">
                            No recommendation pairs match the current filters. Lower the minimum attach rate or generate a
                            fresh recommendation run.
                        </Alert>
                    ) : null}

                    {analytics.rows.length > 0 ? (
                        <>
                            <div className="table-responsive">
                                <Table hover size="sm" className="align-middle">
                                    <thead>
                                        <tr>
                                            <th style={{ width: '5%' }}>#</th>
                                            <th style={{ width: '20%' }}>Base item</th>
                                            <th style={{ width: '20%' }}>Companion item</th>
                                            <th style={{ width: '12%' }} className="text-end">
                                                Attach rate
                                            </th>
                                            <th style={{ width: '10%' }} className="text-end">
                                                Lift
                                            </th>
                                            <th style={{ width: '12%' }} className="text-end">
                                                Confidence
                                            </th>
                                            <th style={{ width: '11%' }} className="text-end">
                                                Support
                                            </th>
                                            <th style={{ width: '16%' }}>
                                                Trend
                                            </th>
                                            <th style={{ width: '10%' }} className="text-end">
                                                Est. upsell
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {analytics.rows.map((row) => {
                                            const sourceBreakdown = describeSources(row.metadata || {});
                                            const trend = row.trend || {};
                                            const trendPoints = Array.isArray(trend.points) ? trend.points : [];
                                            const trendDirectionClass =
                                                trend.direction === 'UP'
                                                    ? 'text-success'
                                                    : trend.direction === 'DOWN'
                                                      ? 'text-danger'
                                                      : 'text-muted';
                                            const trendWindow =
                                                trend.windowDays || analytics.summary.trendWindowDays || filters.trendWindowDays;
                                            const deltaPercent = trend.delta || 0;
                                            const trendLabelContent =
                                                trendPoints.length > 1
                                                    ? `${deltaPercent >= 0 ? '+' : ''}${formatPercent(deltaPercent, 1)} vs ${trendWindow}d`
                                                    : 'Not enough data';
                                            return (
                                                <tr key={row.id}>
                                                    <td>{row.rank}</td>
                                                    <td>
                                                        <div className="fw-semibold">{row.baseItem?.name || '—'}</div>
                                                        <div className="text-muted small">
                                                            {row.baseItem?.category?.name || 'Uncategorised'} ·{' '}
                                                            {formatCurrency(row.baseItem?.priceCents || 0)}
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div className="fw-semibold">{row.companionItem?.name || '—'}</div>
                                                        <div className="text-muted small">
                                                            {row.companionItem?.category?.name || 'Uncategorised'} ·{' '}
                                                            {formatCurrency(row.companionItem?.priceCents || 0)}
                                                        </div>
                                                    </td>
                                                    <td className="text-end">{formatPercent(row.attachRate)}</td>
                                                    <td className="text-end">{row.lift.toFixed(2)}</td>
                                                    <td className="text-end">{formatPercent(row.confidence)}</td>
                                                    <td className="text-end">
                                                        {formatPercent(row.support, 2)}{' '}
                                                        <span className="text-muted small">({row.supportCount})</span>
                                                    </td>
                                                    <td>
                                                        <div className="d-flex flex-column gap-1">
                                                            <TrendSparkline points={trendPoints} />
                                                            <div className={`small ${trendDirectionClass}`}>
                                                                {trendLabelContent}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="text-end">
                                                        {formatCurrency(row.estimatedIncrementalRevenueCents || 0)}
                                                        <div className="text-muted small">
                                                            ≈ {formatCurrency(row.projectedPairRevenueCents || 0)} total
                                                        </div>
                                                        {sourceBreakdown ? (
                                                            <div className="text-muted small">
                                                                hist: {sourceBreakdown.historical} · synth:{' '}
                                                                {sourceBreakdown.synthetic}
                                                            </div>
                                                        ) : null}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </Table>
                            </div>
                            <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mt-3 gap-2">
                                <div className="text-muted small">
                                    Showing {startEntry}-{endEntry} of {paginationInfo.total} pairs
                                </div>
                                <Pagination className="mb-0">
                                    <Pagination.First disabled={page === 1} onClick={() => handlePageChange(1)} />
                                    <Pagination.Prev disabled={page === 1} onClick={() => handlePageChange(page - 1)} />
                                    {paginationItems}
                                    <Pagination.Next
                                        disabled={page === totalPages || totalPages === 0}
                                        onClick={() => handlePageChange(page + 1)}
                                    />
                                    <Pagination.Last
                                        disabled={page === totalPages || totalPages === 0}
                                        onClick={() => handlePageChange(totalPages)}
                                    />
                                </Pagination>
                            </div>
                        </>
                    ) : null}
                </Card.Body>
            </Card>
        </div>
    );
};

export default RecommendationInsightsPanel;
