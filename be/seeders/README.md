# Database Seeders

This directory contains database seeders for populating the application with dummy data.

## Overview

The seeders create a complete restaurant setup with:

- **Users**: Restaurant owner and manager accounts
- **Restaurant**: "Bella Vista Restaurant" with 8 tables
- **Menu Categories**: 8 categories (Appetizers, Soups & Salads, Main Courses, etc.)
- **Menu Items**: 25+ items with high-quality food images from Unsplash
- **Sample Orders**: 2 sample orders with order items

## Food Images

All menu items include high-quality food images sourced from Unsplash:
- Appetizers: Bruschetta, Calamari, Burrata
- Main Courses: Grilled Salmon, Beef Tenderloin, Chicken Marsala, Rack of Lamb
- Pasta: Lobster Ravioli, Truffle Risotto, Spaghetti Carbonara
- Pizza: Margherita, Prosciutto & Arugula, Quattro Stagioni
- Desserts: Tiramisu, Chocolate Lava Cake, Crème Brûlée
- Beverages: Fresh juices, Italian sodas, espresso
- Wine & Cocktails: Chianti, Pinot Grigio, Negroni

## Usage

### Run All Seeders
```bash
npm run seed
```

### Run Individual Seeders
```bash
# Users and credentials
node seeders/001-users.js

# Restaurant and tables
node seeders/002-restaurants.js

# Menu categories
node seeders/003-menu-categories.js

# Menu items with images
node seeders/004-menu-items.js

# Sample orders
node seeders/005-sample-orders.js
```

## Prerequisites

1. Database must be set up and running
2. Environment variables must be configured
3. Run migrations first (if any)

## Default Credentials

- **Owner**: owner@restaurant.com / password: password
- **Manager**: manager@restaurant.com / password: password

## Database Schema

The seeders work with the following models:
- Users (with UserCredentials)
- Restaurants (with RestaurantTables)
- MenuCategories
- MenuItems (with imageUrl field)
- Orders (with OrderItems)
- GuestSessions

## Notes

- All prices are stored in cents (e.g., 1299 = $12.99)
- Prep times are in seconds
- Images are hosted on Unsplash with optimized URLs
- Sample orders include realistic timestamps and statuses
