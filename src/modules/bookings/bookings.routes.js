import { Router } from 'express';
import { z } from 'zod';
import { BookingsService } from './bookings.service.js';
import { authenticate } from '../../core/middlewares/auth.js';
import { validate } from '../../core/middlewares/validate.js';
import { bookingCreationLimiter } from '../../core/middlewares/rateLimiter.js';

const router = Router();

router.use(authenticate);

const createBookingSchema = z.object({
  providerId: z.string().min(1, 'Provider ID is required'),
  serviceId: z.string().min(1, 'Service ID is required'),
  startAt: z.string().datetime({ message: 'Valid ISO datetime startAt is required' }),
  address: z.object({
    street: z.string().min(2, 'Street address is required'),
    city: z.string().default('Tunis'),
    coordinates: z.array(z.number()).length(2).optional()
  }),
  clientNotes: z.string().optional()
}).strict();

// Create booking (Atomic lock)
router.post('/', bookingCreationLimiter, validate(createBookingSchema), async (req, res, next) => {
  try {
    const idempotencyKey = req.headers['idempotency-key'];
    const booking = await BookingsService.createBooking({
      clientId: req.user._id,
      ...req.body,
      idempotencyKey
    });

    res.status(201).json({ success: true, data: booking });
  } catch (err) {
    next(err);
  }
});

// List bookings for current user
router.get('/me', async (req, res, next) => {
  try {
    const { status, limit, page } = req.query;
    const result = await BookingsService.listUserBookings(req.user._id, req.user.role, {
      status,
      limit,
      page
    });

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// Get single booking
router.get('/:id', async (req, res, next) => {
  try {
    const booking = await BookingsService.getBookingById(req.params.id, req.user._id, req.user.role);
    res.json({ success: true, data: booking });
  } catch (err) {
    next(err);
  }
});

// Provider: Accept booking
router.patch('/:id/accept', async (req, res, next) => {
  try {
    const booking = await BookingsService.transitionStatus({
      bookingId: req.params.id,
      targetStatus: 'CONFIRMED',
      actorId: req.user._id,
      actorRole: req.user.role,
      reason: req.body.reason || 'Accepted by provider'
    });

    res.json({ success: true, data: booking });
  } catch (err) {
    next(err);
  }
});

// Provider: Reject booking
router.patch('/:id/reject', async (req, res, next) => {
  try {
    const booking = await BookingsService.transitionStatus({
      bookingId: req.params.id,
      targetStatus: 'REJECTED',
      actorId: req.user._id,
      actorRole: req.user.role,
      reason: req.body.reason || 'Declined by provider'
    });

    res.json({ success: true, data: booking });
  } catch (err) {
    next(err);
  }
});

// Provider: Start mission
router.patch('/:id/start', async (req, res, next) => {
  try {
    const booking = await BookingsService.transitionStatus({
      bookingId: req.params.id,
      targetStatus: 'IN_PROGRESS',
      actorId: req.user._id,
      actorRole: req.user.role,
      reason: 'Mission started'
    });

    res.json({ success: true, data: booking });
  } catch (err) {
    next(err);
  }
});

// Provider: Complete mission
router.patch('/:id/complete', async (req, res, next) => {
  try {
    const booking = await BookingsService.transitionStatus({
      bookingId: req.params.id,
      targetStatus: 'COMPLETED',
      actorId: req.user._id,
      actorRole: req.user.role,
      reason: 'Service completed successfully'
    });

    res.json({ success: true, data: booking });
  } catch (err) {
    next(err);
  }
});

// Client / Provider: Cancel booking
router.patch('/:id/cancel', async (req, res, next) => {
  try {
    const targetStatus = req.user.role === 'provider' ? 'CANCELLED_BY_PROVIDER' : 'CANCELLED_BY_CLIENT';
    const booking = await BookingsService.transitionStatus({
      bookingId: req.params.id,
      targetStatus,
      actorId: req.user._id,
      actorRole: req.user.role,
      reason: req.body.reason || 'Cancelled by user'
    });

    res.json({ success: true, data: booking });
  } catch (err) {
    next(err);
  }
});

export default router;
