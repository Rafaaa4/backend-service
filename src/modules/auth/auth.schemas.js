import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email('Valid email is required'),
  password: z.string().min(10, 'Password must be at least 10 characters long'),
  fullName: z.string().min(2, 'Full name is required'),
  phone: z.string().optional(),
  role: z.enum(['client', 'provider']).default('client'),
  address: z.object({
    street: z.string().optional(),
    city: z.string().default('Tunis'),
    coordinates: z.array(z.number()).length(2).optional() // [lng, lat]
  }).optional()
}).strict();

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  totpCode: z.string().length(6).optional(),
  deviceId: z.string().optional()
}).strict();

export const refreshSchema = z.object({
  refreshToken: z.string().min(32, 'Valid refresh token is required')
}).strict();

export const verifyTotpSchema = z.object({
  totpCode: z.string().length(6, 'TOTP code must be 6 digits')
}).strict();
