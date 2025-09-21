import models from '../src/api/models/index.js';
import { ORDER_STATUS } from '../src/api/utils/common.js';

export const up = async () => {
    const { Restaurant, RestaurantTable, MenuItem, Order, OrderItem, GuestSession } = models;
    
    // Get restaurant and table
    const restaurant = await Restaurant.findOne();
    const table = await RestaurantTable.findOne();
    
    if (!restaurant || !table) {
        throw new Error('Restaurant or table not found. Please run previous seeders first.');
    }

    // Get some menu items
    const menuItems = await MenuItem.findAll({ limit: 10 });
    
    if (menuItems.length === 0) {
        throw new Error('Menu items not found. Please run menu items seeder first.');
    }

    // Create guest sessions
    const guestSession1 = await GuestSession.create({
        restaurantId: restaurant.id,
        restaurantTableId: table.id,
        sessionToken: 'guest-session-1-' + Date.now()
    });

    const guestSession2 = await GuestSession.create({
        restaurantId: restaurant.id,
        restaurantTableId: table.id,
        sessionToken: 'guest-session-2-' + Date.now()
    });

    // Create sample orders
    const order1 = await Order.create({
        restaurantId: restaurant.id,
        guestSessionId: guestSession1.id,
        status: ORDER_STATUS.COMPLETED,
        totalCents: 4598, // $45.98
        specialRequest: 'Please make the salmon medium-rare',
        placedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        readyAt: new Date(Date.now() - 1.5 * 60 * 60 * 1000), // 1.5 hours ago
        completedAt: new Date(Date.now() - 1 * 60 * 60 * 1000) // 1 hour ago
    });

    const order2 = await Order.create({
        restaurantId: restaurant.id,
        guestSessionId: guestSession2.id,
        status: ORDER_STATUS.IN_PREP,
        totalCents: 3298, // $32.98
        specialRequest: 'Extra cheese on the pizza',
        placedAt: new Date(Date.now() - 30 * 60 * 1000) // 30 minutes ago
    });

    // Create order items for order 1
    await OrderItem.create({
        orderId: order1.id,
        menuItemId: menuItems[0].id, // Bruschetta Trio
        quantity: 1,
        priceCentsSnapshot: menuItems[0].priceCents,
        notes: 'Extra basil please'
    });

    await OrderItem.create({
        orderId: order1.id,
        menuItemId: menuItems[6].id, // Grilled Salmon
        quantity: 1,
        priceCentsSnapshot: menuItems[6].priceCents,
        notes: 'Medium-rare'
    });

    await OrderItem.create({
        orderId: order1.id,
        menuItemId: menuItems[17].id, // Tiramisu
        quantity: 1,
        priceCentsSnapshot: menuItems[17].priceCents
    });

    // Create order items for order 2
    await OrderItem.create({
        orderId: order2.id,
        menuItemId: menuItems[3].id, // Caesar Salad
        quantity: 1,
        priceCentsSnapshot: menuItems[3].priceCents
    });

    await OrderItem.create({
        orderId: order2.id,
        menuItemId: menuItems[13].id, // Margherita Pizza
        quantity: 1,
        priceCentsSnapshot: menuItems[13].priceCents,
        notes: 'Extra cheese'
    });

    await OrderItem.create({
        orderId: order2.id,
        menuItemId: menuItems[20].id, // Fresh Orange Juice
        quantity: 2,
        priceCentsSnapshot: menuItems[20].priceCents
    });

    console.log('✅ Sample orders seeded successfully');
};

export const down = async () => {
    const { Order, OrderItem, GuestSession } = models;
    
    await OrderItem.destroy({ where: {} });
    await Order.destroy({ where: {} });
    await GuestSession.destroy({ where: {} });
    
    console.log('✅ Sample orders unseeded successfully');
};
