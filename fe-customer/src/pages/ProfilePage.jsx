import { useEffect, useState } from 'react';
import { Alert, Button, Card, Col, Form, Row, Spinner } from 'react-bootstrap';
import { toast } from 'react-toastify';
import { useSession } from '../context/SessionContext.jsx';
import {
    fetchCustomerProfile,
    startAuthenticatorSetup,
    confirmAuthenticatorSetup,
    disableAuthenticator,
    updateMembershipPin
} from '../services/session.js';
import QRCode from 'qrcode';

const formatValue = (value) => (value === null || value === undefined || value === '' ? '—' : value);

const ProfilePage = () => {
    const { session } = useSession();
    const sessionToken = session?.sessionToken || null;
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState(null);
    const [error, setError] = useState(null);
    const [setupState, setSetupState] = useState(null);
    const [verificationCode, setVerificationCode] = useState('');
    const [actionLoading, setActionLoading] = useState(false);
    const [pinForm, setPinForm] = useState({ currentPin: '', newPin: '', confirmPin: '' });
    const [pinSubmitting, setPinSubmitting] = useState(false);
    const [localQrCode, setLocalQrCode] = useState(null);

    const loadProfile = async () => {
        if (!sessionToken) {
            setProfile(null);
            setError('Start a session to view your profile.');
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const response = await fetchCustomerProfile(sessionToken);
            setProfile(response.data?.data || null);
            setError(null);
        } catch (err) {
            const message = err.response?.data?.message || err.message || 'Unable to load profile details';
            setError(message);
            setProfile(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadProfile();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sessionToken]);

    const handleStartSetup = async () => {
        if (!sessionToken) {
            toast.error('Session token missing. Please start a session again.');
            return;
        }
        setActionLoading(true);
        try {
            const response = await startAuthenticatorSetup({ sessionToken });
            const payload = response.data?.data;
            if (!payload?.secret) {
                throw new Error('Unexpected response from authenticator setup');
            }
            setSetupState(payload);
            setVerificationCode('');
            toast.info('Scan the key with your authenticator app, then confirm with a 6-digit code.');
        } catch (err) {
            const message = err.response?.data?.message || err.message || 'Unable to start authenticator setup';
            toast.error(message);
        } finally {
            setActionLoading(false);
        }
    };

    const handleConfirmSetup = async (event) => {
        event.preventDefault();
        if (!sessionToken) {
            return;
        }
        const trimmedCode = verificationCode.trim();
        if (!trimmedCode) {
            toast.error('Enter the code from your authenticator app.');
            return;
        }
        setActionLoading(true);
        try {
            await confirmAuthenticatorSetup({ sessionToken, code: trimmedCode });
            toast.success('Authenticator enabled. You can now use it to sign in.');
            setSetupState(null);
            setVerificationCode('');
            await loadProfile();
        } catch (err) {
            const message = err.response?.data?.message || err.message || 'Invalid code. Please try again.';
            toast.error(message);
        } finally {
            setActionLoading(false);
        }
    };

    const handleCancelSetup = () => {
        setSetupState(null);
        setVerificationCode('');
        setLocalQrCode(null);
    };

    const handleDisableAuthenticator = async () => {
        if (!sessionToken) {
            return;
        }
        setActionLoading(true);
        try {
            await disableAuthenticator(sessionToken);
            toast.info('Authenticator disabled. Future sign-ins will use email PIN.');
            setSetupState(null);
            setLocalQrCode(null);
            await loadProfile();
        } catch (err) {
            const message = err.response?.data?.message || err.message || 'Unable to disable authenticator right now';
            toast.error(message);
        } finally {
            setActionLoading(false);
        }
    };

    const handlePinFormChange = (event) => {
        const { name, value } = event.target;
        setPinForm((prev) => ({
            ...prev,
            [name]: value
        }));
    };

    const handlePinSubmit = async (event) => {
        event.preventDefault();
        if (!sessionToken || pinSubmitting) {
            return;
        }

        const newPin = pinForm.newPin.trim();
        const confirmPin = pinForm.confirmPin.trim();
        const currentPin = pinForm.currentPin.trim();
        const pinSet = Boolean(profile?.authentication?.pinSet);

        if (!/^[0-9]{4,6}$/.test(newPin)) {
            toast.error('New PIN must be 4–6 digits.');
            return;
        }

        if (newPin !== confirmPin) {
            toast.error('PIN confirmation does not match.');
            return;
        }

        if (pinSet && !currentPin) {
            toast.error('Enter your current PIN to make changes.');
            return;
        }

        setPinSubmitting(true);
        try {
            await updateMembershipPin({
                sessionToken,
                currentPin: pinSet ? currentPin : null,
                newPin
            });
            toast.success('PIN updated successfully.');
            setPinForm({ currentPin: '', newPin: '', confirmPin: '' });
            await loadProfile();
        } catch (err) {
            const message = err.response?.data?.message || err.message || 'Unable to update PIN right now';
            toast.error(message);
        } finally {
            setPinSubmitting(false);
        }
    };

    useEffect(() => {
        let cancelled = false;
        const buildQr = async () => {
            const source = setupState?.qrCodeDataUrl || null;
            if (source) {
                setLocalQrCode(source);
                return;
            }
            const uri = setupState?.otpauthUrl || null;
            if (!uri) {
                setLocalQrCode(null);
                return;
            }
            try {
                const dataUrl = await QRCode.toDataURL(uri, {
                    errorCorrectionLevel: 'M',
                    margin: 1,
                    scale: 6
                });
                if (!cancelled) {
                    setLocalQrCode(dataUrl);
                }
            } catch (err) {
                if (!cancelled) {
                    setLocalQrCode(null);
                }
            }
        };
        buildQr();
        return () => {
            cancelled = true;
        };
    }, [setupState]);

    const renderAuthenticatorSection = () => {
        if (!profile?.customer) {
            return (
                <Card className="shadow-sm">
                    <Card.Body>
                        <Card.Title as="h5">Sign-in preferences</Card.Title>
                        <p className="mb-0 text-muted">Add your details to enable authenticator options.</p>
                    </Card.Body>
                </Card>
            );
        }

        const authenticatorEnabled = Boolean(profile?.authenticator?.enabled);

        if (setupState) {
            return (
                <Card className="shadow-sm">
                    <Card.Body className="d-flex flex-column gap-3">
                        <div>
                            <Card.Title as="h5">Set up authenticator</Card.Title>
                            <p className="text-muted mb-2">
                                Use an authenticator app (Google Authenticator, Authy, etc.) to scan the key below or
                                enter it manually. Then confirm with a 6-digit code.
                            </p>
                            <div className="bg-light rounded border p-3">
                                <div className="fw-semibold small text-uppercase text-muted mb-1">Secret key</div>
                                <code className="d-block text-break">{setupState.secret}</code>
                            </div>
                            {localQrCode ? (
                                <div className="mt-3 text-center">
                                    <img
                                        src={localQrCode}
                                        alt="Authenticator QR code"
                                        style={{ maxWidth: 200, width: '100%' }}
                                    />
                                    <div className="small text-muted mt-2">Scan this QR code with your authenticator app.</div>
                                </div>
                            ) : null}
                            {setupState.otpauthUrl ? (
                                <div className="mt-2">
                                    <a href={setupState.otpauthUrl} target="_blank" rel="noreferrer">
                                        Open in authenticator app
                                    </a>
                                </div>
                            ) : null}
                        </div>
                        <Form onSubmit={handleConfirmSetup} className="d-flex flex-column gap-3">
                            <Form.Group controlId="authenticatorCode">
                                <Form.Label>6-digit code</Form.Label>
                                <Form.Control
                                    type="text"
                                    inputMode="numeric"
                                    value={verificationCode}
                                    onChange={(event) => setVerificationCode(event.target.value)}
                                    placeholder="123456"
                                    disabled={actionLoading}
                                />
                            </Form.Group>
                            <div className="d-flex gap-2">
                                <Button type="submit" disabled={actionLoading}>
                                    {actionLoading ? (
                                        <>
                                            <Spinner animation="border" size="sm" className="me-2" />
                                            Verifying...
                                        </>
                                    ) : (
                                        'Confirm setup'
                                    )}
                                </Button>
                                <Button
                                    variant="outline-secondary"
                                    type="button"
                                    onClick={handleCancelSetup}
                                    disabled={actionLoading}
                                >
                                    Cancel
                                </Button>
                            </div>
                        </Form>
                    </Card.Body>
                </Card>
            );
        }

        return (
            <Card className="shadow-sm">
                <Card.Body className="d-flex flex-column gap-3">
                    <div className="d-flex justify-content-between align-items-center">
                        <div>
                            <Card.Title as="h5" className="mb-1">
                                Sign-in preferences
                            </Card.Title>
                            <div className="text-muted">
                                {authenticatorEnabled
                                    ? 'Authenticator app is enabled for faster sign-ins.'
                                    : 'Use an authenticator app for stronger, faster sign-ins.'}
                            </div>
                        </div>
                        <div>
                            <span className={`badge ${authenticatorEnabled ? 'bg-success' : 'bg-secondary'}`}>
                                {authenticatorEnabled ? 'Enabled' : 'Email PIN'}
                            </span>
                        </div>
                    </div>
                    {authenticatorEnabled ? (
                        <Button
                            variant="outline-danger"
                            onClick={handleDisableAuthenticator}
                            disabled={actionLoading}
                        >
                            {actionLoading ? (
                                <>
                                    <Spinner animation="border" size="sm" className="me-2" />
                                    Disabling...
                                </>
                            ) : (
                                'Disable authenticator'
                            )}
                        </Button>
                    ) : (
                        <Button onClick={handleStartSetup} disabled={actionLoading}>
                            {actionLoading ? (
                                <>
                                    <Spinner animation="border" size="sm" className="me-2" />
                                    Preparing...
                                </>
                            ) : (
                                'Set up authenticator'
                            )}
                        </Button>
                    )}
                </Card.Body>
            </Card>
        );
    };

    if (!sessionToken) {
        return (
            <div className="container py-5">
                <Alert variant="info" className="mb-0 text-center">
                    Start a session to view your profile and authentication settings.
                </Alert>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="container py-5 d-flex justify-content-center">
                <Spinner animation="border" />
            </div>
        );
    }

    return (
        <div className="container py-4">
            {error && (
                <Alert variant="danger" className="mb-4">
                    {error}
                </Alert>
            )}
            {profile ? (
                <Row className="g-3">
                    <Col xs={12}>
                        <Card className="shadow-sm">
                            <Card.Body>
                                <Card.Title as="h5">Profile</Card.Title>
                                <Row className="mt-3">
                                    <Col sm={6} className="mb-3">
                                        <div className="text-muted small">First name</div>
                                        <div>{formatValue(profile.customer?.firstName)}</div>
                                    </Col>
                                    <Col sm={6} className="mb-3">
                                        <div className="text-muted small">Last name</div>
                                        <div>{formatValue(profile.customer?.lastName)}</div>
                                    </Col>
                                    <Col sm={6} className="mb-3">
                                        <div className="text-muted small">Email</div>
                                        <div>{formatValue(profile.customer?.email)}</div>
                                    </Col>
                                    <Col sm={6} className="mb-3">
                                        <div className="text-muted small">Phone</div>
                                        <div>{formatValue(profile.customer?.phoneNumber)}</div>
                                    </Col>
                                </Row>
                            </Card.Body>
                        </Card>
                    </Col>
                    <Col xs={12}>
                        <Card className="shadow-sm">
                            <Card.Body>
                                <Card.Title as="h5">Security PIN</Card.Title>
                                <Form onSubmit={handlePinSubmit} className="mt-3 d-flex flex-column gap-3">
                                    {profile?.authentication?.pinSet ? (
                                        <Form.Group controlId="currentPin">
                                            <Form.Label>Current PIN</Form.Label>
                                            <Form.Control
                                                type="password"
                                                name="currentPin"
                                                value={pinForm.currentPin}
                                                onChange={handlePinFormChange}
                                                inputMode="numeric"
                                                placeholder="Enter current PIN"
                                                disabled={pinSubmitting}
                                            />
                                        </Form.Group>
                                    ) : (
                                        <Alert variant="info" className="mb-0">
                                            Set a PIN to sign in faster next time.
                                        </Alert>
                                    )}
                                    <Form.Group controlId="newPin">
                                        <Form.Label>New PIN</Form.Label>
                                        <Form.Control
                                            type="password"
                                            name="newPin"
                                            value={pinForm.newPin}
                                            onChange={handlePinFormChange}
                                            inputMode="numeric"
                                            placeholder="4–6 digit PIN"
                                            disabled={pinSubmitting}
                                        />
                                    </Form.Group>
                                    <Form.Group controlId="confirmPin">
                                        <Form.Label>Confirm new PIN</Form.Label>
                                        <Form.Control
                                            type="password"
                                            name="confirmPin"
                                            value={pinForm.confirmPin}
                                            onChange={handlePinFormChange}
                                            inputMode="numeric"
                                            placeholder="Repeat new PIN"
                                            disabled={pinSubmitting}
                                        />
                                    </Form.Group>
                                    <Button type="submit" disabled={pinSubmitting}>
                                        {pinSubmitting ? (
                                            <>
                                                <Spinner animation="border" size="sm" className="me-2" />
                                                Saving...
                                            </>
                                        ) : (
                                            profile?.authentication?.pinSet ? 'Update PIN' : 'Set PIN'
                                        )}
                                    </Button>
                                </Form>
                            </Card.Body>
                        </Card>
                    </Col>
                    <Col xs={12}>
                        <Card className="shadow-sm">
                            <Card.Body>
                                <Card.Title as="h5">Membership</Card.Title>
                                <Row className="mt-3">
                                    <Col sm={6} className="mb-3">
                                        <div className="text-muted small">Status</div>
                                        <div>{profile.membership?.status || 'GUEST'}</div>
                                    </Col>
                                    <Col sm={6} className="mb-3">
                                        <div className="text-muted small">Loyalty points</div>
                                        <div>{profile.membership?.loyaltyPoints ?? 0}</div>
                                    </Col>
                                    <Col sm={6} className="mb-3">
                                        <div className="text-muted small">Discount balance</div>
                                        <div>
                                            {profile.membership?.discountBalanceCents
                                                ? `$${(profile.membership.discountBalanceCents / 100).toFixed(2)}`
                                                : '$0.00'}
                                        </div>
                                    </Col>
                                </Row>
                            </Card.Body>
                        </Card>
                    </Col>
                    <Col xs={12}>{renderAuthenticatorSection()}</Col>
                </Row>
            ) : null}
        </div>
    );
};

export default ProfilePage;
