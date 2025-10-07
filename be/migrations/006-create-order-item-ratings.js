import { DataTypes } from 'sequelize';

export const up = async (queryInterface, Sequelize) => {
    await queryInterface.createTable('order_item_ratings', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        order_id: {
            type: DataTypes.UUID,
            allowNull: false
        },
        order_item_id: {
            type: DataTypes.UUID,
            allowNull: false,
            unique: true
        },
        menu_item_id: {
            type: DataTypes.UUID,
            allowNull: false
        },
        restaurant_id: {
            type: DataTypes.UUID,
            allowNull: false
        },
        guest_session_id: {
            type: DataTypes.UUID,
            allowNull: false
        },
        customer_id: {
            type: DataTypes.UUID,
            allowNull: true
        },
        rating: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        comment: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        rated_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        },
        created_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        },
        updated_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
        }
    });

    await queryInterface.addIndex('order_item_ratings', ['restaurant_id']);
    await queryInterface.addIndex('order_item_ratings', ['customer_id']);
    await queryInterface.addIndex('order_item_ratings', ['guest_session_id']);
};

export const down = async (queryInterface) => {
    await queryInterface.dropTable('order_item_ratings');
};