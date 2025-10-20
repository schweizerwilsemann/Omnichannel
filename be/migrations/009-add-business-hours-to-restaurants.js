import { DataTypes } from 'sequelize';

const TABLE = 'restaurants';
const COLUMN = 'business_hours';

export const up = async (queryInterface) => {
    await queryInterface.addColumn(TABLE, COLUMN, {
        type: DataTypes.JSON,
        allowNull: true
    });
};

export const down = async (queryInterface) => {
    await queryInterface.removeColumn(TABLE, COLUMN);
};
