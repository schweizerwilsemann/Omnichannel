import models from '../api/models/index.js';
import env from '../config/env.js';
import logger from '../config/logger.js';
import { Op } from 'sequelize';

const { Restaurant, Promotion, MenuCategory, MenuItem } = models;

const RAG_BASE_URL = (env.rag?.baseUrl || '').replace(/\/$/, '');
const RAG_ADMIN_KEY = env.rag?.adminKey || '';

const testSync = async () => {
    try {
        console.log('=== Manual Sync Test ===\n');
        console.log('RAG Base URL:', RAG_BASE_URL);
        console.log('RAG Admin Key:', RAG_ADMIN_KEY ? '(set)' : '(not set)');

        if (!RAG_BASE_URL) {
            console.error('❌ RAG_BASE_URL not configured in .env');
            process.exit(1);
        }

        // Step 1: Load restaurants
        console.log('\n--- Step 1: Loading Restaurants ---');
        const restaurants = await Restaurant.findAll();
        console.log(`Found ${restaurants.length} restaurants`);

        if (restaurants.length === 0) {
            console.error('❌ No restaurants found');
            process.exit(1);
        }

        const restaurantIds = restaurants.map(r => r.id);
        const restaurantMap = new Map(restaurants.map(r => [r.id, r]));

        restaurants.forEach(r => {
            console.log(`  - ${r.name} (${r.id})`);
        });

        // Step 2: Load promotions
        console.log('\n--- Step 2: Loading Promotions ---');
        const now = new Date();
        console.log('Current time:', now.toISOString());

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

        const promotions = await Promotion.findAll({
            where: whereClause,
            order: [['updatedAt', 'DESC']]
        });

        console.log(`Found ${promotions.length} active promotions`);

        if (promotions.length === 0) {
            console.log('⚠️  No active promotions found');
        } else {
            promotions.forEach(p => {
                console.log(`\n  Promotion: ${p.name}`);
                console.log(`    ID: ${p.id}`);
                console.log(`    Status: ${p.status}`);
                console.log(`    Starts: ${p.startsAt?.toISOString() || 'null'}`);
                console.log(`    Ends: ${p.endsAt?.toISOString() || 'null'}`);
            });
        }

        // Step 3: Build promotion documents
        console.log('\n--- Step 3: Building Promotion Documents ---');

        const promotionDocuments = promotions.map(promotion => {
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

            return {
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
        }).filter(Boolean);

        console.log(`Built ${promotionDocuments.length} promotion documents`);

        if (promotionDocuments.length > 0) {
            promotionDocuments.forEach(doc => {
                console.log(`\n  Document:`);
                console.log(`    Source ID: ${doc.metadata.source_id}`);
                console.log(`    Text (${doc.text.length} chars):`);
                console.log(`      ${doc.text.split('\n').join('\n      ')}`);
            });
        }

        // Step 4: Load menu items (for comparison)
        console.log('\n--- Step 4: Loading Menu Items (for reference) ---');
        const categories = await MenuCategory.findAll({
            where: {
                isActive: true,
                restaurantId: { [Op.in]: restaurantIds }
            },
            include: [
                {
                    model: MenuItem,
                    as: 'items',
                    required: false,
                    where: { isAvailable: true }
                }
            ]
        });

        let menuItemCount = 0;
        categories.forEach(cat => {
            menuItemCount += (cat.items || []).length;
        });
        console.log(`Found ${menuItemCount} menu items across ${categories.length} categories`);

        // Step 5: Send to RAG service
        console.log('\n--- Step 5: Sending to RAG Service ---');

        if (promotionDocuments.length === 0) {
            console.log('⚠️  No promotion documents to send. Skipping RAG ingestion.');
            console.log('\n❌ This is why promotions don\'t appear in the chatbot!');
            process.exit(0);
        }

        const payload = {
            documents: promotionDocuments,
            chunk_size: 512,
            chunk_overlap: 50
        };

        console.log(`Sending ${promotionDocuments.length} promotion documents to RAG...`);
        console.log(`URL: ${RAG_BASE_URL}/ingest`);

        const headers = {
            'Content-Type': 'application/json'
        };

        if (RAG_ADMIN_KEY) {
            headers['x-rag-admin-key'] = RAG_ADMIN_KEY;
        }

        const response = await fetch(`${RAG_BASE_URL}/ingest`, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload)
        });

        console.log(`Response status: ${response.status} ${response.statusText}`);

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ RAG ingestion failed: ${errorText}`);
            process.exit(1);
        }

        const result = await response.json();
        console.log(`✅ RAG ingestion successful:`, result);

        // Step 6: Verify in Qdrant
        console.log('\n--- Step 6: Verifying in Qdrant ---');
        console.log('Checking if promotion documents exist in vector DB...');

        const qdrantResponse = await fetch('http://localhost:6333/collections/restaurant-faq/points/scroll', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                limit: 100,
                with_payload: true,
                with_vector: false
            })
        });

        if (qdrantResponse.ok) {
            const qdrantData = await qdrantResponse.json();
            const points = qdrantData.result?.points || [];

            const promotionPoints = points.filter(p =>
                p.payload?.source_id?.startsWith('promotion:')
            );

            console.log(`Total documents in Qdrant: ${points.length}`);
            console.log(`Promotion documents in Qdrant: ${promotionPoints.length}`);

            if (promotionPoints.length > 0) {
                console.log('\n✅ Promotion documents found:');
                promotionPoints.forEach(p => {
                    console.log(`  - ${p.payload.source_id}`);
                    console.log(`    Text: ${p.payload.chunk_text?.substring(0, 80)}...`);
                });
            } else {
                console.log('\n❌ No promotion documents found in Qdrant!');
            }
        } else {
            console.log('⚠️  Could not verify in Qdrant (check if Qdrant is running on port 6333)');
        }

        console.log('\n=== Test Complete ===');
        console.log('\n📋 Next steps:');
        console.log('1. Clear chat cache in admin panel');
        console.log('2. Refresh customer page (new session)');
        console.log('3. Ask: "any promotions available right now?"');

        process.exit(0);

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
};

testSync();
