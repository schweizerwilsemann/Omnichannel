    export const TABLES = {
    USERS: 'users',
    USER_CREDENTIALS: 'user_credentials',
    ADMIN_SESSIONS: 'admin_sessions',
    ADMIN_INVITATIONS: 'admin_invitations',
    RESTAURANT_STAFF: 'restaurant_staff',
    PASSWORD_RESET_TOKENS: 'password_reset_tokens',
    CUSTOMER_VERIFICATION_TOKENS: 'customer_verification_tokens',
    SECURITY_EVENTS: 'security_events',
    RESTAURANTS: 'restaurants',
    CUSTOMERS: 'customers',
    RESTAURANT_CUSTOMERS: 'restaurant_customers',
    RESTAURANT_TABLES: 'restaurant_tables',
    MENU_CATEGORIES: 'menu_categories',
    MENU_ITEMS: 'menu_items',
    GUEST_SESSIONS: 'guest_sessions',
    ORDERS: 'orders',
    ORDER_ITEMS: 'order_items',
    ORDER_ITEM_RATINGS: 'order_item_ratings',
    KDS_TICKETS: 'kds_tickets',
    KDS_ACTIVITY_LOGS: 'kds_activity_logs',
    NOTIFICATIONS: 'notifications'
};  

export const USER_ROLES = Object.freeze({ OWNER: 'OWNER', MANAGER: 'MANAGER' });
export const USER_STATUS = Object.freeze({ ACTIVE: 'ACTIVE', INACTIVE: 'INACTIVE' });
export const RESTAURANT_STATUS = Object.freeze({ ACTIVE: 'ACTIVE', INACTIVE: 'INACTIVE' });
export const STAFF_STATUS = Object.freeze({ ACTIVE: 'ACTIVE', INACTIVE: 'INACTIVE' });
export const MEMBERSHIP_STATUS = Object.freeze({ GUEST: 'GUEST', MEMBER: 'MEMBER' });
export const TABLE_STATUS = Object.freeze({ AVAILABLE: 'AVAILABLE', RESERVED: 'RESERVED', OUT_OF_SERVICE: 'OUT_OF_SERVICE' });
export const ORDER_STATUS = Object.freeze({
    PLACED: 'PLACED',
    ACCEPTED: 'ACCEPTED',
    IN_PREP: 'IN_PREP',
    READY: 'READY',
    COMPLETED: 'COMPLETED',
    CANCELLED: 'CANCELLED'
});
export const KDS_TICKET_STATUS = Object.freeze({ QUEUED: 'QUEUED', IN_PROGRESS: 'IN_PROGRESS', READY: 'READY', COMPLETED: 'COMPLETED' });
export const KDS_ACTIONS = Object.freeze({ ACCEPT: 'ACCEPT', MARK_READY: 'MARK_READY', CANCEL: 'CANCEL', COMPLETE: 'COMPLETE' });
export const ACTOR_TYPE = Object.freeze({ USER: 'USER', AUTO: 'AUTO' });
export const NOTIFICATION_STATUS = Object.freeze({ PENDING: 'PENDING', SENT: 'SENT', FAILED: 'FAILED' });
export const NOTIFICATION_CHANNEL = Object.freeze({ PUSH: 'PUSH', EMAIL: 'EMAIL', SMS: 'SMS' });
export const EMAIL_ACTIONS = Object.freeze({ ACCOUNT_CREATED: 'account-created', CUSTOMER_VERIFY_MEMBERSHIP: 'customer-verify-membership' });
export const RECIPIENT_TYPE = Object.freeze({ CUSTOMER: 'CUSTOMER', ADMIN: 'ADMIN' });
export const SECURITY_EVENT_TYPES = Object.freeze({
    LOGIN_SUCCESS: 'LOGIN_SUCCESS',
    LOGIN_FAILURE: 'LOGIN_FAILURE',
    PASSWORD_RESET_REQUESTED: 'PASSWORD_RESET_REQUESTED',
    PASSWORD_RESET_COMPLETED: 'PASSWORD_RESET_COMPLETED',
    TOKEN_REVOKED: 'TOKEN_REVOKED'
});
export const INVITATION_STATUS = Object.freeze({ PENDING: 'PENDING', ACCEPTED: 'ACCEPTED', EXPIRED: 'EXPIRED', REVOKED: 'REVOKED' });

