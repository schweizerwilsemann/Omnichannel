import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Alert, Button, Card, Spinner } from 'react-bootstrap';
import { claimVoucherByToken } from '../services/session.js';

const VoucherClaimPage = () => {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token') || '';
    const [status, setStatus] = useState(token ? 'loading' : 'error');
    const [result, setResult] = useState(null);
    const [error, setError] = useState(
        token ? '' : 'Missing claim token. Please open the link from your email again.'
    );

    useEffect(() => {
        if (!token) {
            return;
        }

        let isCancelled = false;

        const claimVoucher = async () => {
            setStatus('loading');
            try {
                const response = await claimVoucherByToken({ token });
                if (isCancelled) {
                    return;
                }
                setResult(response.data?.data || null);
                setStatus('success');
            } catch (err) {
                if (isCancelled) {
                    return;
                }
                const message = err.response?.data?.message || err.message || 'Unable to save voucher right now.';
                setError(message);
                setStatus('error');
            }
        };

        claimVoucher();

        return () => {
            isCancelled = true;
        };
    }, [token]);

    const renderBody = () => {
        if (status === 'loading') {
            return (
                <div className="d-flex flex-column align-items-center gap-3 py-4">
                    <Spinner animation="border" />
                    <div className="text-muted">Saving your voucher...</div>
                </div>
            );
        }

        if (status === 'error') {
            return (
                <Alert variant="danger" className="mb-0">
                    <h5 className="fw-semibold">We couldn&apos;t save that voucher</h5>
                    <p className="mb-3">{error}</p>
                    <div className="d-flex gap-2">
                        <Button as={Link} to="/" variant="outline-secondary">
                            Go to homepage
                        </Button>
                    </div>
                </Alert>
            );
        }

        const alreadyClaimed = Boolean(result?.alreadyClaimed);
        const voucherName = result?.voucher?.name || result?.promotion?.name || 'Reward saved';
        const voucherCode = result?.voucher?.code || result?.code || '';
        const expiresAt = result?.expiresAt ? new Date(result.expiresAt).toLocaleDateString() : null;

        return (
            <div className="d-flex flex-column gap-3">
                <div>
                    <h4 className="mb-1">
                        {alreadyClaimed ? 'Voucher already in your bag' : 'Voucher saved to your bag'}
                    </h4>
                    <p className="text-muted mb-0">
                        {alreadyClaimed
                            ? 'We found this reward in your wallet. Apply it when you check out on your next visit.'
                            : 'We\'ll remember this reward the next time you join us. Scan the table QR when you arrive and you can apply it at checkout.'}
                    </p>
                </div>
                <Card className="shadow-sm">
                    <Card.Body className="d-flex flex-column gap-1">
                        <div className="text-muted small text-uppercase fw-semibold">Voucher</div>
                        <div className="fs-5 fw-semibold">{voucherName}</div>
                        {voucherCode ? (
                            <div className="badge bg-dark-subtle text-dark align-self-start">Code: {voucherCode}</div>
                        ) : null}
                        {expiresAt ? (
                            <div className="text-muted small">Expires on {expiresAt}</div>
                        ) : (
                            <div className="text-muted small">No expiry date</div>
                        )}
                    </Card.Body>
                </Card>
                <Button as={Link} to="/" variant="primary">
                    See menu
                </Button>
            </div>
        );
    };

    return (
        <div className="voucher-claim-page min-vh-100 d-flex align-items-center bg-light">
            <div className="container py-5">
                <div className="row justify-content-center">
                    <div className="col-md-6">
                        <Card className="shadow-sm">
                            <Card.Body>{renderBody()}</Card.Body>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VoucherClaimPage;
