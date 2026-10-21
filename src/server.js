import http from 'http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { initRedis } from './config/redis.js';
import { initSocketIO } from './realtime/socket.js';
import { startLockCleanupInterval } from './jobs/cleanupLocks.js';
import { autoSeedIfEmpty } from './config/seedData.js';
import { logger } from './core/logger/index.js';

const startServer = async () => {
  try {
    // Connect to database
    await connectDatabase();

    // Auto-seed initial data if collections are empty
    await autoSeedIfEmpty();

    // Initialize Redis / Cache
    initRedis();

    // Create Express application
    const app = createApp();
    const server = http.createServer(app);

    // Initialize Real-time Socket.IO
    initSocketIO(server);

    // Start background cleanup worker
    const cleanupTimer = startLockCleanupInterval(30000);

    // Start HTTP listening
    server.listen(env.PORT, () => {
      logger.info({ port: env.PORT, env: env.NODE_ENV }, `🚀 Home Services Marketplace API running on http://localhost:${env.PORT}${env.API_PREFIX}`);
    });

    // Graceful shutdown
    const shutdown = async (signal) => {
      logger.info({ signal }, 'Shutting down gracefully...');
      clearInterval(cleanupTimer);

      server.close(async () => {
        logger.info('HTTP server closed');
        await disconnectDatabase();
        process.exit(0);
      });

      // Force exit if not terminated within 10s
      setTimeout(() => {
        logger.error('Forced shutdown due to timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    return server;
  } catch (err) {
    logger.fatal({ error: err.message, stack: err.stack }, 'Fatal error during server startup');
    process.exit(1);
  }
};

startServer();
