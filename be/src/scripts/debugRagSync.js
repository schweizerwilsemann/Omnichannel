import models from '../api/models/index.js';
import { Op } from 'sequelize';
import logger from '../config/logger.js';

const { Restaurant, Promotion } = models;

const debugRagSync = async () => {
    try {
        console.log('=== RAG Sync Debug Script ===\n');

        // Get all restaurants
        const restaurants = await Restaurant.findAll();
        console.log(`Found ${restaurants.length} restaurants:`);
        restaurants.forEach(r => {
            console.log(`  - ${r.name} (${r.id})`);
        });

        if (restaurants.length === 0) {
            console.log('\n❌ No restaurants found!');
            process.exit(1);
        }

        const restaurantIds = restaurants.map(r => r.id);
        const now = new Date();

        console.log(`\nCurrent time: ${now.toISOString()}`);

        // Test the exact query used in ragSync.service.js
        console.log('\n--- Testing Promotion Query ---');

        const whereClause = {
            restaurantId: { [Op.in]: restaurantIds },
            [Op.and]: [
                {
                    [Op.or]: [{ startsAt: null }, { startsAt: { [Op.lte]: now } }]
                },
                {
                    [Op.or]: [{ endsAt: null }, { endsAt: { [Op.gt]: now } }]
                }
            ],
            status: { [Op.notIn]: ['EXPIRED', 'INACTIVE'] }
        };

        console.log('Query whereClause:');
        console.log(JSON.stringify(whereClause, null, 2));

        const promotions = await Promotion.findAll({
            where: whereClause,
            order: [['updatedAt', 'DESC']]
        });

        console.log(`\nFound ${promotions.length} active promotions:`);

        if (promotions.length === 0) {
            console.log('  (none)');

            // Show ALL promotions to help debug
            console.log('\n--- All Promotions in Database ---');
            const allPromotions = await Promotion.findAll();
            console.log(`Total promotions: ${allPromotions.length}`);
            allPromotions.forEach(p => {
                const started = !p.startsAt || new Date(p.startsAt) <= now;
                const notEnded = !p.endsAt || new Date(p.endsAt) > now;
                const validStatus = !['EXPIRED', 'INACTIVE'].includes(p.status);

                console.log(`\n  Promotion: ${p.name}`);
                console.log(`    ID: ${p.id}`);
                console.log(`    Status: ${p.status}`);
                console.log(`    Starts: ${p.startsAt ? new Date(p.startsAt).toISOString() : 'null'}`);
                console.log(`    Ends: ${p.endsAt ? new Date(p.endsAt).toISOString() : 'null'}`);
                console.log(`    Checks:`);
                console.log(`      ✓ Started? ${started}`);
                console.log(`      ✓ Not ended? ${notEnded}`);
                console.log(`      ✓ Valid status? ${validStatus}`);
                console.log(`      → Would be included? ${started && notEnded && validStatus ? '✅ YES' : '❌ NO'}`);
            });
        } else {
            promotions.forEach(p => {
                console.log(`\n  ${p.name}:`);
                console.log(`    ID: ${p.id}`);
                console.log(`    Status: ${p.status}`);
                console.log(`    Restaurant: ${p.restaurantId}`);
                console.log(`    Starts: ${p.startsAt}`);
                console.log(`    Ends: ${p.endsAt}`);
                console.log(`    Headline: ${p.headline || '(none)'}`);
                console.log(`    Description: ${p.description || '(none)'}`);
            });

            // Build documents
            console.log('\n--- Building Promotion Documents ---');
            const restaurantMap = new Map(restaurants.map(r => [r.id, r]));

            const promotionDocs = promotions.map(promotion => {
                const restaurant = restaurantMap.get(promotion.restaurantId);
                if (!restaurant) {
                    console.log(`  ⚠️  No restaurant found for promotion ${promotion.id}`);
                    return null;
                }

                const startsAt = promotion.startsAt ? new Date(promotion.startsAt).toISOString() : null;
                const endsAt = promotion.endsAt ? new Date(promotion.endsAt).toISOString() : null;

                const lines = [
                    `Promotion: ${promotion.name}`,
                    `Restaurant: ${restaurant.name}`,
                    promotion.headline ? `Headline: ${promotion.headline}` : null,
                    promotion.description ? `Details: ${promotion.description}` : null,
                    startsAt || endsAt ? `Schedule: ${startsAt || 'now'} → ${endsAt || 'open ended'}` : null,
                    promotion.ctaLabel && promotion.ctaUrl ? `CTA: ${promotion.ctaLabel} (${promotion.ctaUrl})` : null
                ].filter(Boolean);

                if (lines.length === 0) {
                    console.log(`  ⚠️  No content for promotion ${promotion.id}`);
                    return null;
                }

                const doc = {
                    text: lines.join('\n').trim(),
                    metadata: {
                        restaurant_id: restaurant.id,
                        source_id: `promotion:${promotion.id}`,
                        tags: ['promotion', promotion.status.toLowerCase()],
                        extras: {
                            startsAt,
                            endsAt,
                            status: promotion.status
                        }
                    }
                };

                console.log(`\n  Document for "${promotion.name}":`);
                console.log(`    Source ID: ${doc.metadata.source_id}`);
                console.log(`    Text length: ${doc.text.length} chars`);
                console.log(`    Text preview:\n      ${doc.text.split('\n').join('\n      ')}`);

                return doc;
            }).filter(Boolean);

            console.log(`\n✅ Created ${promotionDocs.length} promotion documents`);
        }

        console.log('\n=== Debug Complete ===');
        process.exit(0);

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
};

debugRagSync();
