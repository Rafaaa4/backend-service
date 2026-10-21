import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from '../core/logger/index.js';

let memoryReplSet = null;

export const connectDatabase = async () => {
  try {
    // If running in test or if forced memory DB
    if (process.env.NODE_ENV === 'test' || process.env.USE_MEMORY_DB === 'true') {
      const { MongoMemoryReplSet } = await import('mongodb-memory-server');
      memoryReplSet = await MongoMemoryReplSet.create({
        replSet: { count: 1, storageEngine: 'wiredTiger' }
      });
      const uri = memoryReplSet.getUri();
      await mongoose.connect(uri);
      logger.info('Connected to In-Memory MongoDB Replica Set with Transaction Support');
      return mongoose.connection;
    }

    // Try connecting to provided MONGODB_URI
    mongoose.set('strictQuery', true);
    await mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      autoIndex: true
    });

    logger.info({ uri: env.MONGODB_URI.split('@')[1] || env.MONGODB_URI }, 'Successfully connected to MongoDB');
    return mongoose.connection;
  } catch (err) {
    logger.warn({ error: err.message }, 'Could not connect to external MongoDB. Falling back to embedded In-Memory Replica Set for local development...');
    try {
      const { MongoMemoryReplSet } = await import('mongodb-memory-server');
      memoryReplSet = await MongoMemoryReplSet.create({
        replSet: { count: 1, storageEngine: 'wiredTiger' }
      });
      const uri = memoryReplSet.getUri();
      await mongoose.connect(uri);
      logger.info('Connected to embedded In-Memory MongoDB Replica Set with full Transaction support');
      return mongoose.connection;
    } catch (fallbackErr) {
      logger.error({ error: fallbackErr.message }, 'Failed to start in-memory MongoDB replica set');
      throw fallbackErr;
    }
  }
};

export const disconnectDatabase = async () => {
  try {
    await mongoose.disconnect();
    if (memoryReplSet) {
      await memoryReplSet.stop();
      memoryReplSet = null;
    }
    logger.info('MongoDB disconnected cleanly');
  } catch (err) {
    logger.error({ error: err.message }, 'Error disconnecting MongoDB');
  }
};
