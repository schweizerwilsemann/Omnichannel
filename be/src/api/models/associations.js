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
        CustomerAuthChallenge,
        Order,
        OrderItem,
        OrderItemRating,
        KdsTicket,
        KdsActivityLog,
        CustomerVerificationToken,
        Notification,
        Promotion,
        Voucher,
        VoucherTier,
        CustomerVoucher,
        MenuRecommendation,
        MenuRecommendationHistory,
        MenuQueryLog,
        MenuQueryCandidate,
        MenuQueryClarification
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

    Customer.hasMany(CustomerVerificationToken, { foreignKey: 'customer_id', as: 'verificationTokens' });
    CustomerVerificationToken.belongsTo(Customer, { foreignKey: 'customer_id', as: 'customer' });

    Restaurant.hasMany(CustomerVerificationToken, { foreignKey: 'restaurant_id', as: 'verificationTokens' });
    CustomerVerificationToken.belongsTo(Restaurant, { foreignKey: 'restaurant_id', as: 'restaurant' });

    Customer.hasMany(CustomerAuthChallenge, { foreignKey: 'customer_id', as: 'authChallenges' });
    CustomerAuthChallenge.belongsTo(Customer, { foreignKey: 'customer_id', as: 'customer' });

    Restaurant.hasMany(CustomerAuthChallenge, { foreignKey: 'restaurant_id', as: 'authChallenges' });
    CustomerAuthChallenge.belongsTo(Restaurant, { foreignKey: 'restaurant_id', as: 'restaurant' });


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

    // Order item ratings (one-to-one)
    OrderItem.hasOne(OrderItemRating, { foreignKey: 'order_item_id', as: 'rating' });
    OrderItemRating.belongsTo(OrderItem, { foreignKey: 'order_item_id', as: 'orderItem' });

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

    Restaurant.hasMany(Promotion, { foreignKey: 'restaurant_id', as: 'promotions' });
    Promotion.belongsTo(Restaurant, { foreignKey: 'restaurant_id', as: 'restaurant' });

    Promotion.hasMany(Voucher, { foreignKey: 'promotion_id', as: 'vouchers' });
    Voucher.belongsTo(Promotion, { foreignKey: 'promotion_id', as: 'promotion' });

    Restaurant.hasMany(Voucher, { foreignKey: 'restaurant_id', as: 'vouchers' });
    Voucher.belongsTo(Restaurant, { foreignKey: 'restaurant_id', as: 'restaurant' });

    Voucher.hasMany(VoucherTier, { foreignKey: 'voucher_id', as: 'tiers' });
    VoucherTier.belongsTo(Voucher, { foreignKey: 'voucher_id', as: 'voucher' });

    Voucher.hasMany(CustomerVoucher, { foreignKey: 'voucher_id', as: 'claims' });
    CustomerVoucher.belongsTo(Voucher, { foreignKey: 'voucher_id', as: 'voucher' });

    Promotion.hasMany(CustomerVoucher, { foreignKey: 'promotion_id', as: 'claims' });
    CustomerVoucher.belongsTo(Promotion, { foreignKey: 'promotion_id', as: 'promotion' });

    Customer.hasMany(CustomerVoucher, { foreignKey: 'customer_id', as: 'vouchers' });
    CustomerVoucher.belongsTo(Customer, { foreignKey: 'customer_id', as: 'customer' });

    Restaurant.hasMany(CustomerVoucher, { foreignKey: 'restaurant_id', as: 'customerVouchers' });
    CustomerVoucher.belongsTo(Restaurant, { foreignKey: 'restaurant_id', as: 'restaurant' });

    Order.belongsTo(CustomerVoucher, { foreignKey: 'customer_voucher_id', as: 'customerVoucher' });
    CustomerVoucher.hasMany(Order, { foreignKey: 'customer_voucher_id', as: 'orders' });

    Restaurant.hasMany(MenuRecommendation, { foreignKey: 'restaurant_id', as: 'menuRecommendations' });
    MenuRecommendation.belongsTo(Restaurant, { foreignKey: 'restaurant_id', as: 'restaurant' });

    MenuItem.hasMany(MenuRecommendation, { foreignKey: 'base_item_id', as: 'recommendationsAsBase' });
    MenuRecommendation.belongsTo(MenuItem, { foreignKey: 'base_item_id', as: 'baseItem' });

    MenuItem.hasMany(MenuRecommendation, { foreignKey: 'recommended_item_id', as: 'recommendationsAsCompanion' });
    MenuRecommendation.belongsTo(MenuItem, { foreignKey: 'recommended_item_id', as: 'recommendedItem' });

    if (MenuRecommendationHistory) {
        Restaurant.hasMany(MenuRecommendationHistory, {
            foreignKey: 'restaurant_id',
            as: 'menuRecommendationHistory'
        });
        MenuRecommendationHistory.belongsTo(Restaurant, {
            foreignKey: 'restaurant_id',
            as: 'restaurant'
        });
        MenuItem.hasMany(MenuRecommendationHistory, {
            foreignKey: 'base_item_id',
            as: 'recommendationHistoryAsBase'
        });
        MenuRecommendationHistory.belongsTo(MenuItem, {
            foreignKey: 'base_item_id',
            as: 'baseItem'
        });
        MenuItem.hasMany(MenuRecommendationHistory, {
            foreignKey: 'recommended_item_id',
            as: 'recommendationHistoryAsCompanion'
        });
        MenuRecommendationHistory.belongsTo(MenuItem, {
            foreignKey: 'recommended_item_id',
            as: 'recommendedItem'
        });
    }

    if (MenuQueryLog) {
        Restaurant.hasMany(MenuQueryLog, { foreignKey: 'restaurant_id', as: 'menuQueryLogs' });
        MenuQueryLog.belongsTo(Restaurant, { foreignKey: 'restaurant_id', as: 'restaurant' });

        GuestSession.hasMany(MenuQueryLog, { foreignKey: 'guest_session_id', as: 'menuQueryLogs' });
        MenuQueryLog.belongsTo(GuestSession, { foreignKey: 'guest_session_id', as: 'guestSession' });

        Customer.hasMany(MenuQueryLog, { foreignKey: 'customer_id', as: 'menuQueryLogs' });
        MenuQueryLog.belongsTo(Customer, { foreignKey: 'customer_id', as: 'customer' });
    }

    if (MenuQueryLog && MenuQueryCandidate) {
        MenuQueryLog.hasMany(MenuQueryCandidate, { foreignKey: 'query_log_id', as: 'candidates' });
        MenuQueryCandidate.belongsTo(MenuQueryLog, { foreignKey: 'query_log_id', as: 'queryLog' });
        MenuQueryCandidate.belongsTo(MenuItem, { foreignKey: 'menu_item_id', as: 'menuItem' });
        MenuItem.hasMany(MenuQueryCandidate, { foreignKey: 'menu_item_id', as: 'menuQueryCandidates' });
    }

    if (MenuQueryLog && MenuQueryClarification) {
        MenuQueryLog.hasMany(MenuQueryClarification, { foreignKey: 'query_log_id', as: 'clarifications' });
        MenuQueryClarification.belongsTo(MenuQueryLog, { foreignKey: 'query_log_id', as: 'queryLog' });
    }
};

export default setupAssociations;
