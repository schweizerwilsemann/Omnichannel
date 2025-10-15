import logger from '../../config/logger.js';

const HEARTBEAT_INTERVAL_MS = 15000;
const restaurantRegistry = new Map();
const sessionRegistry = new Map();

const writeFrame = (res, event, payload) => {
    try {
        res.write('event: ' + event + '\n');
        res.write('data: ' + JSON.stringify(payload) + '\n\n');
    } catch (error) {
        logger.debug('Failed to write SSE frame', { message: error.message });
        throw error;
    }
};

const removeClientFromBucket = (bucket, client) => {
    if (!bucket) {
        return;
    }
    bucket.delete(client);
};

const teardownClient = (client) => {
    if (client.heartbeat) {
        clearInterval(client.heartbeat);
    }

    (client.restaurants || []).forEach((restaurantId) => {
        const bucket = restaurantRegistry.get(restaurantId);
        removeClientFromBucket(bucket, client);
        if (bucket && bucket.size === 0) {
            restaurantRegistry.delete(restaurantId);
        }
    });

    (client.sessions || []).forEach((sessionToken) => {
        const bucket = sessionRegistry.get(sessionToken);
        removeClientFromBucket(bucket, client);
        if (bucket && bucket.size === 0) {
            sessionRegistry.delete(sessionToken);
        }
    });
};

const createClient = ({ res, restaurants = [], sessions = [] }) => {
    const uniqueRestaurants = Array.from(new Set(restaurants.filter(Boolean)));
    const uniqueSessions = Array.from(new Set(sessions.filter(Boolean)));

    const client = {
        res,
        restaurants: uniqueRestaurants,
        sessions: uniqueSessions,
        heartbeat: setInterval(() => {
            writeFrame(res, 'heartbeat', { ts: new Date().toISOString() });
        }, HEARTBEAT_INTERVAL_MS)
    };

    res.on('close', () => {
        teardownClient(client);
    });

    return client;
};

export const registerOrderStream = ({ restaurants, res }) => {
    const client = createClient({ res, restaurants });

    client.restaurants.forEach((restaurantId) => {
        if (!restaurantRegistry.has(restaurantId)) {
            restaurantRegistry.set(restaurantId, new Set());
        }
        restaurantRegistry.get(restaurantId).add(client);
    });

    writeFrame(res, 'connected', { restaurants: client.restaurants });
};

export const registerCustomerOrderStream = ({ sessionToken, res }) => {
    const client = createClient({ res, sessions: [sessionToken] });

    client.sessions.forEach((token) => {
        if (!sessionRegistry.has(token)) {
            sessionRegistry.set(token, new Set());
        }
        sessionRegistry.get(token).add(client);
    });

    writeFrame(res, 'connected', { sessionToken });
};

const broadcastToRestaurant = (restaurantId, event, payload) => {
    const bucket = restaurantRegistry.get(restaurantId);
    if (!bucket || bucket.size === 0) {
        return;
    }

    bucket.forEach((client) => {
        try {
            writeFrame(client.res, event, payload);
        } catch (error) {
            logger.debug('Removing dead SSE client', { message: error.message });
            teardownClient(client);
        }
    });
};

const broadcastToSession = (sessionToken, event, payload) => {
    const bucket = sessionRegistry.get(sessionToken);
    if (!bucket || bucket.size === 0) {
        return;
    }

    bucket.forEach((client) => {
        try {
            writeFrame(client.res, event, payload);
        } catch (error) {
            logger.debug('Removing dead customer SSE client', { message: error.message });
            teardownClient(client);
        }
    });
};

export const notifyOrderCreated = (order) => {
    if (!order) {
        return;
    }

    if (order.restaurant?.id) {
        broadcastToRestaurant(order.restaurant.id, 'order.created', order);
    } else {
        logger.debug('Order event missing restaurant context', { orderId: order?.id });
    }

    if (order.session?.sessionToken) {
        broadcastToSession(order.session.sessionToken, 'order.created', order);
    }
};

export const notifyOrderUpdated = (order) => {
    if (!order) {
        return;
    }

    if (order.restaurant?.id) {
        broadcastToRestaurant(order.restaurant.id, 'order.updated', order);
    }

    if (order.session?.sessionToken) {
        broadcastToSession(order.session.sessionToken, 'order.updated', order);
    }
};

export const notifySessionClosed = (sessionToken, payload = {}) => {
    if (!sessionToken) {
        return;
    }
    broadcastToSession(sessionToken, 'session.closed', payload);
};
