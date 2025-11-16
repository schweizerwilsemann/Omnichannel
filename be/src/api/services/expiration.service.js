import { Op } from 'sequelize';
import models from '../models/index.js';
import logger from '../../config/logger.js';
import { PROMOTION_STATUS, VOUCHER_STATUS } from '../utils/common.js';

const { Promotion, Voucher } = models;

let scheduledJob = null;

/**
 * Update expired promotions to EXPIRED status
 */
const expirePromotions = async () => {
    try {
        const now = new Date();

        // Find all active or scheduled promotions that have passed their end date
        const expiredPromotions = await Promotion.findAll({
            where: {
                status: {
                    [Op.in]: [PROMOTION_STATUS.ACTIVE, PROMOTION_STATUS.SCHEDULED]
                },
                endsAt: {
                    [Op.not]: null,
                    [Op.lt]: now
                }
            }
        });

        if (expiredPromotions.length === 0) {
            logger.debug('No promotions to expire');
            return { promotionsExpired: 0 };
        }

        // Update all expired promotions
        const promotionIds = expiredPromotions.map(p => p.id);
        const [updatedCount] = await Promotion.update(
            { status: PROMOTION_STATUS.EXPIRED },
            {
                where: {
                    id: { [Op.in]: promotionIds }
                }
            }
        );

        logger.info('Expired promotions', {
            count: updatedCount,
            promotionIds
        });

        return { promotionsExpired: updatedCount };
    } catch (error) {
        logger.error('Failed to expire promotions', {
            message: error.message,
            stack: error.stack
        });
        throw error;
    }
};

/**
 * Update expired vouchers to INACTIVE status
 */
const expireVouchers = async () => {
    try {
        const now = new Date();

        // Find all active vouchers that have passed their valid until date
        const expiredVouchers = await Voucher.findAll({
            where: {
                status: VOUCHER_STATUS.ACTIVE,
                validUntil: {
                    [Op.not]: null,
                    [Op.lt]: now
                }
            }
        });

        if (expiredVouchers.length === 0) {
            logger.debug('No vouchers to expire');
            return { vouchersExpired: 0 };
        }

        // Update all expired vouchers
        const voucherIds = expiredVouchers.map(v => v.id);
        const [updatedCount] = await Voucher.update(
            { status: VOUCHER_STATUS.INACTIVE },
            {
                where: {
                    id: { [Op.in]: voucherIds }
                }
            }
        );

        logger.info('Expired vouchers', {
            count: updatedCount,
            voucherIds
        });

        return { vouchersExpired: updatedCount };
    } catch (error) {
        logger.error('Failed to expire vouchers', {
            message: error.message,
            stack: error.stack
        });
        throw error;
    }
};

/**
 * Activate scheduled promotions that have reached their start date
 */
const activateScheduledPromotions = async () => {
    try {
        const now = new Date();

        // Find all scheduled promotions that have reached their start date
        const promotionsToActivate = await Promotion.findAll({
            where: {
                status: PROMOTION_STATUS.SCHEDULED,
                startsAt: {
                    [Op.not]: null,
                    [Op.lte]: now
                },
                [Op.or]: [
                    { endsAt: null },
                    { endsAt: { [Op.gt]: now } }
                ]
            }
        });

        if (promotionsToActivate.length === 0) {
            logger.debug('No promotions to activate');
            return { promotionsActivated: 0 };
        }

        // Update all promotions to active
        const promotionIds = promotionsToActivate.map(p => p.id);
        const [updatedCount] = await Promotion.update(
            { status: PROMOTION_STATUS.ACTIVE },
            {
                where: {
                    id: { [Op.in]: promotionIds }
                }
            }
        );

        logger.info('Activated scheduled promotions', {
            count: updatedCount,
            promotionIds
        });

        return { promotionsActivated: updatedCount };
    } catch (error) {
        logger.error('Failed to activate scheduled promotions', {
            message: error.message,
            stack: error.stack
        });
        throw error;
    }
};

/**
 * Run all expiration checks
 */
export const runExpirationChecks = async () => {
    logger.debug('Running expiration checks');

    const results = {
        timestamp: new Date(),
        promotionsExpired: 0,
        promotionsActivated: 0,
        vouchersExpired: 0
    };

    try {
        // Activate scheduled promotions first
        const activationResult = await activateScheduledPromotions();
        results.promotionsActivated = activationResult.promotionsActivated;

        // Then expire promotions
        const promotionResult = await expirePromotions();
        results.promotionsExpired = promotionResult.promotionsExpired;

        // Then expire vouchers
        const voucherResult = await expireVouchers();
        results.vouchersExpired = voucherResult.vouchersExpired;

        logger.info('Expiration checks completed', results);
    } catch (error) {
        logger.error('Expiration checks failed', {
            message: error.message,
            results
        });
    }

    return results;
};

/**
 * Schedule automatic expiration checks
 * @param {number} intervalMinutes - How often to run checks (default: 60 minutes)
 */
export const scheduleExpirationJob = (intervalMinutes = 60) => {
    if (scheduledJob) {
        logger.warn('Expiration job already scheduled');
        return;
    }

    // Ensure interval is at least 5 minutes
    const safeInterval = Math.max(intervalMinutes, 5);
    const intervalMs = safeInterval * 60 * 1000;

    scheduledJob = setInterval(async () => {
        try {
            await runExpirationChecks();
        } catch (error) {
            logger.error('Scheduled expiration check failed', {
                message: error.message
            });
        }
    }, intervalMs);

    logger.info('Scheduled automatic expiration checks', {
        intervalMinutes: safeInterval
    });

    // Run immediately on startup
    runExpirationChecks().catch(error => {
        logger.error('Initial expiration check failed', {
            message: error.message
        });
    });
};

/**
 * Stop the scheduled job
 */
export const stopExpirationJob = () => {
    if (scheduledJob) {
        clearInterval(scheduledJob);
        scheduledJob = null;
        logger.info('Stopped automatic expiration checks');
    }
};

/**
 * Get the status of the scheduled job
 */
export const getExpirationJobStatus = () => {
    return {
        isScheduled: scheduledJob !== null
    };
};

export default {
    runExpirationChecks,
    scheduleExpirationJob,
    stopExpirationJob,
    getExpirationJobStatus,
    expirePromotions,
    expireVouchers,
    activateScheduledPromotions
};
