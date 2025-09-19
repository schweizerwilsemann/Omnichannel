import { Spinner } from 'react-bootstrap';

const LoadingScreen = ({ message = 'Loading...' }) => (
    <div className="vh-100 d-flex flex-column align-items-center justify-content-center bg-light text-muted gap-3">
        <Spinner animation="border" />
        <span>{message}</span>
    </div>
);

export default LoadingScreen;
