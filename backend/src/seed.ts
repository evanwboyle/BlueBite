import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface YaleMenuItem {
  Name: string;
  Description: string;
  Price: string;
  Category: string;
  'Residential College': string;
}

// Categories that are typically hot/served warm
const HOT_CATEGORIES = new Set([
  'Main',
  'Entree',
  'Entrees',
  'Pizza',
  'Sandwich',
  'Sandwiches',
  'Burger',
  'Burgers',
  'Chicken',
  'Hot Dog',
  'Hot Dogs',
  'Sides',
  'Side',
  'Snack',
  'Snacks',
  'Appetizer',
  'Appetizers',
  'Wings',
  'Fried',
  'Fried Foods',
  'Hot Entrée',
  'Hot Entrees',
  'Hot Items',
  'Pasta',
  'Noodles',
  'Asian',
  'Mexican',
  'Tacos',
  'Burritos',
  'Quesadilla',
  'Quesadillas',
  'Fries',
  'Fried Chicken',
  'Nuggets',
  'Tenders',
]);

function determineIfHot(category: string): boolean {
  // Check if category (case-insensitive) matches hot categories
  return Array.from(HOT_CATEGORIES).some(
    hotCat => category.toLowerCase().includes(hotCat.toLowerCase())
  );
}

function standardizeCategory(category: string): string {
  const normalized = category.toLowerCase().trim();

  // Standardize to broader categories
  if (HOT_CATEGORIES.has(category) || normalized.includes('main') ||
      normalized.includes('entree') || normalized.includes('sandwich') ||
      normalized.includes('pizza') || normalized.includes('burger') ||
      normalized.includes('chicken') || normalized.includes('hot dog') ||
      normalized.includes('fries') || normalized.includes('wings') ||
      normalized.includes('taco') || normalized.includes('burrito') ||
      normalized.includes('quesadilla') || normalized.includes('nugget') ||
      normalized.includes('tender') || normalized.includes('pasta') ||
      normalized.includes('noodle') || normalized.includes('asian') ||
      normalized.includes('mexican') || normalized.includes('fried')) {
    return 'Main';
  }

  if (normalized.includes('salad') || normalized.includes('lettuce')) {
    return 'Salad';
  }

  if (normalized.includes('side') || normalized.includes('fries')) {
    return 'Side';
  }

  if (normalized.includes('drink') || normalized.includes('beverage') ||
      normalized.includes('soda') || normalized.includes('juice') ||
      normalized.includes('water') || normalized.includes('coffee') ||
      normalized.includes('tea') || normalized.includes('milk')) {
    return 'Drinks';
  }

  if (normalized.includes('dessert') || normalized.includes('sweet') ||
      normalized.includes('cookie') || normalized.includes('brownie') ||
      normalized.includes('cake') || normalized.includes('ice cream') ||
      normalized.includes('chocolate')) {
    return 'Dessert';
  }

  if (normalized.includes('snack') || normalized.includes('appetizer')) {
    return 'Snack';
  }

  // Default category
  return 'Main';
}

async function seed() {
  try {
    console.log('🌱 Starting database seed...');

    // Read yalemenus.json
    const filePath = path.join('/Users/evanboyle/Downloads', 'yalemenus.json');

    if (!fs.existsSync(filePath)) {
      console.error(`❌ File not found: ${filePath}`);
      process.exit(1);
    }

    const rawData = fs.readFileSync(filePath, 'utf-8');
    const yaleItems: YaleMenuItem[] = JSON.parse(rawData);

    console.log(`📖 Loaded ${yaleItems.length} items from yalemenus.json`);

    // Clear existing menu items (optional - set to false to append)
    const CLEAR_EXISTING = false;
    if (CLEAR_EXISTING) {
      await prisma.menuItem.deleteMany({});
      console.log('🗑️  Cleared existing menu items');
    }

    // Transform and insert items in batches
    const BATCH_SIZE = 50;
    let successCount = 0;
    let skipCount = 0;

    for (let i = 0; i < yaleItems.length; i += BATCH_SIZE) {
      const batch = yaleItems.slice(i, i + BATCH_SIZE);

      for (const item of batch) {
        try {
          // Validate required fields
          if (!item.Name || !item.Price || !item.Category) {
            skipCount++;
            continue;
          }

          // Parse price
          const price = parseFloat(item.Price);
          if (isNaN(price) || price < 0) {
            skipCount++;
            continue;
          }

          // Determine if hot/cold
          const hot = determineIfHot(item.Category);
          const category = standardizeCategory(item.Category);

          // Create menu item
          await prisma.menuItem.create({
            data: {
              name: item.Name.trim(),
              description: item.Description ? item.Description.trim() : null,
              price,
              category,
              available: true,
              hot,
            },
          });

          successCount++;

          // Progress indicator every 100 items
          if (successCount % 100 === 0) {
            console.log(`✓ Inserted ${successCount} items...`);
          }
        } catch (error) {
          // Silently skip duplicate or other errors
          skipCount++;
        }
      }

      // Small delay between batches to avoid overwhelming database
      if (i + BATCH_SIZE < yaleItems.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log(`\n✅ Seed completed!`);
    console.log(`   ✓ Successfully inserted: ${successCount} items`);
    console.log(`   ⊘ Skipped (invalid/duplicate): ${skipCount} items`);

    // Show category distribution
    const categoryStats = await prisma.menuItem.groupBy({
      by: ['category'],
      _count: true,
    });

    console.log(`\n📊 Items by category:`);
    categoryStats.forEach(stat => {
      console.log(`   ${stat.category}: ${stat._count}`);
    });

    // Show hot/cold distribution
    const hotStats = await prisma.menuItem.groupBy({
      by: ['hot'],
      _count: true,
    });

    console.log(`\n🔥 Hot/Cold distribution:`);
    hotStats.forEach(stat => {
      console.log(`   ${stat.hot ? '🔥 Hot' : '❄️  Cold'}: ${stat._count}`);
    });
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seed();
