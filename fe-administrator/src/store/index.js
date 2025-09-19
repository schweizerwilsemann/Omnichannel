import { configureStore } from '@reduxjs/toolkit';
import authReducer, { tokenRefreshed, clearAuthState } from './authSlice.js';
import { registerAuthHandlers } from '../api/http.js';

const store = configureStore({
    reducer: {
        auth: authReducer
    }
});

registerAuthHandlers({
    onTokenRefreshed: ({ accessToken, refreshToken }) => {
        store.dispatch(tokenRefreshed({ accessToken, refreshToken }));
    },
    onLogout: () => {
        store.dispatch(clearAuthState());
    }
});

export default store;
