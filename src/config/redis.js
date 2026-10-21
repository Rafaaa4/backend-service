import Redis from 'ioredis';
import { env } from './env.js';
import { logger } from '../core/logger/index.js';

class InMemoryCache {
  constructor() {
    this.store = new Map();
    this.ttls = new Map();
  }

  async get(key) {
    if (this.ttls.has(key) && Date.now() > this.ttls.get(key)) {
      this.store.delete(key);
      this.ttls.delete(key);
      return null;
    }
    return this.store.get(key) || null;
  }

  async set(key, value, exMode, ttlSeconds) {
    this.store.set(key, value);
    if (exMode === 'EX' && ttlSeconds) {
      this.ttls.set(key, Date.now() + ttlSeconds * 1000);
    }
    return 'OK';
  }

  async del(key) {
    this.ttls.delete(key);
    return this.store.delete(key) ? 1 : 0;
  }

  async incr(key) {
    const val = (parseInt(this.store.get(key) || '0', 10) + 1).toString();
    this.store.set(key, val);
    return parseInt(val, 10);
  }

  async expire(key, seconds) {
    this.ttls.set(key, Date.now() + seconds * 1000);
    return 1;
  }
}

let redisClient = null;
let isRedisAvailable = false;

export const initRedis = () => {
  if (process.env.NODE_ENV === 'test') {
    return new InMemoryCache();
  }

  try {
    const client = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      retryStrategy: () => null, // don't hang if redis is down
      lazyConnect: true
    });

    client.on('error', (err) => {
      if (!isRedisAvailable) {
        logger.warn({ error: err.message }, 'Redis server not reachable, using in-memory cache fallback');
      }
    });

    client.connect()
      .then(() => {
        isRedisAvailable = true;
        logger.info('Connected to Redis');
      })
      .catch(() => {
        logger.warn('Could not establish Redis connection. Using In-Memory Cache fallback');
      });

    redisClient = client;
    return client;
  } catch {
    logger.warn('Redis client initialization failed. Falling back to in-memory store');
    return new InMemoryCache();
  }
};

export const getCacheClient = () => {
  if (isRedisAvailable && redisClient) {
    return redisClient;
  }
  return new InMemoryCache();
};
