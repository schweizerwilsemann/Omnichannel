import { readFileSync } from 'fs';
import path from 'path';
import Mustache from 'mustache';
import { transporter } from '../../config/email.js';
import env from '../../config/env.js';
import logger from '../../config/logger.js';
import { EMAIL_ACTIONS } from '../utils/common.js';

const templatesDir = path.join(process.cwd(), 'src', 'api', 'templates');

const readTemplate = (templateName) => {
    const templatePath = path.join(templatesDir, templateName);
    return readFileSync(templatePath, 'utf8');
};

const getEmailData = (action, payload) => {
    switch (action) {
        case EMAIL_ACTIONS.ACCOUNT_CREATED: {
            const template = readTemplate('accountCreated.html');
            const fullName = [payload.firstName, payload.lastName]
                .filter(Boolean)
                .join(' ')
                .trim() || 'there';

            const view = {
                name: fullName,
                email: payload.email || '',
                appUrl: env.app.appUrl
            };

            return {
                subject: 'Welcome to Omnichannel',
                html: Mustache.render(template, view)
            };
        }
        case EMAIL_ACTIONS.CUSTOMER_VERIFY_MEMBERSHIP: {
            const template = readTemplate('customerVerifyMembership.html');
            const fullName = [payload.firstName, payload.lastName]
                .filter(Boolean)
                .join(' ')
                .trim() || 'there';

            const view = {
                name: fullName,
                restaurantName: payload.restaurantName || 'our restaurant',
                verifyUrl: payload.verifyUrl,
                supportEmail: env.supportEmail || payload.supportEmail || ''
            };

            return {
                subject: 'Confirm your membership',
                html: Mustache.render(template, view)
            };
        }
        case EMAIL_ACTIONS.PROMOTION_CAMPAIGN: {
            const template = readTemplate('promotionCampaign.html');
            const fullName = (payload.name || '').trim() || 'there';
            const subject = payload.emailSubject || `New offer from ${payload.promotionName || 'our team'}`;
            const previewText = payload.emailPreviewText || `Claim your voucher for ${payload.promotionName || 'our latest promotion'}`;
            const view = {
                name: fullName,
                promotionName: payload.promotionName || 'Special promotion',
                headline: payload.headline || '',
                description: payload.description || '',
                bannerImageUrl: payload.bannerImageUrl || '',
                ctaLabel: payload.ctaLabel || 'Claim voucher',
                claimUrl: payload.claimUrl,
                voucherCode: payload.voucherCode || '',
                maxDiscountPercent: payload.maxDiscountPercent || 0,
                tiers: Array.isArray(payload.tiers) ? payload.tiers : [],
                legalNotice: payload.legalNotice || '',
                validUntil: payload.validUntil ? new Date(payload.validUntil).toDateString() : null,
                previewText
            };

            return {
                subject,
                html: Mustache.render(template, view)
            };
        }
        default:
            throw new Error(`Unsupported email action: ${action}`);
    }
};

export const sendEmail = async (payload, to, action, attachments = []) => {
    logger.debug(`Preparing email for ${to} using action ${action}`);

    const emailData = getEmailData(action, payload);
    const options = {
        from: env.email.user,
        to,
        subject: emailData.subject,
        html: emailData.html,
        attachments
    };

    try {
        logger.info(`Sending email to ${to} with subject "${emailData.subject}"`);
        return await transporter.sendMail(options);
    } catch (error) {
        logger.error('Error sending email', { message: error.message });
        throw error;
    }
};
