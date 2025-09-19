import { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import InvitationAcceptForm from '../components/forms/InvitationAcceptForm.jsx';
import { acceptInvitation } from '../store/authSlice.js';

const InvitationAcceptPage = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const { invitationStatus } = useSelector((state) => state.auth);

    const initialValues = {
        tokenIdentifier: params.get('tokenIdentifier') || '',
        token: params.get('token') || '',
        password: '',
        phoneNumber: ''
    };

    const handleSubmit = useCallback(
        async (values) => {
            const result = await dispatch(acceptInvitation(values));
            if (acceptInvitation.fulfilled.match(result)) {
                toast.success('Invitation accepted. You can now log in.');
                navigate('/login');
            } else {
                toast.error(result.payload || result.error.message);
            }
        },
        [dispatch, navigate]
    );

    return (
        <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '100vh' }}>
            <div style={{ width: '100%', maxWidth: '480px' }}>
                <InvitationAcceptForm
                    initialValues={initialValues}
                    onSubmit={handleSubmit}
                    isLoading={invitationStatus === 'loading'}
                />
            </div>
        </div>
    );
};

export default InvitationAcceptPage;
