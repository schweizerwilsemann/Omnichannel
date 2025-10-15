import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Spinner, Button } from 'react-bootstrap';
import { toast } from 'react-toastify';
import { verifyMembershipToken, fetchMenu } from '../services/session.js';
import { useSession } from '../context/SessionContext.jsx';

const VerifyEmailPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { session, updateSession } = useSession();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const verificationId = params.get('verificationId');
        const token = params.get('token');
        if (!verificationId || !token) {
            setError('Invalid verification link');
            setLoading(false);
            return;
        }

        const run = async () => {
            try {
                setLoading(true);
                const res = await verifyMembershipToken({ verificationId, token });
                const payload = res.data?.data;
                if (payload && payload.membershipStatus === 'MEMBER') {
                    toast.success('Membership verified — welcome!');
                    // Clear any pending flag
                    updateSession({ membershipPending: false });
                    // If we have the session token in this tab, refresh the menu/session so UI updates
                    if (session?.sessionToken) {
                        try {
                            const menuRes = await fetchMenu(session.sessionToken);
                            const menuPayload = menuRes.data?.data;
                            if (menuPayload && menuPayload.session) {
                                const membership = menuPayload.session.membership || null;
                                const membershipStatus = menuPayload.session.membershipStatus || (membership && membership.status) || null;
                                updateSession({ membership, membershipStatus });
                                if (membershipStatus === 'MEMBER') {
                                    updateSession({ membershipPending: false });
                                }
                            }
                        } catch (e) {
                            // ignore refresh errors — user can manually refresh later
                        }
                    }
                    // Navigate to root so user sees menu
                    navigate('/');
                } else {
                    toast.success('Membership verified');
                    updateSession({ membershipPending: false });
                    navigate('/');
                }
            } catch (err) {
                const msg = err.response?.data?.message || err.message || 'Unable to verify membership';
                setError(msg);
                toast.error(msg);
            } finally {
                setLoading(false);
            }
        };

        run();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className="d-flex align-items-center justify-content-center" style={{ minHeight: '60vh' }}>
            <div className="card p-4" style={{ maxWidth: 640, width: '100%' }}>
                <h3 className="h5 mb-3">Verifying your membership…</h3>
                {loading ? (
                    <div className="d-flex align-items-center gap-2">
                        <Spinner animation="border" size="sm" />
                        <span>Verifying — please wait</span>
                    </div>
                ) : error ? (
                    <>
                        <p className="text-danger">{error}</p>
                        <Button onClick={() => navigate('/')}>Back to menu</Button>
                    </>
                ) : (
                    <>
                        <p className="text-muted">Verification complete. Redirecting…</p>
                    </>
                )}
            </div>
        </div>
    );
};

export default VerifyEmailPage;
