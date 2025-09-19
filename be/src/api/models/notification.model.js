import { DataTypes } from 'sequelize';
import { TABLES, RECIPIENT_TYPE, NOTIFICATION_CHANNEL, NOTIFICATION_STATUS } from '../utils/common.js';

const notificationModel = (sequelize) =>
    sequelize.define(
        TABLES.NOTIFICATIONS,
        {
            id: {
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
                primaryKey: true
            },
            recipientType: {
                type: DataTypes.ENUM(...Object.values(RECIPIENT_TYPE)),
                allowNull: false,
                field: 'recipient_type'
            },
            recipientReference: {
                type: DataTypes.STRING(150),
                allowNull: false,
                field: 'recipient_reference'
            },
            channel: {
                type: DataTypes.ENUM(...Object.values(NOTIFICATION_CHANNEL)),
                allowNull: false
            },
            templateKey: {
                type: DataTypes.STRING(100),
                allowNull: false,
                field: 'template_key'
            },
            payload: {
                type: DataTypes.JSON,
                allowNull: true
            },
            sentAt: {
                type: DataTypes.DATE,
                allowNull: true,
                field: 'sent_at'
            },
            status: {
                type: DataTypes.ENUM(...Object.values(NOTIFICATION_STATUS)),
                allowNull: false,
                defaultValue: NOTIFICATION_STATUS.PENDING
            },
            errorMessage: {
                type: DataTypes.TEXT,
                allowNull: true,
                field: 'error_message'
            }
        },
        {
            underscored: true,
            timestamps: true,
            updatedAt: false
        }
    );

export default notificationModel;
