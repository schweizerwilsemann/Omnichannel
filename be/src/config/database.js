import { Sequelize } from 'sequelize';
import env from './env.js';
import logger from './logger.js';

const sequelize = new Sequelize(env.db.name, env.db.user, env.db.password, {
    host: env.db.host,
    port: env.db.port,
    dialect: env.db.dialect,
    logging: (msg) => logger.debug ? logger.debug(msg) : null
});

export default sequelize;
