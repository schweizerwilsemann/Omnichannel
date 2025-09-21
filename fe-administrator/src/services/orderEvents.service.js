import appConfig from '../config/appConfig.js';

export const createOrderStream = (token) => {
    if (!token) {
        throw new Error('Access token is required to create order stream');
    }

    const url = new URL(`${appConfig.baseUrl}/orders/stream`);
    url.searchParams.set('token', token);

    return new EventSource(url.toString());
};
