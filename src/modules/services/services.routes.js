import { Router } from 'express';
import { Service } from './service.model.js';
import { ProviderProfile } from '../providers/provider.model.js';
import { authenticate } from '../../core/middlewares/auth.js';
import { authorize } from '../../core/middlewares/authorize.js';

const router = Router();

// Public: Get services by category or provider
router.get('/', async (req, res, next) => {
  try {
    const { categoryId, providerId } = req.query;
    const filter = { isActive: true };
    if (categoryId) filter.categoryId = categoryId;
    if (providerId) filter.providerId = providerId;

    const services = await Service.find(filter)
      .populate('categoryId', 'name slug icon')
      .populate('providerId', 'fullName avatarUrl phone')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: services });
  } catch (err) {
    next(err);
  }
});

// Provider: Get own services
router.get('/me', authenticate, authorize('provider'), async (req, res, next) => {
  try {
    const services = await Service.find({ providerId: req.user._id })
      .populate('categoryId', 'name slug icon')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: services });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const service = await Service.findById(req.params.id)
      .populate('categoryId', 'name slug icon')
      .populate('providerId', 'fullName avatarUrl phone');
    if (!service) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Service not found' } });
    res.json({ success: true, data: service });
  } catch (err) {
    next(err);
  }
});

// Provider & Admin: Create service / work post
router.post('/', authenticate, authorize('provider', 'admin', 'superadmin'), async (req, res, next) => {
  try {
    const data = { ...req.body };
    
    // Automatically link provider
    if (req.user.role === 'provider') {
      data.providerId = req.user._id;
    }

    // Default basePrice if not provided
    if (!data.basePrice) {
      data.basePrice = 30000;
    }

    const service = await Service.create(data);

    // If created by provider, add to their provider profile
    if (req.user.role === 'provider') {
      await ProviderProfile.findOneAndUpdate(
        { userId: req.user._id },
        { 
          $addToSet: { 
            serviceIds: service._id,
            ...(data.categoryId ? { categoryIds: data.categoryId } : {})
          } 
        },
        { upsert: true }
      );
    }

    res.status(201).json({ success: true, data: service });
  } catch (err) {
    next(err);
  }
});

// Provider & Admin: Delete service
router.delete('/:id', authenticate, authorize('provider', 'admin', 'superadmin'), async (req, res, next) => {
  try {
    const filter = { _id: req.params.id };
    if (req.user.role === 'provider') {
      filter.providerId = req.user._id;
    }

    const service = await Service.findOneAndDelete(filter);
    if (!service) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Service not found or unauthorized' } });
    }

    // Remove from ProviderProfile
    if (req.user.role === 'provider') {
      await ProviderProfile.updateOne(
        { userId: req.user._id },
        { $pull: { serviceIds: service._id } }
      );
    }

    res.json({ success: true, message: 'Service supprimé avec succès' });
  } catch (err) {
    next(err);
  }
});

export default router;

