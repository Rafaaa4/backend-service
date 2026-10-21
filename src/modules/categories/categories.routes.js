import { Router } from 'express';
import { Category } from './category.model.js';
import { authenticate } from '../../core/middlewares/auth.js';
import { authorize } from '../../core/middlewares/authorize.js';

const router = Router();

// Public: List active categories
router.get('/', async (req, res, next) => {
  try {
    const categories = await Category.find({ isActive: true }).sort({ order: 1, name: 1 });
    res.json({ success: true, data: categories });
  } catch (err) {
    next(err);
  }
});

// Admin: Create category
router.post('/', authenticate, authorize('admin', 'superadmin'), async (req, res, next) => {
  try {
    const category = await Category.create(req.body);
    res.status(201).json({ success: true, data: category });
  } catch (err) {
    next(err);
  }
});

export default router;
