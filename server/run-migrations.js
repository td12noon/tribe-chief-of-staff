const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database configuration - support Railway DATABASE_URL
const dbConfig = process.env.DATABASE_URL 
  ? {
      connectionString: process.env.DATABASE_URL,
    }
  : {
      host: process.env.PGHOST || process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.PGPORT || process.env.DB_PORT || '5432'),
      database: process.env.PGDATABASE || process.env.DB_NAME || 'tribe_chief_of_staff',
      user: process.env.PGUSER || process.env.DB_USER || 'postgres',
      password: process.env.PGPASSWORD || process.env.DB_PASSWORD || 'postgres',
    };

const db = new Pool(dbConfig);

async function runMigration(filename) {
  try {
    console.log(`Running migration: ${filename}`);
    
    const migrationPath = path.join(__dirname, 'migrations', filename);
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    await db.query(sql);
    console.log(`✅ Migration ${filename} completed successfully`);
  } catch (error) {
    console.error(`❌ Migration ${filename} failed:`, error.message);
    throw error;
  }
}

async function runAllMigrations() {
  try {
    console.log('🚀 Starting database migrations...');
    
    // Run migrations in order
    const migrations = [
      '001_initial_schema.sql',
      '002_add_users_table.sql', 
      '003_add_entities_tables.sql',
      '004_enhanced_entity_resolution.sql'
    ];
    
    for (const migration of migrations) {
      await runMigration(migration);
    }
    
    console.log('🎉 All migrations completed successfully!');
  } catch (error) {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  } finally {
    await db.end();
  }
}

runAllMigrations();
