import { useState } from 'react';
import { Alert, Button, Card, Form, Spinner } from 'react-bootstrap';
import { toast } from 'react-toastify';
import { useSession } from '../../context/SessionContext.jsx';
import { requestMembershipVerification } from '../../services/session.js';

const defaultForm = {
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    membershipNumber: '',
    joinLoyalty: false,
    isMember: false
};

const SessionSetup = () => {
    const { session, initializeSession, updateSession, loading, error, qrSlug, tableInfo, tableLoading } = useSession();
    const [form, setForm] = useState(defaultForm);

    const restaurantName = tableInfo?.restaurant?.name || session?.restaurant?.name || null;
    const tableName = tableInfo?.table?.name || session?.table?.name || qrSlug || 'Unknown';
    const disableInputs = loading || tableLoading;
    const activeSessionToken = tableInfo?.activeSession?.sessionToken;
    const hasDifferentActiveSession = Boolean(
        activeSessionToken && (!session || activeSessionToken !== session.sessionToken)
    );

    const handleChange = (event) => {
        const { name, value, type, checked } = event.target;
        setForm((prev) => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (disableInputs) {
            return;
        }
        // If user requested to join loyalty we require an email to send verification
        if (form.joinLoyalty && !form.email) {
            toast.error('Email is required to join the loyalty program.');
            return;
        }
        try {
            // If user wants to join loyalty, avoid passing the joinLoyalty flag to initializeSession
            // because backend currently treats joinLoyalty during startSession as an immediate MEMBER.
            // Instead: create the session first (without joinLoyalty) and then request membership verification.
            const initPayload = { ...form };
            if (form.joinLoyalty) {
                // remove joinLoyalty & isMember so the backend doesn't auto-upgrade the membership
                delete initPayload.joinLoyalty;
                delete initPayload.isMember;
            }

            const nextSession = await initializeSession(Object.keys(initPayload).length ? initPayload : undefined);
            toast.success('Session started. Enjoy your meal!');

            // If the user asked to join loyalty, trigger verification email after session is created
            if (form.joinLoyalty) {
                try {
                    const resp = await requestMembershipVerification({
                        sessionToken: nextSession.sessionToken,
                        customer: {
                            firstName: form.firstName || null,
                            lastName: form.lastName || null,
                            email: form.email,
                            phoneNumber: form.phoneNumber || null
                        }
                    });
                    const payload = resp.data?.data;
                    if (payload && payload.membershipStatus === 'MEMBER') {
                        toast.success('Your membership is active — welcome back!');
                    } else {
                        // mark session locally as pending verification so UI blocks ordering
                        updateSession({ membershipPending: true });
                        toast.info('Check your email to verify your membership');
                    }
                } catch (err) {
                    // don't block session start if email sending fails — log and notify
                    const msg = err.response?.data?.message || err.message || 'Failed to request membership verification';
                    toast.warn(msg);
                }
            }
        } catch (err) {
            const message = err.response?.data?.message || err.message || 'Could not start session';
            toast.error(message);
        }
    };

    const handleSkip = async () => {
        if (disableInputs) {
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

    return (
        <div className="vh-100 d-flex align-items-center justify-content-center bg-light p-3">
            <Card className="w-100" style={{ maxWidth: 420 }}>
                <Card.Body className="d-flex flex-column gap-3">
                    <div>
                        <h2 className="mb-1">
                            Welcome{restaurantName ? ` to ${restaurantName}` : ''}
                        </h2>
                        <p className="text-muted mb-0">
                            {tableLoading
                                ? 'Checking your table details...'
                                : `You are checking in for table ${tableName}.`}
                        </p>
                    </div>
                    {hasDifferentActiveSession && (
                        <Alert variant="warning" className="mb-0">
                            This table already has an active order open. Let the staff know if this should be cleared
                            before you continue.
                        </Alert>
                    )}
                    <Form onSubmit={handleSubmit} className="d-flex flex-column gap-3">
                        <Form.Group controlId="firstName">
                            <Form.Label>First name</Form.Label>
                            <Form.Control
                                type="text"
                                name="firstName"
                                value={form.firstName}
                                placeholder="Optional"
                                onChange={handleChange}
                                disabled={disableInputs}
                            />
                        </Form.Group>
                        <Form.Group controlId="lastName">
                            <Form.Label>Last name</Form.Label>
                            <Form.Control
                                type="text"
                                name="lastName"
                                value={form.lastName}
                                placeholder="Optional"
                                onChange={handleChange}
                                disabled={disableInputs}
                            />
                        </Form.Group>
                        <Form.Group controlId="email">
                            <Form.Label>Email</Form.Label>
                            <Form.Control
                                type="email"
                                name="email"
                                value={form.email}
                                placeholder="Optional"
                                onChange={handleChange}
                                disabled={disableInputs}
                            />
                        </Form.Group>
                        <Form.Group controlId="phoneNumber">
                            <Form.Label>Phone number</Form.Label>
                            <Form.Control
                                type="tel"
                                name="phoneNumber"
                                value={form.phoneNumber}
                                placeholder="Optional"
                                onChange={handleChange}
                                disabled={disableInputs}
                            />
                        </Form.Group>
                        <Form.Group controlId="membershipNumber">
                            <Form.Label>Membership number</Form.Label>
                            <Form.Control
                                type="text"
                                name="membershipNumber"
                                value={form.membershipNumber}
                                placeholder="Enter if you have one"
                                onChange={handleChange}
                                disabled={disableInputs}
                            />
                        </Form.Group>
                        <Form.Check
                            type="checkbox"
                            id="joinLoyalty"
                            name="joinLoyalty"
                            checked={form.joinLoyalty}
                            label="Join the restaurant loyalty program"
                            onChange={handleChange}
                            disabled={disableInputs}
                        />
                        <Form.Check
                            type="checkbox"
                            id="isMember"
                            name="isMember"
                            checked={form.isMember}
                            label="I am already a member here"
                            onChange={handleChange}
                            disabled={disableInputs}
                        />
                        <Button type="submit" disabled={disableInputs} className="w-100">
                            {loading ? (
                                <>
                                    <Spinner animation="border" size="sm" className="me-2" />
                                    Starting session...
                                </>
                            ) : (
                                'Start ordering'
                            )}
                        </Button>
                        <Button
                            variant="outline-secondary"
                            type="button"
                            disabled={disableInputs}
                            onClick={handleSkip}
                            className="w-100"
                        >
                            Skip and continue
                        </Button>
                    </Form>
                    {error && <Alert variant="danger" className="mb-0 text-center">{error}</Alert>}
                </Card.Body>
            </Card>
        </div>
    );
};

export default SessionSetup;
