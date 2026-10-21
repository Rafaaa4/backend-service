import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(5000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  API_PREFIX: z.string().default('/api/v1'),
  CORS_ORIGIN: z.string().default('*'),
  MONGODB_URI: z.string().default('mongodb://localhost:27017/homeservices?directConnection=true'),
  REDIS_URL: z.string().optional().default('redis://localhost:6379'),
  JWT_ACCESS_SECRET: z.string().min(32).default('c8f8b398df98e21a3674d8120be876b0d91238475a91b2c3d4e5f60718293a4b'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_SECRET: z.string().min(32).default('7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  TWO_FACTOR_APP_NAME: z.string().default('Home Services TN'),
  PAYMENT_WEBHOOK_SECRET: z.string().default('whsec_homeservices_secret_9948203912'),
  MOCK_PAYMENT_AUTO_CONFIRM: z.coerce.boolean().default(false),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(300),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('❌ Invalid environment variables:', parsedEnv.error.format());
  process.exit(1);
}

export const env = parsedEnv.data;
