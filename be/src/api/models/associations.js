import { RECIPIENT_TYPE } from '../utils/common.js';

const setupAssociations = (models) => {
    const {
        User,
        UserCredential,
        AdminSession,
        AdminInvitation,
        RestaurantStaff,
        PasswordResetToken,
        SecurityEvent,
        Restaurant,
        RestaurantTable,
        Customer,
        RestaurantCustomer,
        MenuCategory,
        MenuItem,
        GuestSession,
        Order,
        OrderItem,
        KdsTicket,
        KdsActivityLog,
        Notification
    } = models;

    User.hasOne(UserCredential, { foreignKey: 'user_id', as: 'credential' });
    UserCredential.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

    User.hasMany(AdminSession, { foreignKey: 'user_id', as: 'sessions' });
    AdminSession.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

    User.hasMany(AdminInvitation, { foreignKey: 'inviter_id', as: 'sentInvitations' });
    AdminInvitation.belongsTo(User, { foreignKey: 'inviter_id', as: 'inviter' });

    User.hasMany(RestaurantStaff, { foreignKey: 'user_id', as: 'restaurantAssignments' });
    RestaurantStaff.belongsTo(User, { foreignKey: 'user_id', as: 'staffMember' });

    User.hasMany(PasswordResetToken, { foreignKey: 'user_id', as: 'passwordResets' });
    PasswordResetToken.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

    User.hasMany(SecurityEvent, { foreignKey: 'user_id', as: 'securityEvents' });
    SecurityEvent.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

    User.hasMany(Restaurant, { foreignKey: 'owner_id', as: 'restaurants' });
    Restaurant.belongsTo(User, { foreignKey: 'owner_id', as: 'owner' });

    Restaurant.hasMany(AdminInvitation, { foreignKey: 'restaurant_id', as: 'invitations' });
    AdminInvitation.belongsTo(Restaurant, { foreignKey: 'restaurant_id', as: 'restaurant' });

    Restaurant.hasMany(RestaurantStaff, { foreignKey: 'restaurant_id', as: 'staffMembers' });
    RestaurantStaff.belongsTo(Restaurant, { foreignKey: 'restaurant_id', as: 'restaurant' });

    Restaurant.hasMany(RestaurantTable, { foreignKey: 'restaurant_id', as: 'tables' });
    RestaurantTable.belongsTo(Restaurant, { foreignKey: 'restaurant_id', as: 'restaurant' });

    Restaurant.hasMany(MenuCategory, { foreignKey: 'restaurant_id', as: 'categories' });
    MenuCategory.belongsTo(Restaurant, { foreignKey: 'restaurant_id', as: 'restaurant' });

    MenuCategory.hasMany(MenuItem, { foreignKey: 'category_id', as: 'items' });
    MenuItem.belongsTo(MenuCategory, { foreignKey: 'category_id', as: 'category' });


    Customer.hasMany(RestaurantCustomer, { foreignKey: 'customer_id', as: 'memberships' });
    RestaurantCustomer.belongsTo(Customer, { foreignKey: 'customer_id', as: 'customer' });

    Restaurant.hasMany(RestaurantCustomer, { foreignKey: 'restaurant_id', as: 'memberships' });
    RestaurantCustomer.belongsTo(Restaurant, { foreignKey: 'restaurant_id', as: 'restaurant' });

    Customer.hasMany(GuestSession, { foreignKey: 'customer_id', as: 'guestSessions' });
    GuestSession.belongsTo(Customer, { foreignKey: 'customer_id', as: 'customer' });

    Customer.hasMany(Order, { foreignKey: 'customer_id', as: 'customerOrders' });
    Order.belongsTo(Customer, { foreignKey: 'customer_id', as: 'customer' });
    Restaurant.hasMany(GuestSession, { foreignKey: 'restaurant_id', as: 'guestSessions' });
    GuestSession.belongsTo(Restaurant, { foreignKey: 'restaurant_id', as: 'restaurant' });
    RestaurantTable.hasMany(GuestSession, { foreignKey: 'restaurant_table_id', as: 'guestSessions' });
    GuestSession.belongsTo(RestaurantTable, { foreignKey: 'restaurant_table_id', as: 'table' });

    GuestSession.hasMany(Order, { foreignKey: 'guest_session_id', as: 'orders' });
    Order.belongsTo(GuestSession, { foreignKey: 'guest_session_id', as: 'guestSession' });

    Restaurant.hasMany(Order, { foreignKey: 'restaurant_id', as: 'orders' });
    Order.belongsTo(Restaurant, { foreignKey: 'restaurant_id', as: 'restaurant' });

    Order.hasMany(OrderItem, { foreignKey: 'order_id', as: 'items' });
    OrderItem.belongsTo(Order, { foreignKey: 'order_id', as: 'order' });

    MenuItem.hasMany(OrderItem, { foreignKey: 'menu_item_id', as: 'orderItems' });
    OrderItem.belongsTo(MenuItem, { foreignKey: 'menu_item_id', as: 'menuItem' });

    Order.hasMany(KdsTicket, { foreignKey: 'order_id', as: 'kdsTickets' });
    KdsTicket.belongsTo(Order, { foreignKey: 'order_id', as: 'order' });

    KdsTicket.hasMany(KdsActivityLog, { foreignKey: 'kds_ticket_id', as: 'activityLogs' });
    KdsActivityLog.belongsTo(KdsTicket, { foreignKey: 'kds_ticket_id', as: 'ticket' });

    User.hasMany(KdsActivityLog, { foreignKey: 'actor_id', as: 'kdsActions' });
    KdsActivityLog.belongsTo(User, { foreignKey: 'actor_id', as: 'actorUser' });

    Notification.belongsTo(User, {
        foreignKey: 'recipient_reference',
        targetKey: 'id',
        constraints: false,
        as: 'adminRecipient',
        scope: { recipient_type: RECIPIENT_TYPE.ADMIN }
    });
};

export default setupAssociations;
