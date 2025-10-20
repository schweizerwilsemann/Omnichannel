import { useState } from 'react';
import { Alert, Button, Card, Form, Spinner } from 'react-bootstrap';
import { toast } from 'react-toastify';
import { useSession } from '../../context/SessionContext.jsx';
import { requestMembershipVerification, requestLoginChallenge, verifyLoginChallenge } from '../../services/session.js';

const REGISTER_DEFAULTS = {
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    membershipNumber: '',
    pin: '',
    confirmPin: ''
};

const AUTH_PHASE = {
    CREDENTIALS: 'credentials',
    TOTP: 'totp'
};

const LOGIN_METHODS = {
    PIN: 'PIN',
    AUTHENTICATOR: 'AUTHENTICATOR'
};

const SessionSetup = () => {
    const { session, initializeSession, updateSession, loading, error, qrSlug, tableInfo, tableLoading } = useSession();

    const [mode, setMode] = useState('authenticate');
    const [registerForm, setRegisterForm] = useState(REGISTER_DEFAULTS);
    const [registerSubmitting, setRegisterSubmitting] = useState(false);

    const [authForm, setAuthForm] = useState({ email: '', pin: '' });
    const [authMethod, setAuthMethod] = useState(LOGIN_METHODS.PIN);
    const [authPhase, setAuthPhase] = useState(AUTH_PHASE.CREDENTIALS);
    const [authSubmitting, setAuthSubmitting] = useState(false);
    const [authChallenge, setAuthChallenge] = useState(null);
    const [totpCode, setTotpCode] = useState('');

    const restaurantName = tableInfo?.restaurant?.name || session?.restaurant?.name || null;
    const tableName = tableInfo?.table?.name || session?.table?.name || qrSlug || 'Unknown';
    const baseDisabled = loading || tableLoading;
    const activeSessionToken = tableInfo?.activeSession?.sessionToken;
    const hasDifferentActiveSession = Boolean(
        activeSessionToken && (!session || activeSessionToken !== session.sessionToken)
    );

    const finalizeAuthenticatorLogin = async (challengeId, code) => {
        const response = await verifyLoginChallenge({
            qrSlug,
            challengeId,
            code
        });
        const payload = response.data?.data;
        if (!payload?.sessionToken) {
            throw new Error('Authentication succeeded but session data is missing.');
        }
        const { authenticatedWith: _method, requiresTotp: _ignored, ...sessionPayload } = payload;
        updateSession(sessionPayload);
        toast.success('Signed in. Enjoy your visit!');
    };

    const resetAuthFlow = () => {
        setAuthPhase(AUTH_PHASE.CREDENTIALS);
        setAuthChallenge(null);
        setAuthSubmitting(false);
        setTotpCode('');
    };

    const switchMode = (nextMode) => {
        if (mode === nextMode) {
            return;
        }
        setMode(nextMode);
        resetAuthFlow();
        if (nextMode === 'authenticate') {
            setRegisterForm(REGISTER_DEFAULTS);
            setRegisterSubmitting(false);
        } else {
            setAuthForm({ email: '', pin: '' });
            setAuthMethod(LOGIN_METHODS.PIN);
        }
    };

    const handleRegisterChange = (event) => {
        const { name, value } = event.target;
        setRegisterForm((prev) => ({
            ...prev,
            [name]: value
        }));
    };

    const handleRegisterSubmit = async (event) => {
        event.preventDefault();
        if (baseDisabled || registerSubmitting) {
            return;
        }

        if (!registerForm.email.trim()) {
            toast.error('Email is required to register.');
            return;
        }

        const pin = registerForm.pin.trim();
        const confirmPin = registerForm.confirmPin.trim();
        if (!/^[0-9]{4,6}$/.test(pin)) {
            toast.error('Choose a PIN with 4–6 digits.');
            return;
        }
        if (pin !== confirmPin) {
            toast.error('PIN confirmation does not match.');
            return;
        }

        setRegisterSubmitting(true);
        try {
            const sessionPayload = { ...registerForm };
            delete sessionPayload.pin;
            delete sessionPayload.confirmPin;

            const nextSession = await initializeSession(sessionPayload);
            toast.success('Session started. Let’s finish setting up your membership.');

            try {
                const response = await requestMembershipVerification({
                    sessionToken: nextSession.sessionToken,
                    customer: {
                        firstName: registerForm.firstName || null,
                        lastName: registerForm.lastName || null,
                        email: registerForm.email,
                        phoneNumber: registerForm.phoneNumber || null,
                        membershipNumber: registerForm.membershipNumber || null,
                        pin
                    }
                });
                const payload = response.data?.data;
                if (payload && payload.membershipStatus === 'MEMBER') {
                    toast.success('Your membership is active — welcome back!');
                } else {
                    updateSession({
                        membershipPending: true,
                        customer: {
                            firstName: registerForm.firstName || null,
                            lastName: registerForm.lastName || null,
                            email: registerForm.email || null,
                            phoneNumber: registerForm.phoneNumber || null
                        }
                    });
                    toast.info('Check your email to verify your membership and unlock perks.');
                }
            } catch (err) {
                const msg = err.response?.data?.message || err.message || 'We could not send the verification email just now.';
                toast.warn(msg);
            }
        } catch (err) {
            const message = err.response?.data?.message || err.message || 'Could not start session';
            toast.error(message);
        } finally {
            setRegisterSubmitting(false);
        }
    };

    const handleSkip = async () => {
        if (baseDisabled) {
            return;
        }
        try {
            await initializeSession();
            toast.success('Session ready. Browse the menu!');
        } catch (err) {
            const message = err.response?.data?.message || err.message || 'Could not start session';
            toast.error(message);
        }
    };

    const handleAuthChange = (event) => {
        const { name, value } = event.target;
        setAuthForm((prev) => ({
            ...prev,
            [name]: value
        }));
    };

    const handleAuthMethodChange = (event) => {
        const selected = event.target.value === LOGIN_METHODS.AUTHENTICATOR ? LOGIN_METHODS.AUTHENTICATOR : LOGIN_METHODS.PIN;
        setAuthMethod(selected);
        setAuthPhase(AUTH_PHASE.CREDENTIALS);
        setAuthChallenge(null);
        setAuthSubmitting(false);
        setTotpCode('');
        if (selected === LOGIN_METHODS.AUTHENTICATOR) {
            setAuthForm((prev) => ({ ...prev, pin: '' }));
        }
    };

    const handleCredentialsSubmit = async (event) => {
        event.preventDefault();
        if (baseDisabled || authSubmitting) {
            return;
        }

        if (!qrSlug) {
            toast.error('Missing QR code reference. Please rescan the table QR.');
            return;
        }

        const email = authForm.email.trim();
        if (!email) {
            toast.error('Enter the email associated with your membership.');
            return;
        }

        const method = authMethod;
        const payload = { qrSlug, email, method };

        if (method === LOGIN_METHODS.PIN) {
            const pin = authForm.pin.trim();
            if (!pin) {
                toast.error('Enter your PIN to continue.');
                return;
            }
            payload.pin = pin;
        } else {
            if (!totpCode.trim()) {
                toast.error('Enter the code from your authenticator app.');
                return;
            }
        }

        setAuthSubmitting(true);
        try {
            const response = await requestLoginChallenge(payload);
            const data = response.data?.data;

            if (method === LOGIN_METHODS.AUTHENTICATOR) {
                if (!data?.challengeId) {
                    throw new Error('Authenticator challenge is missing an identifier.');
                }
                try {
                    await finalizeAuthenticatorLogin(data.challengeId, totpCode.trim());
                    return;
                } catch (err) {
                    throw err;
                }
            }

            if (data?.requiresTotp) {
                if (!data.challengeId) {
                    throw new Error('Authentication challenge is missing an identifier.');
                }
                setAuthChallenge({
                    id: data.challengeId,
                    expiresAt: data.expiresAt || null
                });
                setAuthPhase(AUTH_PHASE.TOTP);
                setTotpCode('');
                toast.info('Enter the code from your authenticator app to finish signing in.');
            } else if (data?.sessionToken) {
                const { requiresTotp: _ignored, authenticatedWith: _method, ...sessionPayload } = data;
                updateSession(sessionPayload);
                toast.success('Signed in. Welcome back!');
            } else {
                throw new Error('Unexpected authentication response');
            }
        } catch (err) {
            const message = err.response?.data?.message || err.message || 'Unable to sign in with those credentials';
            toast.error(message);
            if (method === LOGIN_METHODS.AUTHENTICATOR) {
                setTotpCode('');
            }
        } finally {
            setAuthSubmitting(false);
        }
    };

    const handleTotpSubmit = async (event) => {
        event.preventDefault();
        if (baseDisabled || authSubmitting || !authChallenge?.id) {
            return;
        }

        const code = totpCode.trim();
        if (!code) {
            toast.error('Enter the 6-digit code to continue.');
            return;
        }

        setAuthSubmitting(true);
        try {
            await finalizeAuthenticatorLogin(authChallenge.id, code);
        } catch (err) {
            const message = err.response?.data?.message || err.message || 'Invalid authentication code';
            toast.error(message);
            setTotpCode('');
        } finally {
            setAuthSubmitting(false);
        }
    };

    const handleBackToCredentials = () => {
        if (authSubmitting) {
            return;
        }
        setAuthPhase(AUTH_PHASE.CREDENTIALS);
        setAuthChallenge(null);
        setTotpCode('');
    };

    const renderAuthForm = () => {
        return (
            <Form onSubmit={handleCredentialsSubmit} className="d-flex flex-column gap-3">
                <Form.Group controlId="authMethod">
                    <Form.Label>Sign-in method</Form.Label>
                    <div className="d-flex gap-3">
                        <Form.Check
                            type="radio"
                            id="auth-method-pin"
                            name="authMethod"
                            label="Use PIN"
                            value={LOGIN_METHODS.PIN}
                            checked={authMethod === LOGIN_METHODS.PIN}
                            onChange={handleAuthMethodChange}
                            disabled={baseDisabled || authSubmitting}
                        />
                        <Form.Check
                            type="radio"
                            id="auth-method-authenticator"
                            name="authMethod"
                            label="Authenticator app"
                            value={LOGIN_METHODS.AUTHENTICATOR}
                            checked={authMethod === LOGIN_METHODS.AUTHENTICATOR}
                            onChange={handleAuthMethodChange}
                            disabled={baseDisabled || authSubmitting}
                        />
                    </div>
                </Form.Group>
                <Form.Group controlId="authEmail">
                    <Form.Label>Email</Form.Label>
                    <Form.Control
                        type="email"
                        name="email"
                        value={authForm.email}
                        placeholder="you@example.com"
                        onChange={handleAuthChange}
                        disabled={baseDisabled || authSubmitting}
                    />
                </Form.Group>
                {authMethod === LOGIN_METHODS.PIN ? (
                    <Form.Group controlId="authPin">
                        <Form.Label>PIN</Form.Label>
                        <Form.Control
                            type="password"
                            name="pin"
                            value={authForm.pin}
                            placeholder="4–6 digit PIN"
                            inputMode="numeric"
                            onChange={handleAuthChange}
                            disabled={baseDisabled || authSubmitting}
                        />
                        <Form.Text muted>Your PIN keeps your orders secure.</Form.Text>
                    </Form.Group>
                ) : (
                    <Form.Group controlId="authenticatorInline">
                        <Form.Label>Authenticator code</Form.Label>
                        <Form.Control
                            type="text"
                            inputMode="numeric"
                            value={totpCode}
                            onChange={(event) => setTotpCode(event.target.value)}
                            placeholder="123456"
                            disabled={baseDisabled || authSubmitting}
                        />
                        <Form.Text muted>Open your authenticator app to retrieve the 6-digit code.</Form.Text>
                    </Form.Group>
                )}
                <Button type="submit" disabled={baseDisabled || authSubmitting}>
                    {authSubmitting ? (
                        <>
                            <Spinner animation="border" size="sm" className="me-2" />
                            Signing in...
                        </>
                    ) : (
                        'Continue'
                    )}
                </Button>
            </Form>
        );
    };

    const renderTotpForm = () => {
        const description =
            authMethod === LOGIN_METHODS.AUTHENTICATOR
                ? 'Enter the 6-digit code from your authenticator app.'
                : 'You have an authenticator app enabled. Enter its code to finish signing in.';

        return (
            <Form onSubmit={handleTotpSubmit} className="d-flex flex-column gap-3">
                <p className="text-muted mb-2 small">{description}</p>
                <Form.Group controlId="authTotpCode">
                    <Form.Label>Authenticator code</Form.Label>
                    <Form.Control
                        type="text"
                        inputMode="numeric"
                        value={totpCode}
                        onChange={(event) => setTotpCode(event.target.value)}
                        placeholder="123456"
                        disabled={baseDisabled || authSubmitting}
                    />
                </Form.Group>
                <div className="d-flex flex-column gap-2">
                    <Button type="submit" disabled={baseDisabled || authSubmitting}>
                        {authSubmitting ? (
                            <>
                                <Spinner animation="border" size="sm" className="me-2" />
                                Verifying...
                            </>
                        ) : (
                            'Verify & continue'
                        )}
                    </Button>
                    <div className="d-flex justify-content-between">
                        <Button
                            variant="link"
                            type="button"
                            className="px-0"
                            onClick={handleBackToCredentials}
                            disabled={authSubmitting}
                        >
                            Back to sign-in
                        </Button>
                    </div>
                </div>
            </Form>
        );
    };

    const renderRegisterForm = () => (
        <Form onSubmit={handleRegisterSubmit} className="d-flex flex-column gap-3">
            <Form.Group controlId="registerFirstName">
                <Form.Label>First name</Form.Label>
                <Form.Control
                    type="text"
                    name="firstName"
                    value={registerForm.firstName}
                    placeholder="Optional"
                    onChange={handleRegisterChange}
                    disabled={baseDisabled || registerSubmitting}
                />
            </Form.Group>
            <Form.Group controlId="registerLastName">
                <Form.Label>Last name</Form.Label>
                <Form.Control
                    type="text"
                    name="lastName"
                    value={registerForm.lastName}
                    placeholder="Optional"
                    onChange={handleRegisterChange}
                    disabled={baseDisabled || registerSubmitting}
                />
            </Form.Group>
            <Form.Group controlId="registerEmail">
                <Form.Label>Email</Form.Label>
                <Form.Control
                    type="email"
                    name="email"
                    value={registerForm.email}
                    placeholder="you@example.com"
                    onChange={handleRegisterChange}
                    disabled={baseDisabled || registerSubmitting}
                    required
                />
            </Form.Group>
            <Form.Group controlId="registerPhone">
                <Form.Label>Phone number</Form.Label>
                <Form.Control
                    type="tel"
                    name="phoneNumber"
                    value={registerForm.phoneNumber}
                    placeholder="Optional"
                    onChange={handleRegisterChange}
                    disabled={baseDisabled || registerSubmitting}
                />
            </Form.Group>
            <Form.Group controlId="registerMembershipNumber">
                <Form.Label>Membership number</Form.Label>
                <Form.Control
                    type="text"
                    name="membershipNumber"
                    value={registerForm.membershipNumber}
                    placeholder="If you already have one"
                    onChange={handleRegisterChange}
                    disabled={baseDisabled || registerSubmitting}
                />
            </Form.Group>
            <Form.Group controlId="registerPin">
                <Form.Label>Create a PIN</Form.Label>
                <Form.Control
                    type="password"
                    name="pin"
                    value={registerForm.pin}
                    placeholder="4–6 digit PIN"
                    inputMode="numeric"
                    onChange={handleRegisterChange}
                    disabled={baseDisabled || registerSubmitting}
                    required
                />
                <Form.Text muted>Use this PIN the next time you sign in.</Form.Text>
            </Form.Group>
            <Form.Group controlId="registerConfirmPin">
                <Form.Label>Confirm PIN</Form.Label>
                <Form.Control
                    type="password"
                    name="confirmPin"
                    value={registerForm.confirmPin}
                    placeholder="Re-enter PIN"
                    inputMode="numeric"
                    onChange={handleRegisterChange}
                    disabled={baseDisabled || registerSubmitting}
                    required
                />
            </Form.Group>
            <div className="text-muted small">
                We’ll send a verification email. You can still order while your membership is pending.
            </div>
            <Button type="submit" disabled={baseDisabled || registerSubmitting}>
                {registerSubmitting || loading ? (
                    <>
                        <Spinner animation="border" size="sm" className="me-2" />
                        Creating session...
                    </>
                ) : (
                    'Register & start ordering'
                )}
            </Button>
            <Button
                variant="outline-secondary"
                type="button"
                onClick={handleSkip}
                disabled={baseDisabled || registerSubmitting}
            >
                Skip and continue as guest
            </Button>
        </Form>
    );

    return (
        <div className="vh-100 d-flex align-items-center justify-content-center bg-light p-3">
            <Card className="w-100" style={{ maxWidth: 480 }}>
                <Card.Body className="d-flex flex-column gap-3">
                    <div>
                        <h2 className="mb-1">Welcome{restaurantName ? ` to ${restaurantName}` : ''}</h2>
                        <p className="text-muted mb-0">
                            {tableLoading
                                ? 'Checking your table details...'
                                : `You are checking in for table ${tableName}.`}
                        </p>
                    </div>
                    {hasDifferentActiveSession && (
                        <Alert variant="warning" className="mb-0">
                            This table already has an active order open. Let the staff know if it should be cleared before
                            you continue.
                        </Alert>
                    )}
                    <div className="d-flex gap-2">
                        <Button
                            size="sm"
                            variant={mode === 'authenticate' ? 'primary' : 'outline-primary'}
                            onClick={() => switchMode('authenticate')}
                        >
                            I have an account
                        </Button>
                        <Button
                            size="sm"
                            variant={mode === 'register' ? 'primary' : 'outline-primary'}
                            onClick={() => switchMode('register')}
                        >
                            Register membership
                        </Button>
                    </div>
                    {mode === 'authenticate'
                        ? authPhase === AUTH_PHASE.TOTP
                            ? renderTotpForm()
                            : renderAuthForm()
                        : renderRegisterForm()}
                    {error && <Alert variant="danger" className="mb-0 text-center">{error}</Alert>}
                </Card.Body>
            </Card>
        </div>
    );
};

export default SessionSetup;
