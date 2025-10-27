import { useCallback, useEffect, useState } from 'react';
import { Alert, Badge, Button, Card, Spinner } from 'react-bootstrap';
import { toast } from 'react-toastify';
import { fetchKnowledgeStatus, flushChatCache, triggerKnowledgeSync } from '../../services/ops.service.js';

const formatTimestamp = (value) => {
    if (!value) {
        return 'Never';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return value;
    }
    return date.toLocaleString();
};

const KnowledgeSyncPanel = () => {
    const [status, setStatus] = useState(null);
    const [loadingStatus, setLoadingStatus] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [flushing, setFlushing] = useState(false);

    const loadStatus = useCallback(async () => {
        try {
            setLoadingStatus(true);
            const response = await fetchKnowledgeStatus();
            setStatus(response.data?.data || null);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Unable to load knowledge status.');
        } finally {
            setLoadingStatus(false);
        }
    }, []);

    useEffect(() => {
        loadStatus();
    }, [loadStatus]);

    const handleSync = async () => {
        if (syncing) {
            return;
        }
        setSyncing(true);
        try {
            const response = await triggerKnowledgeSync();
            const summary = response.data?.data || {};
            toast.success(
                `Synced ${summary.documents || 0} documents across ${summary.restaurants || 0} restaurant${
                    summary.restaurants === 1 ? '' : 's'
                }.`
            );
            loadStatus();
        } catch (error) {
            const message = error.response?.data?.message || 'Knowledge sync failed.';
            toast.error(message);
        } finally {
            setSyncing(false);
        }
    };

    const handleFlush = async () => {
        if (flushing) {
            return;
        }
        setFlushing(true);
        try {
            await flushChatCache();
            toast.success('Chat cache cleared.');
            loadStatus();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Unable to clear cache.');
        } finally {
            setFlushing(false);
        }
    };

    const renderState = () => {
        if (loadingStatus) {
            return (
                <div className="d-flex align-items-center gap-2 text-muted">
                    <Spinner animation="border" size="sm" />
                    <span>Loading status…</span>
                </div>
            );
        }

        if (!status?.configured) {
            return (
                <Alert variant="warning" className="mb-0">
                    RAG service URL is not configured. Set `RAG_SERVICE_URL` and `RAG_ADMIN_KEY` to enable the assistant sync.
                </Alert>
            );
        }

        return (
            <div className="d-flex flex-column gap-2">
                <div className="d-flex gap-2 align-items-center flex-wrap">
                    <Badge bg={status.syncing ? 'info' : 'success'}>
                        {status.syncing ? 'Sync in progress' : 'Idle'}
                    </Badge>
                    {status.autoSync?.enabled ? (
                        <Badge bg="secondary">
                            Auto every {status.autoSync.intervalMinutes} min
                        </Badge>
                    ) : (
                        <Badge bg="secondary">Auto sync disabled</Badge>
                    )}
                </div>
                <div className="text-muted small">
                    <div>Last sync: {formatTimestamp(status.lastRunAt)}</div>
                    <div>Last cache flush: {formatTimestamp(status.lastCacheFlushAt)}</div>
                    {status.lastRunSummary ? (
                        <div>
                            Last summary: {status.lastRunSummary.documents || 0} docs /{' '}
                            {status.lastRunSummary.restaurants || 0} restaurants
                        </div>
                    ) : null}
                    {status.lastError ? (
                        <div className="text-danger">
                            Last error ({formatTimestamp(status.lastError.at)}): {status.lastError.message}
                        </div>
                    ) : null}
                </div>
            </div>
        );
    };

    return (
        <Card className="shadow-sm">
            <Card.Body className="d-flex flex-column gap-3">
                <div className="d-flex flex-wrap justify-content-between gap-2 align-items-start">
                    <div>
                        <h5 className="mb-1">AI assistant knowledge</h5>
                        <p className="text-muted mb-0">
                            One click pulls the latest promotions, menu items, and restaurant data into the chatbot and
                            clears stale answers.
                        </p>
                    </div>
                    <div className="d-flex gap-2">
                        <Button
                            variant="outline-secondary"
                            onClick={handleFlush}
                            disabled={flushing || loadingStatus || !status?.configured}
                        >
                            {flushing ? 'Clearing…' : 'Clear chat cache'}
                        </Button>
                        <Button onClick={handleSync} disabled={syncing || loadingStatus || !status?.configured}>
                            {syncing ? (
                                <>
                                    <Spinner animation="border" size="sm" className="me-2" />
                                    Syncing…
                                </>
                            ) : (
                                'Run knowledge sync'
                            )}
                        </Button>
                    </div>
                </div>
                {renderState()}
            </Card.Body>
        </Card>
    );
};

export default KnowledgeSyncPanel;
