import { Navbar, Container, Badge } from 'react-bootstrap';
import { useSession } from '../../context/SessionContext.jsx';

const HeaderBar = () => {
    const { session } = useSession();

    if (!session) {
        return null;
    }

    const membershipStatus = session.membership?.status || session.membershipStatus;

    return (
        <Navbar bg="dark" variant="dark" className="shadow-sm">
            <Container className="justify-content-between">
                <div className="d-flex flex-column">
                    <span className="fw-semibold">{session.restaurant?.name || 'Omnichannel'}</span>
                    <span className="text-muted small">Table {session.table?.name || 'N/A'}</span>
                </div>
                <Badge bg={membershipStatus === 'MEMBER' ? 'success' : 'secondary'}>
                    {membershipStatus === 'MEMBER' ? 'Member' : 'Guest'}
                </Badge>
            </Container>
        </Navbar>
    );
};

export default HeaderBar;
