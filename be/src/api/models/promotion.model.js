import { DataTypes } from 'sequelize';
import { TABLES, PROMOTION_STATUS } from '../utils/common.js';

const promotionModel = (sequelize) =>
    sequelize.define(
        TABLES.PROMOTIONS,
        {
            id: {
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
                primaryKey: true
            },
            restaurantId: {
                type: DataTypes.UUID,
                allowNull: false,
                field: 'restaurant_id'
            },
            name: {
                type: DataTypes.STRING(150),
                allowNull: false
            },
            headline: {
                type: DataTypes.STRING(200),
                allowNull: true
            },
            description: {
                type: DataTypes.TEXT,
                allowNull: true
            },
            bannerImageUrl: {
                type: DataTypes.STRING(500),
                allowNull: true,
                field: 'banner_image_url'
            },
            ctaLabel: {
                type: DataTypes.STRING(100),
                allowNull: true,
                field: 'cta_label'
            },
            ctaUrl: {
                type: DataTypes.STRING(500),
                allowNull: true,
                field: 'cta_url'
            },
            status: {
                type: DataTypes.ENUM(...Object.values(PROMOTION_STATUS)),
                allowNull: false,
                defaultValue: PROMOTION_STATUS.DRAFT
            },
            startsAt: {
                type: DataTypes.DATE,
                allowNull: true,
                field: 'starts_at'
            },
            endsAt: {
                type: DataTypes.DATE,
                allowNull: true,
                field: 'ends_at'
            },
            emailSubject: {
                type: DataTypes.STRING(200),
                allowNull: true,
                field: 'email_subject'
            },
            emailPreviewText: {
                type: DataTypes.STRING(255),
                allowNull: true,
                field: 'email_preview_text'
            },
            emailBody: {
                type: DataTypes.TEXT,
                allowNull: true,
                field: 'email_body'
            }
        },
        {
            underscored: true,
            indexes: [
                {
                    fields: ['restaurant_id', 'status', 'starts_at', 'ends_at']
                }
            ]
        }
    );

export default promotionModel;
