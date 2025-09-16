import { db } from '../config/database';
import { readFileSync } from 'fs';
import { join } from 'path';

async function runMigration(filename: string) {
  try {
    console.log(`Running migration: ${filename}`);

    const migrationPath = join(__dirname, '../../migrations', filename);
    const sql = readFileSync(migrationPath, 'utf8');

    await db.query(sql);
    console.log(`✅ Migration ${filename} completed successfully`);
  } catch (error) {
    console.error(`❌ Migration ${filename} failed:`, error);
    throw error;
  }
}

// Run specific migration
const migrationFile = process.argv[2];
if (!migrationFile) {
  console.error('Please specify a migration file');
  process.exit(1);
}

runMigration(migrationFile)
  .then(() => {
    console.log('Migration completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });