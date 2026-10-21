import { Router } from 'express';
import { Service } from './service.model.js';
import { authenticate } from '../../core/middlewares/auth.js';
import { authorize } from '../../core/middlewares/authorize.js';

const router = Router();

// Public: Get services by category
router.get('/', async (req, res, next) => {
  try {
    const { categoryId } = req.query;
    const filter = { isActive: true };
    if (categoryId) filter.categoryId = categoryId;

    const services = await Service.find(filter).populate('categoryId', 'name slug');
    res.json({ success: true, data: services });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const service = await Service.findById(req.params.id).populate('categoryId', 'name slug');
    if (!service) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Service not found' } });
    res.json({ success: true, data: service });
  } catch (err) {
    next(err);
  }
});

// Admin: Create service
router.post('/', authenticate, authorize('admin', 'superadmin'), async (req, res, next) => {
  try {
    const service = await Service.create(req.body);
    res.status(201).json({ success: true, data: service });
  } catch (err) {
    next(err);
  }
});

export default router;
