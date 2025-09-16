import dotenv from 'dotenv';
import path from 'path';

// Load environment variables FIRST
dotenv.config();

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

// API routes
app.use('/api', (req, res, next) => {
  console.log(`${req.method} ${req.path}`, req.body || req.query);
  next();
});

// Routes
app.use('/auth', authRoutes);
app.use('/api/calendar', calendarRoutes);
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
      // TODO: Initialize database connections when Docker is available
      // await initializeDatabase();

      // TODO: Schedule daily brief jobs when database is ready
      // scheduleDailyBriefs();

      console.log('⚠️  Running without database (Docker not available)');

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