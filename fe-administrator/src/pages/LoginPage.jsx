import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import LoginForm from '../components/forms/LoginForm.jsx';
import { loginUser } from '../store/authSlice.js';

const LoginPage = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const location = useLocation();
    const { accessToken, status, error } = useSelector((state) => state.auth);

    useEffect(() => {
        if (accessToken) {
            const from = location.state?.from?.pathname || '/dashboard';
            navigate(from, { replace: true });
        }
    }, [accessToken, location.state, navigate]);

    useEffect(() => {
        if (status === 'failed' && error) {
            toast.error(error);
        }
    }, [status, error]);

    const handleSubmit = async (values) => {
        await dispatch(loginUser(values));
    };

    return (
        <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '100vh' }}>
            <div style={{ width: '100%', maxWidth: '420px' }}>
                <LoginForm onSubmit={handleSubmit} isLoading={status === 'loading'} />
            </div>
        </div>
    );
};

export default LoginPage;
