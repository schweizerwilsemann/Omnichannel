import models from '../src/api/models/index.js';

export const up = async () => {
    const { MenuCategory, MenuItem } = models;
    
    // Get menu categories
    const categories = await MenuCategory.findAll();
    const categoryMap = {};
    categories.forEach(cat => {
        categoryMap[cat.name] = cat.id;
    });

    // Menu items with high-quality food images from Unsplash
    const menuItems = [
        // Appetizers
        {
            categoryId: categoryMap['Appetizers'],
            sku: 'APP001',
            name: 'Bruschetta Trio',
            description: 'Three varieties of bruschetta: classic tomato basil, mushroom truffle, and goat cheese with honey',
            priceCents: 1299,
            prepTimeSeconds: 600,
            imageUrl: 'https://images.unsplash.com/photo-1572441713132-51c75654db73?w=800&h=600&fit=crop&crop=center'
        },
        {
            categoryId: categoryMap['Appetizers'],
            sku: 'APP002',
            name: 'Calamari Fritti',
            description: 'Crispy fried calamari rings served with marinara sauce and lemon aioli',
            priceCents: 1599,
            prepTimeSeconds: 900,
            imageUrl: 'https://images.unsplash.com/photo-1551218808-94e220e084d2?w=800&h=600&fit=crop&crop=center'
        },
        {
            categoryId: categoryMap['Appetizers'],
            sku: 'APP003',
            name: 'Burrata Caprese',
            description: 'Fresh burrata cheese with heirloom tomatoes, basil, and aged balsamic glaze',
            priceCents: 1799,
            prepTimeSeconds: 300,
            imageUrl: 'https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=800&h=600&fit=crop&crop=center'
        },

        // Soups & Salads
        {
            categoryId: categoryMap['Soups & Salads'],
            sku: 'SOU001',
            name: 'Lobster Bisque',
            description: 'Rich and creamy lobster bisque with cognac and fresh herbs',
            priceCents: 1299,
            prepTimeSeconds: 600,
            imageUrl: 'https://images.unsplash.com/photo-1547592180-85f173990554?w=800&h=600&fit=crop&crop=center'
        },
        {
            categoryId: categoryMap['Soups & Salads'],
            sku: 'SAL001',
            name: 'Caesar Salad',
            description: 'Romaine lettuce, parmesan cheese, croutons, and our house-made caesar dressing',
            priceCents: 1199,
            prepTimeSeconds: 300,
            imageUrl: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&h=600&fit=crop&crop=center'
        },
        {
            categoryId: categoryMap['Soups & Salads'],
            sku: 'SAL002',
            name: 'Arugula & Pear Salad',
            description: 'Fresh arugula with sliced pears, candied walnuts, and gorgonzola cheese',
            priceCents: 1399,
            prepTimeSeconds: 300,
            imageUrl: 'https://images.unsplash.com/photo-1546793665-c74683f339c1?w=800&h=600&fit=crop&crop=center'
        },

        // Main Courses
        {
            categoryId: categoryMap['Main Courses'],
            sku: 'MAIN001',
            name: 'Grilled Salmon',
            description: 'Atlantic salmon with lemon herb butter, roasted vegetables, and wild rice',
            priceCents: 2899,
            prepTimeSeconds: 1200,
            imageUrl: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=800&h=600&fit=crop&crop=center'
        },
        {
            categoryId: categoryMap['Main Courses'],
            sku: 'MAIN002',
            name: 'Beef Tenderloin',
            description: '8oz center-cut beef tenderloin with red wine reduction and garlic mashed potatoes',
            priceCents: 3899,
            prepTimeSeconds: 1500,
            imageUrl: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=800&h=600&fit=crop&crop=center'
        },
        {
            categoryId: categoryMap['Main Courses'],
            sku: 'MAIN003',
            name: 'Chicken Marsala',
            description: 'Pan-seared chicken breast with marsala wine sauce and wild mushrooms',
            priceCents: 2499,
            prepTimeSeconds: 1200,
            imageUrl: 'https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=800&h=600&fit=crop&crop=center'
        },
        {
            categoryId: categoryMap['Main Courses'],
            sku: 'MAIN004',
            name: 'Rack of Lamb',
            description: 'Herb-crusted rack of lamb with rosemary jus and seasonal vegetables',
            priceCents: 3299,
            prepTimeSeconds: 1800,
            imageUrl: 'https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=800&h=600&fit=crop&crop=center'
        },

        // Pasta & Risotto
        {
            categoryId: categoryMap['Pasta & Risotto'],
            sku: 'PAS001',
            name: 'Lobster Ravioli',
            description: 'House-made ravioli filled with lobster and ricotta in a creamy tomato sauce',
            priceCents: 2699,
            prepTimeSeconds: 900,
            imageUrl: 'https://images.unsplash.com/photo-1621996346565-e3dbc353d2e5?w=800&h=600&fit=crop&crop=center'
        },
        {
            categoryId: categoryMap['Pasta & Risotto'],
            sku: 'PAS002',
            name: 'Truffle Risotto',
            description: 'Creamy arborio rice with black truffle, parmesan, and wild mushrooms',
            priceCents: 2299,
            prepTimeSeconds: 1200,
            imageUrl: 'https://images.unsplash.com/photo-1476124369491-e7addf5db371?w=800&h=600&fit=crop&crop=center'
        },
        {
            categoryId: categoryMap['Pasta & Risotto'],
            sku: 'PAS003',
            name: 'Spaghetti Carbonara',
            description: 'Classic Roman pasta with pancetta, eggs, pecorino cheese, and black pepper',
            priceCents: 1999,
            prepTimeSeconds: 600,
            imageUrl: 'https://images.unsplash.com/photo-1621996346565-e3dbc353d2e5?w=800&h=600&fit=crop&crop=center'
        },

        // Pizza
        {
            categoryId: categoryMap['Pizza'],
            sku: 'PIZ001',
            name: 'Margherita Pizza',
            description: 'San Marzano tomatoes, fresh mozzarella, basil, and extra virgin olive oil',
            priceCents: 1899,
            prepTimeSeconds: 900,
            imageUrl: 'https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?w=800&h=600&fit=crop&crop=center'
        },
        {
            categoryId: categoryMap['Pizza'],
            sku: 'PIZ002',
            name: 'Prosciutto & Arugula',
            description: 'White pizza with prosciutto di Parma, arugula, and shaved parmesan',
            priceCents: 2299,
            prepTimeSeconds: 900,
            imageUrl: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=800&h=600&fit=crop&crop=center'
        },
        {
            categoryId: categoryMap['Pizza'],
            sku: 'PIZ003',
            name: 'Quattro Stagioni',
            description: 'Four seasons pizza with artichokes, mushrooms, prosciutto, and olives',
            priceCents: 2499,
            prepTimeSeconds: 900,
            imageUrl: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=800&h=600&fit=crop&crop=center'
        },

        // Desserts
        {
            categoryId: categoryMap['Desserts'],
            sku: 'DES001',
            name: 'Tiramisu',
            description: 'Classic Italian dessert with espresso-soaked ladyfingers and mascarpone',
            priceCents: 899,
            prepTimeSeconds: 300,
            imageUrl: 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=800&h=600&fit=crop&crop=center'
        },
        {
            categoryId: categoryMap['Desserts'],
            sku: 'DES002',
            name: 'Chocolate Lava Cake',
            description: 'Warm chocolate cake with molten center, served with vanilla ice cream',
            priceCents: 999,
            prepTimeSeconds: 600,
            imageUrl: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=800&h=600&fit=crop&crop=center'
        },
        {
            categoryId: categoryMap['Desserts'],
            sku: 'DES003',
            name: 'Crème Brûlée',
            description: 'Vanilla custard with caramelized sugar and fresh berries',
            priceCents: 799,
            prepTimeSeconds: 300,
            imageUrl: 'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=800&h=600&fit=crop&crop=center'
        },

        // Beverages
        {
            categoryId: categoryMap['Beverages'],
            sku: 'BEV001',
            name: 'Fresh Orange Juice',
            description: 'Freshly squeezed orange juice',
            priceCents: 499,
            prepTimeSeconds: 60,
            imageUrl: 'https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=800&h=600&fit=crop&crop=center'
        },
        {
            categoryId: categoryMap['Beverages'],
            sku: 'BEV002',
            name: 'Italian Soda',
            description: 'Choice of flavors: raspberry, peach, or vanilla',
            priceCents: 399,
            prepTimeSeconds: 60,
            imageUrl: 'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=800&h=600&fit=crop&crop=center'
        },
        {
            categoryId: categoryMap['Beverages'],
            sku: 'BEV003',
            name: 'Espresso',
            description: 'Single shot of premium Italian espresso',
            priceCents: 299,
            prepTimeSeconds: 120,
            imageUrl: 'https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?w=800&h=600&fit=crop&crop=center'
        },

        // Wine & Cocktails
        {
            categoryId: categoryMap['Wine & Cocktails'],
            sku: 'WIN001',
            name: 'Chianti Classico',
            description: '2019 Chianti Classico, Tuscany - Full-bodied red wine',
            priceCents: 1299,
            prepTimeSeconds: 60,
            imageUrl: 'https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?w=800&h=600&fit=crop&crop=center'
        },
        {
            categoryId: categoryMap['Wine & Cocktails'],
            sku: 'WIN002',
            name: 'Pinot Grigio',
            description: '2020 Pinot Grigio, Veneto - Crisp and refreshing white wine',
            priceCents: 1199,
            prepTimeSeconds: 60,
            imageUrl: 'https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?w=800&h=600&fit=crop&crop=center'
        },
        {
            categoryId: categoryMap['Wine & Cocktails'],
            sku: 'COCK001',
            name: 'Negroni',
            description: 'Classic Italian cocktail with gin, Campari, and sweet vermouth',
            priceCents: 1299,
            prepTimeSeconds: 180,
            imageUrl: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=800&h=600&fit=crop&crop=center'
        },

        // Additional Appetizers
        {
            categoryId: categoryMap['Appetizers'],
            sku: 'APP004',
            name: 'Charcuterie Board',
            description: 'Artisanal cured meats, aged cheeses, fig jam, and grilled focaccia',
            priceCents: 1899,
            prepTimeSeconds: 600,
            imageUrl: 'https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=800&h=600&fit=crop&crop=center'
        },
        {
            categoryId: categoryMap['Appetizers'],
            sku: 'APP005',
            name: 'Stuffed Portobello',
            description: 'Roasted portobello mushroom filled with ricotta, spinach, and pine nuts',
            priceCents: 1499,
            prepTimeSeconds: 900,
            imageUrl: 'https://images.unsplash.com/photo-1447078806655-40579c2520d6?w=800&h=600&fit=crop&crop=center'
        },

        // Additional Soups & Salads
        {
            categoryId: categoryMap['Soups & Salads'],
            sku: 'SOU002',
            name: 'Roasted Tomato Soup',
            description: 'Fire-roasted tomatoes blended with basil cream and served with grilled sourdough',
            priceCents: 1199,
            prepTimeSeconds: 540,
            imageUrl: 'https://images.unsplash.com/photo-1447078806655-40579c2520d6?w=800&h=600&fit=crop&crop=center'
        },
        {
            categoryId: categoryMap['Soups & Salads'],
            sku: 'SAL003',
            name: 'Harvest Quinoa Salad',
            description: 'Tri-color quinoa, roasted squash, cranberries, toasted pepitas, and citrus vinaigrette',
            priceCents: 1499,
            prepTimeSeconds: 420,
            imageUrl: 'https://images.unsplash.com/photo-1505253758473-96b7015fcd40?w=800&h=600&fit=crop&crop=center'
        },

        // Additional Main Courses
        {
            categoryId: categoryMap['Main Courses'],
            sku: 'MAIN005',
            name: 'Braised Short Ribs',
            description: 'Red-wine braised beef short ribs with parmesan polenta and roasted carrots',
            priceCents: 3499,
            prepTimeSeconds: 2400,
            imageUrl: 'https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?w=800&h=600&fit=crop&crop=center'
        },
        {
            categoryId: categoryMap['Main Courses'],
            sku: 'MAIN006',
            name: 'Seared Scallops',
            description: 'Day-boat scallops with saffron risotto, grilled asparagus, and citrus beurre blanc',
            priceCents: 3799,
            prepTimeSeconds: 1500,
            imageUrl: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&h=600&fit=crop&crop=center'
        },
        {
            categoryId: categoryMap['Main Courses'],
            sku: 'MAIN007',
            name: 'Eggplant Parmesan',
            description: 'Crisp eggplant cutlets layered with basil marinara, mozzarella, and ricotta',
            priceCents: 2299,
            prepTimeSeconds: 1500,
            imageUrl: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&h=600&fit=crop&crop=center'
        },

        // Additional Pasta
        {
            categoryId: categoryMap['Pasta & Risotto'],
            sku: 'PAS004',
            name: 'Pesto Gnocchi',
            description: 'Hand-made potato gnocchi tossed in basil pesto, blistered cherry tomatoes, and pecorino',
            priceCents: 2099,
            prepTimeSeconds: 780,
            imageUrl: 'https://images.unsplash.com/photo-1475090169767-40ed8d18f67d?w=800&h=600&fit=crop&crop=center'
        },
        {
            categoryId: categoryMap['Pasta & Risotto'],
            sku: 'PAS005',
            name: 'Seafood Linguine',
            description: 'Linguine with shrimp, mussels, calamari, and roasted garlic-tomato broth',
            priceCents: 2799,
            prepTimeSeconds: 1020,
            imageUrl: 'https://images.unsplash.com/photo-1475090169767-40ed8d18f67d?w=800&h=600&fit=crop&crop=center'
        },

        // Additional Pizza
        {
            categoryId: categoryMap['Pizza'],
            sku: 'PIZ004',
            name: 'Diavola Pizza',
            description: 'Spicy soppressata, mozzarella, chili oil, and charred peppers on a blistered crust',
            priceCents: 2099,
            prepTimeSeconds: 900,
            imageUrl: 'https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?w=800&h=600&fit=crop&crop=center'
        },
        {
            categoryId: categoryMap['Pizza'],
            sku: 'PIZ005',
            name: 'Wild Mushroom Truffle Pizza',
            description: 'White sauce, roasted wild mushrooms, taleggio, arugula, and truffle oil',
            priceCents: 2399,
            prepTimeSeconds: 900,
            imageUrl: 'https://images.unsplash.com/photo-1542281286-9e0a16bb7366?w=800&h=600&fit=crop&crop=center'
        },

        // Additional Desserts
        {
            categoryId: categoryMap['Desserts'],
            sku: 'DES004',
            name: 'Pistachio Cannoli',
            description: 'Crisp cannoli shells with sweet ricotta, pistachios, and candied orange peel',
            priceCents: 899,
            prepTimeSeconds: 300,
            imageUrl: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&h=600&fit=crop&crop=center'
        },
        {
            categoryId: categoryMap['Desserts'],
            sku: 'DES005',
            name: 'Gelato Trio',
            description: 'Three scoops of house-made gelato with almond tuile and seasonal fruit',
            priceCents: 999,
            prepTimeSeconds: 240,
            imageUrl: 'https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=800&h=600&fit=crop&crop=center'
        },

        // Additional Beverages
        {
            categoryId: categoryMap['Beverages'],
            sku: 'BEV004',
            name: 'Cold Brew Tonic',
            description: 'Slow-steeped cold brew coffee poured over citrus tonic and a twist of grapefruit',
            priceCents: 599,
            prepTimeSeconds: 120,
            imageUrl: 'https://images.unsplash.com/photo-1464306076886-da185f6a9d12?w=800&h=600&fit=crop&crop=center'
        },
        {
            categoryId: categoryMap['Beverages'],
            sku: 'BEV005',
            name: 'Yuzu Sparkler',
            description: 'Yuzu puree, mint, sparkling water, and a hint of agave',
            priceCents: 699,
            prepTimeSeconds: 180,
            imageUrl: 'https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=800&h=600&fit=crop&crop=center'
        },
        {
            categoryId: categoryMap['Beverages'],
            sku: 'BEV006',
            name: 'Matcha Oat Latte',
            description: 'Ceremonial grade matcha whisked with steamed oat milk and wildflower honey',
            priceCents: 649,
            prepTimeSeconds: 180,
            imageUrl: 'https://images.unsplash.com/photo-1505253216365-512a012d0185?w=800&h=600&fit=crop&crop=center'
        },

        // Additional Wine & Cocktails
        {
            categoryId: categoryMap['Wine & Cocktails'],
            sku: 'COCK002',
            name: 'Aperol Spritz',
            description: 'Aperol, prosecco, soda, and orange slice served over ice',
            priceCents: 1199,
            prepTimeSeconds: 120,
            imageUrl: 'https://images.unsplash.com/photo-1510626176961-4b57d4fbad03?w=800&h=600&fit=crop&crop=center'
        },
        {
            categoryId: categoryMap['Wine & Cocktails'],
            sku: 'COCK003',
            name: 'Espresso Martini',
            description: 'Vodka, espresso, coffee liqueur, and vanilla syrup shaken to a silky foam',
            priceCents: 1399,
            prepTimeSeconds: 240,
            imageUrl: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&h=600&fit=crop&crop=center'
        }
    ];

    const existingItems = await MenuItem.findAll({ attributes: ['sku'], raw: true });
    const existingSkuSet = new Set(existingItems.map(item => item.sku));

    let createdCount = 0;
    let skippedCount = 0;

    for (const itemData of menuItems) {
        if (existingSkuSet.has(itemData.sku)) {
            console.log(`⚠️  Skipping existing SKU ${itemData.sku}`);
            skippedCount += 1;
            continue;
        }

        await MenuItem.create(itemData);
        createdCount += 1;
    }

    console.log(`✅ Menu items seeded successfully (created: ${createdCount}, skipped: ${skippedCount})`);
};

export const down = async () => {
    const { MenuItem } = models;
    
    await MenuItem.destroy({ where: {} });
    
    console.log('✅ Menu items unseeded successfully');
};
