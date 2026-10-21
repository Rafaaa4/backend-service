import { Router } from 'express';
import { AuthController } from './auth.controller.js';
import { validate } from '../../core/middlewares/validate.js';
import { authenticate } from '../../core/middlewares/auth.js';
import { authLimiter } from '../../core/middlewares/rateLimiter.js';
import {
  registerSchema,
  loginSchema,
  refreshSchema,
  verifyTotpSchema
} from './auth.schemas.js';

const router = Router();

router.post('/register', authLimiter, validate(registerSchema), AuthController.register);
router.post('/login', authLimiter, validate(loginSchema), AuthController.login);
router.post('/refresh', authLimiter, validate(refreshSchema), AuthController.refresh);

// Authenticated routes
router.post('/logout', authenticate, AuthController.logout);
router.post('/logout-all', authenticate, AuthController.logoutAll);
router.post('/2fa/setup', authenticate, AuthController.setup2fa);
router.post('/2fa/enable', authenticate, validate(verifyTotpSchema), AuthController.enable2fa);

export default router;
