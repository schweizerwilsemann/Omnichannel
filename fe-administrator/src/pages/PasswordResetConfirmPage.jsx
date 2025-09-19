import { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import PasswordResetForm from '../components/forms/PasswordResetForm.jsx';
import { resetPassword } from '../store/authSlice.js';

const PasswordResetConfirmPage = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const { passwordResetStatus } = useSelector((state) => state.auth);

    const initialValues = {
        resetId: params.get('resetId') || '',
        token: params.get('token') || '',
        password: ''
    };

    const handleSubmit = useCallback(
        async (values) => {
            const result = await dispatch(resetPassword(values));
            if (resetPassword.fulfilled.match(result)) {
                toast.success('Password updated. Please sign in.');
                navigate('/login');
            } else {
                toast.error(result.payload || result.error.message);
            }
        },
        [dispatch, navigate]
    );

    return (
        <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '100vh' }}>
            <div style={{ width: '100%', maxWidth: '420px' }}>
                <PasswordResetForm
                    initialValues={initialValues}
                    onSubmit={handleSubmit}
                    isLoading={passwordResetStatus === 'loading'}
                />
            </div>
        </div>
    );
};

export default PasswordResetConfirmPage;
