import models from '../src/api/models/index.js';
import {
    PROMOTION_STATUS,
    VOUCHER_STATUS,
    DISCOUNT_TYPES
} from '../src/api/utils/common.js';

export const up = async () => {
    const { Restaurant, Promotion, Voucher, VoucherTier } = models;

    const restaurant = await Restaurant.findOne({ where: { name: 'Bella Vista Restaurant' } });
    if (!restaurant) {
        console.warn('⚠️  Restaurant not found. Skipping promotion seeder.');
        return;
    }

    const now = new Date();
    const twoWeeksFromNow = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    const promotion = await Promotion.create({
        restaurantId: restaurant.id,
        name: 'Summer Feast Bonanza',
        headline: 'Savor summer with layered savings',
        description: 'Claim your seat, stack the table, and enjoy bigger discounts the more you dine.',
        bannerImageUrl: 'https://images.unsplash.com/photo-1543352634-873f17a7a088?w=1200&h=600&fit=crop&crop=center',
        ctaLabel: 'Claim your voucher',
        ctaUrl: null,
        status: PROMOTION_STATUS.ACTIVE,
        startsAt: now,
        endsAt: twoWeeksFromNow,
        emailSubject: 'Your Summer Feast voucher is ready',
        emailPreviewText: 'Tap to claim layered savings up to 40% off your bill.',
        emailBody: null
    });

    const voucher = await Voucher.create({
        restaurantId: restaurant.id,
        promotionId: promotion.id,
        code: 'SUMMER24',
        name: 'Summer Layered Savings',
        description: 'Spend more to save more during our summer celebration.',
        status: VOUCHER_STATUS.ACTIVE,
        discountType: DISCOUNT_TYPES.PERCENTAGE,
        allowStackWithPoints: false,
        claimsPerCustomer: 1,
        totalClaimLimit: 500,
        validFrom: now,
        validUntil: twoWeeksFromNow,
        termsUrl: 'https://example.com/terms'
    });

    await VoucherTier.bulkCreate([
        {
            voucherId: voucher.id,
            minSpendCents: 2000,
            discountPercent: 10,
            maxDiscountCents: 1000,
            sortOrder: 0
        },
        {
            voucherId: voucher.id,
            minSpendCents: 4000,
            discountPercent: 20,
            maxDiscountCents: 2000,
            sortOrder: 1
        },
        {
            voucherId: voucher.id,
            minSpendCents: 7000,
            discountPercent: 40,
            maxDiscountCents: 4000,
            sortOrder: 2
        }
    ]);

    console.log('✅ Promotions and vouchers seeded successfully');
};

export const down = async () => {
    const { Voucher, Promotion } = models;

    const voucher = await Voucher.findOne({ where: { code: 'SUMMER24' } });
    if (voucher) {
        await Voucher.destroy({ where: { id: voucher.id } });
    }

    await Promotion.destroy({ where: { name: 'Summer Feast Bonanza' } });
    console.log('✅ Promotions and vouchers unseeded successfully');
};
