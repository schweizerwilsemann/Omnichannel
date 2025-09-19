import { useState } from 'react';
import { Button, Card, Form, Spinner } from 'react-bootstrap';
import { toast } from 'react-toastify';
import { useSession } from '../../context/SessionContext.jsx';

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
    const { initializeSession, loading, error, qrSlug } = useSession();
    const [form, setForm] = useState(defaultForm);

    const handleChange = (event) => {
        const { name, value, type, checked } = event.target;
        setForm((prev) => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        try {
            await initializeSession(form);
            toast.success('Session started. Enjoy your meal!');
        } catch (err) {
            const message = err.response?.data?.message || err.message || 'Could not start session';
            toast.error(message);
        }
    };

    const handleSkip = async () => {
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
                        <h2 className="mb-1">Welcome</h2>
                        <p className="text-muted mb-0">Scan confirmed for table: <strong>{qrSlug || 'Unknown'}</strong></p>
                    </div>
                    <Form onSubmit={handleSubmit} className="d-flex flex-column gap-3">
                        <Form.Group controlId="firstName">
                            <Form.Label>First name</Form.Label>
                            <Form.Control
                                type="text"
                                name="firstName"
                                value={form.firstName}
                                placeholder="Optional"
                                onChange={handleChange}
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
                            />
                        </Form.Group>
                        <Form.Check
                            type="checkbox"
                            id="joinLoyalty"
                            name="joinLoyalty"
                            checked={form.joinLoyalty}
                            label="Join the restaurant loyalty program"
                            onChange={handleChange}
                        />
                        <Form.Check
                            type="checkbox"
                            id="isMember"
                            name="isMember"
                            checked={form.isMember}
                            label="I am already a member here"
                            onChange={handleChange}
                        />
                        <Button type="submit" disabled={loading} className="w-100">
                            {loading ? (
                                <>
                                    <Spinner animation="border" size="sm" className="me-2" />
                                    Starting session...
                                </>
                            ) : (
                                'Start ordering'
                            )}
                        </Button>
                        <Button variant="outline-secondary" type="button" disabled={loading} onClick={handleSkip} className="w-100">
                            Skip and continue
                        </Button>
                    </Form>
                    {error && <div className="text-danger small text-center">{error}</div>}
                </Card.Body>
            </Card>
        </div>
    );
};

export default SessionSetup;
