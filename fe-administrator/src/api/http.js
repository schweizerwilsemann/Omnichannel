import axios from 'axios';
import appConfig from '../config/appConfig.js';
import {
    loadSession,
    updateAccessToken,
    updateRefreshToken,
    clearSession
} from '../utils/storage.js';

const api = axios.create({
    baseURL: appConfig.baseUrl,
    timeout: 15000
});

let refreshInFlight = null;
let handlers = {
    onTokenRefreshed: () => {},
    onLogout: () => {}
};

export const registerAuthHandlers = ({ onTokenRefreshed, onLogout }) => {
    handlers.onTokenRefreshed = onTokenRefreshed || handlers.onTokenRefreshed;
    handlers.onLogout = onLogout || handlers.onLogout;
};

api.interceptors.request.use((config) => {
    const session = loadSession();
    if (session.accessToken) {
        config.headers.Authorization = `Bearer ${session.accessToken}`;
    }
    return config;
});

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        if (!originalRequest || originalRequest._retry) {
            return Promise.reject(error);
        }

        if (error.response?.status !== 401) {
            return Promise.reject(error);
        }

        originalRequest._retry = true;

        if (!refreshInFlight) {
            const session = loadSession();
            if (!session.refreshToken) {
                clearSession();
                handlers.onLogout();
                return Promise.reject(error);
            }

            refreshInFlight = axios
                .post(`${appConfig.baseUrl}/admin/auth/refresh`, {
                    refreshToken: session.refreshToken
                })
                .then((response) => {
                    const { accessToken, refreshToken } = response.data?.data || {};
                    if (!accessToken || !refreshToken) {
                        throw new Error('Invalid refresh response');
                    }

                    updateAccessToken(accessToken);
                    updateRefreshToken(refreshToken);
                    handlers.onTokenRefreshed({ accessToken, refreshToken });
                    return accessToken;
                })
                .catch((refreshError) => {
                    clearSession();
                    handlers.onLogout();
                    throw refreshError;
                })
                .finally(() => {
                    refreshInFlight = null;
                });
        }

        try {
            const newAccessToken = await refreshInFlight;
            originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
            return api(originalRequest);
        } catch (refreshError) {
            return Promise.reject(refreshError);
        }
    }
);

export default api;
