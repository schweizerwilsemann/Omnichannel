const appConfig = {
    baseUrl: process.env.REACT_APP_BASE_URL || 'http://localhost:3301/api/v1',
    cryptoSecret: process.env.REACT_APP_CRYPTO_SECRET_KEY || 'changeme'
};

export default appConfig;
