import { useState } from 'react';
import { Navbar, Container, Badge, Button } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useSession } from '../../context/SessionContext.jsx';
import { closeSession as closeSessionApi } from '../../services/session.js';

const HeaderBar = () => {
    const navigate = useNavigate();
    const { session, clearSession } = useSession();
    const [endingSession, setEndingSession] = useState(false);

    if (!session) {
        return null;
    }

    const membershipStatus = session.membership?.status || session.membershipStatus;

    const handleEndSession = async () => {
        if (endingSession) {
            return;
        }

        setEndingSession(true);
        let apiSuccess = true;

        try {
            if (session.sessionToken) {
                await closeSessionApi({ sessionToken: session.sessionToken });
            }
        } catch (error) {
            apiSuccess = false;
            const message = error.response?.data?.message || error.message || 'Unable to end session';
            toast.warn(message);
        } finally {
            clearSession();
            if (apiSuccess) {
                toast.info('Session ended. Thank you!');
            }
            setEndingSession(false);
            navigate('/');
        }
    };

    return (
        <Navbar bg="dark" variant="dark" className="shadow-sm">
            <Container className="d-flex justify-content-between align-items-center">
                <div className="d-flex flex-column">
                    <span className="fw-semibold text-white">{session.restaurant?.name || 'Omnichannel'}</span>
                    <span className="small text-white">{session.table?.name || 'N/A'}</span>
                </div>
                <div className="d-flex align-items-center gap-2">
                    <Badge bg={membershipStatus === 'MEMBER' ? 'success' : 'secondary'}>
                        {membershipStatus === 'MEMBER' ? 'Member' : 'Guest'}
                    </Badge>
                    <Button
                        variant="outline-light"
                        size="sm"
                        onClick={handleEndSession}
                        disabled={endingSession}
                    >
                        End session
                    </Button>
                </div>
            </Container>
        </Navbar>
    );
};

export default HeaderBar;
