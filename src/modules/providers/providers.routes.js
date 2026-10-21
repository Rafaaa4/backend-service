import { Router } from 'express';
import { ProviderProfile } from './provider.model.js';
import { AvailabilityRule } from '../availability/availability.model.js';
import { AvailabilityService } from '../availability/availability.service.js';
import { authenticate } from '../../core/middlewares/auth.js';
import { authorize } from '../../core/middlewares/authorize.js';
import { NotFoundError, BadRequestError } from '../../core/errors/AppError.js';

const router = Router();

// Public: Search verified providers with optional geo search and category filter
router.get('/', async (req, res, next) => {
  try {
    const { categoryId, lng, lat, maxDistanceKm = 50, limit = 20, page = 1 } = req.query;
    const filter = { verificationStatus: 'VERIFIED' };

    if (categoryId) {
      filter.categoryIds = categoryId;
    }

    if (lng && lat) {
      filter.location = {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(lng), parseFloat(lat)]
          },
          $maxDistance: parseFloat(maxDistanceKm) * 1000 // meters
        }
      };
    }

    const skip = (page - 1) * limit;
    const [providers, total] = await Promise.all([
      ProviderProfile.find(filter)
        .populate('userId', 'fullName avatarUrl phone email')
        .populate('categoryIds', 'name icon slug')
        .populate('serviceIds', 'name basePrice priceType estimatedDurationMinutes')
        .sort({ ratingAvg: -1 })
        .skip(skip)
        .limit(Number(limit)),
      ProviderProfile.countDocuments(filter)
    ]);

    res.json({ success: true, data: { providers, total, page: Number(page), pages: Math.ceil(total / limit) } });
  } catch (err) {
    next(err);
  }
});

// Public: Get provider profile
router.get('/:id', async (req, res, next) => {
  try {
    const provider = await ProviderProfile.findOne({
      $or: [{ _id: req.params.id }, { userId: req.params.id }]
    })
      .populate('userId', 'fullName avatarUrl phone email address')
      .populate('categoryIds', 'name icon slug')
      .populate('serviceIds', 'name basePrice priceType estimatedDurationMinutes');

    if (!provider) throw new NotFoundError('Provider profile not found');

    res.json({ success: true, data: provider });
  } catch (err) {
    next(err);
  }
});

// Public: Get provider availability on date
router.get('/:id/availability', async (req, res, next) => {
  try {
    const { date } = req.query;
    if (!date) throw new BadRequestError('Query param "date" (YYYY-MM-DD) is required');

    // Get userId of provider
    let userId = req.params.id;
    const profile = await ProviderProfile.findOne({
      $or: [{ _id: req.params.id }, { userId: req.params.id }]
    });
    if (profile) userId = profile.userId;

    const result = await AvailabilityService.getAvailableSlots(userId, date);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// Provider: Update own profile
router.patch('/me/profile', authenticate, authorize('provider'), async (req, res, next) => {
  try {
    const allowed = ['businessName', 'bio', 'categoryIds', 'serviceIds', 'serviceRadiusKm', 'hourlyRate', 'location'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    const provider = await ProviderProfile.findOneAndUpdate(
      { userId: req.user._id },
      { $set: updates },
      { new: true, upsert: true }
    );

    res.json({ success: true, data: provider });
  } catch (err) {
    next(err);
  }
});

// Provider: Upload / submit verification documents
router.post('/me/documents', authenticate, authorize('provider'), async (req, res, next) => {
  try {
    const { docType, fileUrl } = req.body;
    if (!docType || !fileUrl) throw new BadRequestError('docType and fileUrl are required');

    const provider = await ProviderProfile.findOneAndUpdate(
      { userId: req.user._id },
      {
        $push: { documents: { docType, fileUrl, status: 'PENDING', uploadedAt: new Date() } },
        $set: { verificationStatus: 'PENDING' }
      },
      { new: true, upsert: true }
    );

    res.json({ success: true, data: provider.documents });
  } catch (err) {
    next(err);
  }
});

// Provider: Set weekly schedule
router.put('/me/availability', authenticate, authorize('provider'), async (req, res, next) => {
  try {
    const { slotDurationMinutes, weeklySchedule, exceptions } = req.body;
    const rule = await AvailabilityRule.findOneAndUpdate(
      { providerId: req.user._id },
      {
        $set: {
          slotDurationMinutes: slotDurationMinutes || 60,
          weeklySchedule: weeklySchedule || [],
          exceptions: exceptions || []
        }
      },
      { new: true, upsert: true }
    );

    res.json({ success: true, data: rule });
  } catch (err) {
    next(err);
  }
});

export default router;
