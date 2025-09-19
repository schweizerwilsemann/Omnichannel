import { Navbar, Container, Nav, Button } from 'react-bootstrap';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, Link } from 'react-router-dom';
import { logoutUser } from '../../store/authSlice.js';

const MainLayout = ({ children }) => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { user } = useSelector((state) => state.auth);

    const handleLogout = async () => {
        await dispatch(logoutUser());
        navigate('/login');
    };

    return (
        <>
            <Navbar bg="white" className="shadow-sm" expand="lg">
                <Container>
                    <Navbar.Brand as={Link} to="/dashboard">
                        Omnichannel Admin
                    </Navbar.Brand>
                    <Navbar.Toggle aria-controls="navbar" />
                    <Navbar.Collapse id="navbar">
                        <Nav className="me-auto">
                            <Nav.Link as={Link} to="/dashboard">
                                Dashboard
                            </Nav.Link>
                            <Nav.Link as={Link} to="/orders">
                                Orders
                            </Nav.Link>
                            <Nav.Link as={Link} to="/assets">
                                Assets
                            </Nav.Link>
                        </Nav>
                        <Nav>
                            <Navbar.Text className="me-3">
                                {user ? `${user.firstName} ${user.lastName}` : 'Guest'}
                            </Navbar.Text>
                            <Button variant="outline-primary" onClick={handleLogout}>
                                Logout
                            </Button>
                        </Nav>
                    </Navbar.Collapse>
                </Container>
            </Navbar>
            <Container className="py-4">{children}</Container>
        </>
    );
};

export default MainLayout;
