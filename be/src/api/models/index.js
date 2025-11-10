import sequelize from '../../config/database.js';
import userModel from './user.model.js';
import userCredentialModel from './userCredential.model.js';
import adminSessionModel from './adminSession.model.js';
import adminInvitationModel from './adminInvitation.model.js';
import restaurantStaffModel from './restaurantStaff.model.js';
import passwordResetTokenModel from './passwordResetToken.model.js';
import customerVerificationTokenModel from './customerVerificationToken.model.js';
import securityEventModel from './securityEvent.model.js';
import restaurantModel from './restaurant.model.js';
import restaurantTableModel from './restaurantTable.model.js';
import customerModel from './customer.model.js';
import restaurantCustomerModel from './restaurantCustomer.model.js';
import menuCategoryModel from './menuCategory.model.js';
import menuItemModel from './menuItem.model.js';
import menuComboItemModel from './menuComboItem.model.js';
import guestSessionModel from './guestSession.model.js';
import customerAuthChallengeModel from './customerAuthChallenge.model.js';
import orderModel from './order.model.js';
import orderItemModel from './orderItem.model.js';
import orderItemRatingModel from './orderItemRating.model.js';
import kdsTicketModel from './kdsTicket.model.js';
import kdsActivityLogModel from './kdsActivityLog.model.js';
import notificationModel from './notification.model.js';
import promotionModel from './promotion.model.js';
import voucherModel from './voucher.model.js';
import voucherTierModel from './voucherTier.model.js';
import customerVoucherModel from './customerVoucher.model.js';
import menuRecommendationModel from './menuRecommendation.model.js';
import menuRecommendationHistoryModel from './menuRecommendationHistory.model.js';
import menuQueryLogModel from './menuQueryLog.model.js';
import menuQueryCandidateModel from './menuQueryCandidate.model.js';
import menuQueryClarificationModel from './menuQueryClarification.model.js';
import setupAssociations from './associations.js';

const models = {
    sequelize,
    User: userModel(sequelize),
    UserCredential: userCredentialModel(sequelize),
    AdminSession: adminSessionModel(sequelize),
    AdminInvitation: adminInvitationModel(sequelize),
    RestaurantStaff: restaurantStaffModel(sequelize),
    PasswordResetToken: passwordResetTokenModel(sequelize),
    CustomerVerificationToken: customerVerificationTokenModel(sequelize),
    SecurityEvent: securityEventModel(sequelize),
    Restaurant: restaurantModel(sequelize),
    RestaurantTable: restaurantTableModel(sequelize),
    Customer: customerModel(sequelize),
    RestaurantCustomer: restaurantCustomerModel(sequelize),
    MenuCategory: menuCategoryModel(sequelize),
    MenuItem: menuItemModel(sequelize),
    MenuComboItem: menuComboItemModel(sequelize),
    GuestSession: guestSessionModel(sequelize),
    CustomerAuthChallenge: customerAuthChallengeModel(sequelize),
    Order: orderModel(sequelize),
    OrderItem: orderItemModel(sequelize),
    OrderItemRating: orderItemRatingModel(sequelize),
    KdsTicket: kdsTicketModel(sequelize),
    KdsActivityLog: kdsActivityLogModel(sequelize),
    Notification: notificationModel(sequelize),
    Promotion: promotionModel(sequelize),
    Voucher: voucherModel(sequelize),
    VoucherTier: voucherTierModel(sequelize),
    CustomerVoucher: customerVoucherModel(sequelize),
    MenuRecommendation: menuRecommendationModel(sequelize),
    MenuRecommendationHistory: menuRecommendationHistoryModel(sequelize),
    MenuQueryLog: menuQueryLogModel(sequelize),
    MenuQueryCandidate: menuQueryCandidateModel(sequelize),
    MenuQueryClarification: menuQueryClarificationModel(sequelize)
};

setupAssociations(models);

export default models;

