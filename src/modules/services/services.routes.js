import { Router } from 'express';
import { Service } from './service.model.js';
import { Booking } from '../bookings/booking.model.js';
import { ProviderProfile } from '../providers/provider.model.js';
import { authenticate } from '../../core/middlewares/auth.js';
import { authorize } from '../../core/middlewares/authorize.js';

const router = Router();

// Public: Get services by category or provider
router.get('/', async (req, res, next) => {
  try {
    const { categoryId, providerId, priceType } = req.query;
    const filter = { isActive: true };
    if (categoryId) filter.categoryId = categoryId;
    if (providerId) filter.providerId = providerId;
    if (priceType) filter.priceType = priceType;

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

// Public: Get most demanded services ranked by real database bookings count & popularity
router.get('/popular', async (req, res, next) => {
  try {
    // MongoDB Aggregation: calculate real booking counts per service
    const popularAgg = await Booking.aggregate([
      { $match: { status: { $nin: ['CANCELLED_BY_CLIENT', 'CANCELLED_BY_PROVIDER', 'PAYMENT_FAILED', 'REJECTED'] } } },
      { $group: { _id: '$serviceId', bookingCount: { $sum: 1 } } },
      { $sort: { bookingCount: -1 } },
      { $limit: 12 }
    ]);

    const serviceIds = popularAgg.map(p => p._id).filter(Boolean);
    let services = [];
    if (serviceIds.length > 0) {
      services = await Service.find({ _id: { $in: serviceIds }, isActive: true })
        .populate('categoryId', 'name slug icon')
        .populate('providerId', 'fullName avatarUrl phone businessName');
    }

    const countMap = new Map(popularAgg.map(p => [p._id?.toString(), p.bookingCount]));
    let result = services.map(s => {
      const obj = s.toObject();
      obj.bookingCount = countMap.get(s._id.toString()) || 0;
      return obj;
    });

    result.sort((a, b) => (b.bookingCount || 0) - (a.bookingCount || 0));

    // If fewer than 8, backfill with other active services
    if (result.length < 8) {
      const excludeIds = result.map(s => s._id);
      const backfill = await Service.find({ _id: { $nin: excludeIds }, isActive: true })
        .populate('categoryId', 'name slug icon')
        .populate('providerId', 'fullName avatarUrl phone businessName')
        .limit(8 - result.length)
        .sort({ createdAt: -1 });

      result = [...result, ...backfill.map(b => ({ ...b.toObject(), bookingCount: 0 }))];
    }

    res.json({ success: true, data: result });
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

