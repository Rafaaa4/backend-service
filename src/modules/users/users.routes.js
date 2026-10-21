import { Router } from 'express';
import { UsersController } from './users.controller.js';
import { authenticate } from '../../core/middlewares/auth.js';

const router = Router();

router.use(authenticate);

router.get('/me', UsersController.getMe);
router.patch('/me', UsersController.updateMe);
router.get('/me/sessions', UsersController.getMySessions);
router.delete('/me/sessions/:sessionId', UsersController.revokeSession);

export default router;
