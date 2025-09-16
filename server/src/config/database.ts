import { Pool } from 'pg';
import { createClient } from 'redis';
import type { DatabaseConfig, RedisConfig } from '../types';

// Database configuration
const dbConfig: DatabaseConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'tribe_chief_of_staff',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
};

// Redis configuration
const redisConfig: RedisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
};

// PostgreSQL pool
export const db = new Pool(dbConfig);

// Redis client
export const redis: any = createClient({
  socket: {
    host: redisConfig.host,
    port: redisConfig.port,
  },
  password: redisConfig.password,
});

// Initialize connections
export const initializeDatabase = async () => {
  try {
    // Test PostgreSQL connection
    const client = await db.connect();
    console.log('✅ PostgreSQL connected successfully');
    client.release();

    // Connect to Redis
    await redis.connect();
    console.log('✅ Redis connected successfully');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    throw error;
  }
};

// Graceful shutdown
export const closeDatabaseConnections = async () => {
  try {
    await db.end();
    await redis.quit();
    console.log('Database connections closed');
  } catch (error) {
    console.error('Error closing database connections:', error);
  }
};

// Handle process termination
process.on('SIGTERM', closeDatabaseConnections);
process.on('SIGINT', closeDatabaseConnections);