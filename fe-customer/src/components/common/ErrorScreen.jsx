import { Button } from 'react-bootstrap';

const ErrorScreen = ({ title = 'Something went wrong', message, onRetry, retryLabel = 'Try again' }) => (
    <div className="vh-100 d-flex flex-column align-items-center justify-content-center bg-light text-center gap-3 p-3">
        <div>
            <h2 className="mb-2">{title}</h2>
            <p className="text-muted mb-0">{message || 'Please try again.'}</p>
        </div>
        {onRetry && (
            <Button onClick={onRetry}>{retryLabel}</Button>
        )}
    </div>
);

export default ErrorScreen;
