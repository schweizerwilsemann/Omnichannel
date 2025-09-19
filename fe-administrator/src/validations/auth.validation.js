import * as Yup from 'yup';

export const loginValidationSchema = Yup.object({
    email: Yup.string().email('Invalid email').required('Email is required'),
    password: Yup.string().min(8, 'Use at least 8 characters').required('Password is required')
});

export const invitationAcceptSchema = Yup.object({
    tokenIdentifier: Yup.string().required('Invitation identifier required'),
    token: Yup.string().required('Invitation token required'),
    password: Yup.string().min(8, 'Use at least 8 characters').required('Password is required'),
    phoneNumber: Yup.string().optional()
});

export const passwordResetRequestSchema = Yup.object({
    email: Yup.string().email('Invalid email').required('Email is required')
});

export const passwordResetSchema = Yup.object({
    resetId: Yup.string().required('Reset identifier required'),
    token: Yup.string().required('Reset token required'),
    password: Yup.string().min(8, 'Use at least 8 characters').required('Password is required')
});
