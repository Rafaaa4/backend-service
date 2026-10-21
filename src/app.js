import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import mongoose from 'mongoose';
import { env } from './config/env.js';
import { requestIdMiddleware } from './core/middlewares/requestId.js';
import { generalLimiter } from './core/middlewares/rateLimiter.js';
import { errorHandler } from './core/middlewares/errorHandler.js';

// Route modules
import authRoutes from './modules/auth/auth.routes.js';
import usersRoutes from './modules/users/users.routes.js';
import categoriesRoutes from './modules/categories/categories.routes.js';
import servicesRoutes from './modules/services/services.routes.js';
import providersRoutes from './modules/providers/providers.routes.js';
import bookingsRoutes from './modules/bookings/bookings.routes.js';
import paymentsRoutes from './modules/payments/payments.routes.js';
import chatRoutes from './modules/chat/chat.routes.js';
import reviewsRoutes from './modules/reviews/reviews.routes.js';
import adminRoutes from './modules/admin/admin.routes.js';

export const createApp = () => {
  const app = express();

  // Trust proxy for Render / Cloudflare / reverse proxy deployments
  app.set('trust proxy', 1);

  // Security Headers
  app.use(helmet({
    contentSecurityPolicy: false, // Flutter Web and SPA compatibility
    crossOriginEmbedderPolicy: false
  }));

  // CORS
  app.use(cors({
    origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(','),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'Idempotency-Key', 'x-signature', 'x-webhook-signature']
  }));

  // Body Parsing with size limits
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: true, limit: '100kb' }));

  // Tracing & Rate Limiting
  app.use(requestIdMiddleware);
  app.use(generalLimiter);

  // Serve static interactive frontend
  app.use(express.static('public'));

  // Health and Readiness Checks (Section 12 & 14)
  app.get('/api/v1/health', (req, res) => {
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      version: '1.0.0'
    });
  });

  app.get('/api/v1/ready', (req, res) => {
    const isMongoReady = mongoose.connection.readyState === 1;
    if (isMongoReady) {
      return res.status(200).json({
        status: 'ready',
        database: 'connected',
        timestamp: new Date().toISOString()
      });
    }
    return res.status(503).json({
      status: 'not_ready',
      database: 'disconnected'
    });
  });

  // Mount API Modules
  const api = express.Router();
  api.use('/auth', authRoutes);
  api.use('/users', usersRoutes);
  api.use('/categories', categoriesRoutes);
  api.use('/services', servicesRoutes);
  api.use('/providers', providersRoutes);
  api.use('/bookings', bookingsRoutes);
  api.use('/payments', paymentsRoutes);
  api.use('/conversations', chatRoutes);
  api.use('/reviews', reviewsRoutes);
  api.use('/admin', adminRoutes);

  app.use(env.API_PREFIX, api);

  // 404 Handler for undefined routes
  app.use((req, res) => {
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: `Route ${req.method} ${req.originalUrl} does not exist`,
        requestId: req.id
      }
    });
  });

  // Centralized Error Handling
  app.use(errorHandler);

  return app;
};
