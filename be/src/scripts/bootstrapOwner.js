import bcrypt from 'bcryptjs';
import sequelize from '../config/database.js';
import logger from '../config/logger.js';
import models from '../api/models/index.js';
import { USER_ROLES, USER_STATUS } from '../api/utils/common.js';

const SALT_ROUNDS = 12;

const OWNER_EMAIL = process.env.BOOTSTRAP_OWNER_EMAIL || 'owner@example.com';
const OWNER_PASSWORD = process.env.BOOTSTRAP_OWNER_PASSWORD || 'ChangeMe!123';
const OWNER_PHONE = process.env.BOOTSTRAP_OWNER_PHONE || '0000000000';
const OWNER_FIRST = process.env.BOOTSTRAP_OWNER_FIRST || 'Owner';
const OWNER_LAST = process.env.BOOTSTRAP_OWNER_LAST || 'User';
const RESTAURANT_NAME = process.env.BOOTSTRAP_RESTAURANT_NAME || 'Sample Restaurant';

async function main() {
    try {
        await sequelize.authenticate();
        await sequelize.sync();

        const { User, UserCredential, Restaurant } = models;

        let user = await User.findOne({ where: { email: OWNER_EMAIL } });
        if (!user) {
            user = await User.create({
                firstName: OWNER_FIRST,
                lastName: OWNER_LAST,
                email: OWNER_EMAIL,
                phoneNumber: OWNER_PHONE,
                role: USER_ROLES.OWNER,
                status: USER_STATUS.ACTIVE
            });
            await UserCredential.create({
                userId: user.id,
                passwordHash: await bcrypt.hash(OWNER_PASSWORD, SALT_ROUNDS)
            });
            logger.info(`Created OWNER user ${OWNER_EMAIL}`);
        } else {
            logger.info(`OWNER user ${OWNER_EMAIL} already exists`);
        }

        const existingRestaurants = await Restaurant.findAll({ where: { ownerId: user.id } });
        if (existingRestaurants.length === 0) {
            await Restaurant.create({ ownerId: user.id, name: RESTAURANT_NAME, address: null });
            logger.info(`Created restaurant '${RESTAURANT_NAME}' for owner ${OWNER_EMAIL}`);
        } else {
            logger.info(`Owner already has ${existingRestaurants.length} restaurant(s)`);
        }

        logger.info('Bootstrap completed');
        process.exit(0);
    } catch (err) {
        logger.error('Bootstrap failed', { message: err.message, stack: err.stack });
        process.exit(1);
    }
}

main();






