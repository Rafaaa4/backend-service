import { Router } from 'express';
import { z } from 'zod';
import { ReviewsService } from './reviews.service.js';
import { authenticate } from '../../core/middlewares/auth.js';
import { validate } from '../../core/middlewares/validate.js';

const router = Router();

const createReviewSchema = z.object({
  bookingId: z.string().optional(),
  providerId: z.string().optional(),
  serviceId: z.string().optional(),
  rating: z.number().int().min(1).max(5, 'Rating must be between 1 and 5'),
  comment: z.string().min(3, 'Comment must be at least 3 characters long').max(1000)
}).strict();

// Public: Get reviews for a provider
router.get('/provider/:providerId', async (req, res, next) => {
  try {
    const { limit, page } = req.query;
    const result = await ReviewsService.getProviderReviews(req.params.providerId, {
      limit: limit ? Number(limit) : 20,
      page: page ? Number(page) : 1
    });

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// Public: Get reviews for a specific service
router.get('/service/:serviceId', async (req, res, next) => {
  try {
    const { limit, page } = req.query;
    const result = await ReviewsService.getServiceReviews(req.params.serviceId, {
      limit: limit ? Number(limit) : 20,
      page: page ? Number(page) : 1
    });

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// Authenticated: Client submits review for provider or service or booking
router.post('/', authenticate, validate(createReviewSchema), async (req, res, next) => {
  try {
    const review = await ReviewsService.createReview({
      clientId: req.user._id,
      ...req.body
    });

    res.status(201).json({ success: true, data: review });
  } catch (err) {
    next(err);
  }
});

export default router;

