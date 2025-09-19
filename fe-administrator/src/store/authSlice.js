import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import {
    login as loginApi,
    logout as logoutApi,
    acceptInvitation as acceptInvitationApi,
    requestPasswordReset as requestPasswordResetApi,
    resetPassword as resetPasswordApi
} from '../services/adminAuth.service.js';
import {
    saveSession,
    clearSession,
    loadSession
} from '../utils/storage.js';

const session = loadSession();

const initialState = {
    user: session.user,
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    status: 'idle',
    error: null,
    passwordResetStatus: 'idle',
    invitationStatus: 'idle'
};

const extractErrorMessage = (error) => {
    if (error.response?.data?.message) {
        return error.response.data.message;
    }
    return error.message || 'Something went wrong';
};

export const loginUser = createAsyncThunk('auth/login', async (payload, { rejectWithValue }) => {
    try {
        const { data } = await loginApi(payload);
        return data?.data;
    } catch (error) {
        return rejectWithValue(extractErrorMessage(error));
    }
});

export const logoutUser = createAsyncThunk('auth/logout', async (_, { getState, rejectWithValue }) => {
    try {
        const { refreshToken } = getState().auth;
        if (!refreshToken) {
            return {};
        }
        await logoutApi({ refreshToken });
        return {};
    } catch (error) {
        return rejectWithValue(extractErrorMessage(error));
    }
});

export const acceptInvitation = createAsyncThunk(
    'auth/acceptInvitation',
    async (payload, { rejectWithValue }) => {
        try {
            const { data } = await acceptInvitationApi(payload);
            return data?.data;
        } catch (error) {
            return rejectWithValue(extractErrorMessage(error));
        }
    }
);

export const requestPasswordReset = createAsyncThunk(
    'auth/requestPasswordReset',
    async (payload, { rejectWithValue }) => {
        try {
            const { data } = await requestPasswordResetApi(payload);
            return data?.data;
        } catch (error) {
            return rejectWithValue(extractErrorMessage(error));
        }
    }
);

export const resetPassword = createAsyncThunk(
    'auth/resetPassword',
    async (payload, { rejectWithValue }) => {
        try {
            const { data } = await resetPasswordApi(payload);
            return data?.data;
        } catch (error) {
            return rejectWithValue(extractErrorMessage(error));
        }
    }
);

const authSlice = createSlice({
    name: 'auth',
    initialState,
    reducers: {
        tokenRefreshed: (state, action) => {
            state.accessToken = action.payload.accessToken;
            state.refreshToken = action.payload.refreshToken;
        },
        clearAuthState: (state) => {
            state.user = null;
            state.accessToken = null;
            state.refreshToken = null;
            state.status = 'idle';
            state.error = null;
        }
    },
    extraReducers: (builder) => {
        builder
            .addCase(loginUser.pending, (state) => {
                state.status = 'loading';
                state.error = null;
            })
            .addCase(loginUser.fulfilled, (state, action) => {
                state.status = 'succeeded';
                state.error = null;
                state.user = action.payload.user;
                state.accessToken = action.payload.accessToken;
                state.refreshToken = action.payload.refreshToken;
                saveSession(action.payload);
            })
            .addCase(loginUser.rejected, (state, action) => {
                state.status = 'failed';
                state.error = action.payload || action.error.message;
            })
            .addCase(logoutUser.fulfilled, (state) => {
                state.user = null;
                state.accessToken = null;
                state.refreshToken = null;
                clearSession();
            })
            .addCase(acceptInvitation.pending, (state) => {
                state.invitationStatus = 'loading';
                state.error = null;
            })
            .addCase(acceptInvitation.fulfilled, (state) => {
                state.invitationStatus = 'succeeded';
            })
            .addCase(acceptInvitation.rejected, (state, action) => {
                state.invitationStatus = 'failed';
                state.error = action.payload || action.error.message;
            })
            .addCase(requestPasswordReset.pending, (state) => {
                state.passwordResetStatus = 'loading';
                state.error = null;
            })
            .addCase(requestPasswordReset.fulfilled, (state) => {
                state.passwordResetStatus = 'requested';
            })
            .addCase(requestPasswordReset.rejected, (state, action) => {
                state.passwordResetStatus = 'failed';
                state.error = action.payload || action.error.message;
            })
            .addCase(resetPassword.fulfilled, (state) => {
                state.passwordResetStatus = 'reset';
            });
    }
});

export const { tokenRefreshed, clearAuthState } = authSlice.actions;

export default authSlice.reducer;
