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
    const CLEAR_EXISTING = true;
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

          // Create menu item
          await prisma.menuItem.create({
            data: {
              name: item.Name.trim(),
              description: item.Description ? item.Description.trim() : null,
              price,
              category: 'Main',
              available: true,
              hot: false,
              buttery: item['Residential College'] || null,
            },
          });

          successCount++;

          // Progress indicator every 100 items
          if (successCount % 100 === 0) {
            console.log(`✓ Inserted ${successCount} items...`);
          }
        } catch {
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
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seed();
