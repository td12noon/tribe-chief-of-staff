import dotenv from 'dotenv';
import path from 'path';

// Load environment variables FIRST - use root .env file
dotenv.config({ path: path.join(__dirname, '../../.env') });

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import session from 'express-session';

import { initializeDatabase } from './config/database';
import { scheduleDailyBriefs } from './services/queue';
import passport from './config/passport';

// Import routes
import authRoutes from './routes/auth';
import calendarRoutes from './routes/calendar';
import participantRoutes from './routes/participants';
import logbookRoutes from './routes/logbook';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key-here',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Debug endpoint to check environment variables
app.get('/debug/env', (req, res) => {
  const dbVars = {
    PGHOST: process.env.PGHOST,
    PGPORT: process.env.PGPORT,
    PGDATABASE: process.env.PGDATABASE,
    PGUSER: process.env.PGUSER,
    PGPASSWORD: process.env.PGPASSWORD ? 'SET' : 'NOT SET',
    DB_HOST: process.env.DB_HOST,
    DB_PORT: process.env.DB_PORT,
    DB_NAME: process.env.DB_NAME,
    DB_USER: process.env.DB_USER,
    DB_PASSWORD: process.env.DB_PASSWORD ? 'SET' : 'NOT SET',
    REDIS_URL: process.env.REDIS_URL ? 'SET' : 'NOT SET',
    REDIS_HOST: process.env.REDIS_HOST,
    REDIS_PORT: process.env.REDIS_PORT,
    REDIS_PASSWORD: process.env.REDIS_PASSWORD ? 'SET' : 'NOT SET'
  };
  res.json(dbVars);
});

// API routes
app.use('/api', (req, res, next) => {
  console.log(`${req.method} ${req.path}`, req.body || req.query);
  next();
});

// Routes
app.use('/auth', authRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/participants', participantRoutes);
app.use('/api/logbook', logbookRoutes);
// app.use('/api/briefs', briefRoutes);

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

if (require.main === module) {
  const startServer = async () => {
    try {
      // Initialize database connections (non-blocking)
      initializeDatabase().catch((error: any) => {
        console.warn('⚠️ Database connection failed, but server will continue:', error.message);
      });

      // Schedule daily brief jobs (only if database is available)
      try {
        scheduleDailyBriefs();
      } catch (error: any) {
        console.warn('⚠️ Failed to schedule jobs:', error.message);
      }

      app.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT}`);
        console.log(`📊 Health check: http://localhost:${PORT}/health`);
        console.log(`🔐 OAuth login: http://localhost:${PORT}/auth/google`);
      });
    } catch (error) {
      console.error('Failed to start server:', error);
      process.exit(1);
    }
  };

  startServer();
}

export default app;