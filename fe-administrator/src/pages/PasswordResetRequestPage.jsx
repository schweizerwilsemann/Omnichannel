import { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import PasswordResetRequestForm from '../components/forms/PasswordResetRequestForm.jsx';
import { requestPasswordReset } from '../store/authSlice.js';

const PasswordResetRequestPage = () => {
    const dispatch = useDispatch();
    const { passwordResetStatus } = useSelector((state) => state.auth);

    const handleSubmit = useCallback(
        async (values, { resetForm }) => {
            const result = await dispatch(requestPasswordReset(values));
            if (requestPasswordReset.fulfilled.match(result)) {
                toast.info('If the email exists a reset link has been sent.');
                resetForm();
            } else {
                toast.error(result.payload || result.error.message);
            }
        },
        [dispatch]
    );

    return (
        <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '100vh' }}>
            <div style={{ width: '100%', maxWidth: '420px' }}>
                <PasswordResetRequestForm
                    onSubmit={handleSubmit}
                    isLoading={passwordResetStatus === 'loading'}
                />
            </div>
        </div>
    );
};

export default PasswordResetRequestPage;
