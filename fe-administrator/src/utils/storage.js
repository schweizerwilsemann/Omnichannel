const ACCESS_TOKEN_KEY = 'omnichannel_access_token';
const REFRESH_TOKEN_KEY = 'omnichannel_refresh_token';
const USER_KEY = 'omnichannel_user';

export const saveSession = ({ accessToken, refreshToken, user }) => {
    if (accessToken) {
        localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    }
    if (refreshToken) {
        localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    }
    if (user) {
        localStorage.setItem(USER_KEY, JSON.stringify(user));
    }
};

export const loadSession = () => {
    const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY) || null;
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY) || null;
    const userRaw = localStorage.getItem(USER_KEY);

    return {
        accessToken,
        refreshToken,
        user: userRaw ? JSON.parse(userRaw) : null
    };
};

export const clearSession = () => {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
};

export const updateAccessToken = (accessToken) => {
    if (accessToken) {
        localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    }
};

export const updateRefreshToken = (refreshToken) => {
    if (refreshToken) {
        localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    }
};
