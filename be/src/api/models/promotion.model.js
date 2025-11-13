import { DataTypes } from 'sequelize';
import { TABLES, PROMOTION_STATUS } from '../utils/common.js';
import logger from '../../config/logger.js';

const promotionModel = (sequelize) => {
    const Promotion = sequelize.define(
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
            ],
            hooks: {
                afterCreate: async (promotion, options) => {
                    try {
                        // Trigger RAG sync after creating a promotion
                        logger.info('Promotion created, triggering RAG sync', {
                            promotionId: promotion.id,
                            name: promotion.name
                        });
                        // Dynamic import to avoid circular dependencies
                        const { syncRagKnowledge } = await import('../services/ragSync.service.js');
                        await syncRagKnowledge({ flushCache: true });
                    } catch (error) {
                        logger.error('Failed to sync RAG after promotion create', {
                            error: error.message
                        });
                    }
                },
                afterUpdate: async (promotion, options) => {
                    try {
                        // Trigger RAG sync after updating a promotion
                        logger.info('Promotion updated, triggering RAG sync', {
                            promotionId: promotion.id,
                            name: promotion.name
                        });
                        const { syncRagKnowledge } = await import('../services/ragSync.service.js');
                        await syncRagKnowledge({ flushCache: true });
                    } catch (error) {
                        logger.error('Failed to sync RAG after promotion update', {
                            error: error.message
                        });
                    }
                },
                afterDestroy: async (promotion, options) => {
                    try {
                        // Trigger RAG sync after deleting a promotion
                        logger.info('Promotion deleted, triggering RAG sync', {
                            promotionId: promotion.id
                        });
                        const { syncRagKnowledge } = await import('../services/ragSync.service.js');
                        await syncRagKnowledge({ flushCache: true });
                    } catch (error) {
                        logger.error('Failed to sync RAG after promotion delete', {
                            error: error.message
                        });
                    }
                }
            }
        }
    );

    return Promotion;
};

export default promotionModel;
