import { useState } from 'react';
import { Button, Spinner } from 'react-bootstrap';
import { toast } from 'react-toastify';
import { useSession } from '../context/SessionContext.jsx';
import { fetchMenu } from '../services/session.js';

const VerifyPendingPage = () => {
    const { session, updateSession } = useSession();
    const [refreshing, setRefreshing] = useState(false);

    const handleRefresh = async () => {
        if (!session?.sessionToken) {
            toast.error('Session expired. Please refresh the page.');
            return;
        }
        setRefreshing(true);
        try {
            const res = await fetchMenu(session.sessionToken);
            const payload = res.data?.data;
            if (payload && payload.session) {
                // update membership info and clear pending if now MEMBER
                updateSession({ membership: payload.session.membership || null });
                if (payload.session.membership && payload.session.membership.loyaltyPoints !== undefined) {
                    // clear pending if membership now present
                    if (payload.session.membership && payload.session.membership.status === 'MEMBER') {
                        updateSession({ membershipPending: false });
                        toast.success('Membership verified — you can now place orders');
                    }
                }
            }
        } catch (err) {
            toast.error('Unable to refresh session. Try again in a moment.');
        } finally {
            setRefreshing(false);
        }
    };

    return (
        <div className="verify-pending d-flex align-items-center justify-content-center" style={{ minHeight: '60vh' }}>
            <div className="card p-4" style={{ maxWidth: 540, width: '100%' }}>
                <h2 className="h5 mb-3">Check your inbox to verify your email</h2>
                <p className="text-muted mb-3">We have sent a verification link to the email you provided. Click the link in your inbox to confirm your membership before ordering.</p>
                <p className="text-muted mb-0">If you have already clicked the link, press the button below to refresh your session.</p>
                <div className="mt-4 d-flex gap-2">
                    <Button variant="outline-secondary" onClick={handleRefresh} disabled={refreshing}>
                        {refreshing ? (
                            <>
                                <Spinner animation="border" size="sm" className="me-2" />
                                Refreshing...
                            </>
                        ) : (
                            'I have verified — refresh'
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default VerifyPendingPage;
