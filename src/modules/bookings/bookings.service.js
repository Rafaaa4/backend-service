import mongoose from 'mongoose';
import { Booking } from './booking.model.js';
import { SlotLock } from './slotLock.model.js';
import { Service } from '../services/service.model.js';
import { ProviderProfile } from '../providers/provider.model.js';
import { validateTransition } from './bookingStateMachine.js';
import {
  BadRequestError,
  NotFoundError,
  SlotUnavailableError,
  ForbiddenError
} from '../../core/errors/AppError.js';
import { logger } from '../../core/logger/index.js';

export class BookingsService {
  /**
   * Create a new booking with discrete atomic slot locking inside a MongoDB transaction
   */
  static async createBooking({
    clientId,
    providerId,
    serviceId,
    startAt,
    address,
    clientNotes,
    idempotencyKey
  }) {
    // Check idempotency first if key provided
    if (idempotencyKey) {
      const existing = await Booking.findOne({ idempotencyKey });
      if (existing) {
        return existing;
      }
    }

    // Server-side validation of provider & service
    const service = await Service.findById(serviceId);
    if (!service || !service.isActive) {
      throw new BadRequestError('Requested service is inactive or does not exist');
    }

    const provider = await ProviderProfile.findOne({
      userId: providerId,
      verificationStatus: 'VERIFIED'
    });

    if (!provider) {
      throw new BadRequestError('Provider is not available or not yet verified');
    }

    const start = new Date(startAt);
    if (isNaN(start.getTime()) || start <= new Date()) {
      throw new BadRequestError('Booking start time must be a valid future date');
    }

    const durationMinutes = service.estimatedDurationMinutes || 60;
    const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes hold for payment

    // Pricing calculation (millimes)
    let totalAmount = service.basePrice;
    if (service.priceType === 'hourly') {
      const hours = durationMinutes / 60;
      totalAmount = Math.round(service.basePrice * hours);
    }
    const depositAmount = Math.round((totalAmount * (service.depositPercentage || 20)) / 100);
    const remainingAmount = totalAmount - depositAmount;

    // Discretize into 30 or 60 min slots (here using 30-min granularity for sub-intervals)
    const slotGranularity = 30 * 60 * 1000;
    const slotTimes = [];
    let cur = new Date(start.getTime());
    while (cur < end) {
      slotTimes.push(new Date(cur));
      cur = new Date(cur.getTime() + slotGranularity);
    }

    const session = await mongoose.startSession();
    try {
      let createdBooking = null;

      await session.withTransaction(async () => {
        // Create booking in PENDING_PAYMENT state
        const [booking] = await Booking.create([{
          clientId,
          providerId,
          serviceId,
          startAt: start,
          endAt: end,
          priceSnapshot: {
            unitPrice: service.basePrice,
            durationMinutes,
            totalAmount,
            depositAmount,
            remainingAmount,
            currency: 'TND',
            platformCommissionRate: 0.15
          },
          status: 'PENDING_PAYMENT',
          paymentStatus: 'UNPAID',
          address,
          clientNotes: clientNotes || '',
          idempotencyKey,
          expiresAt,
          history: [{
            fromStatus: 'NONE',
            toStatus: 'PENDING_PAYMENT',
            actorId: clientId,
            reason: 'Booking requested by client',
            timestamp: new Date()
          }]
        }], { session });

        // Insert atomic slot locks (fails with E11000 duplicate key error if any slot is taken!)
        const locks = slotTimes.map(slotStart => ({
          providerId,
          slotStart,
          bookingId: booking._id,
          state: 'HELD',
          expiresAt
        }));

        try {
          await SlotLock.insertMany(locks, { session, ordered: true });
        } catch (lockError) {
          if (lockError.code === 11000 || lockError.name === 'MongoServerError') {
            throw new SlotUnavailableError('The selected time slot has just been reserved by another client');
          }
          throw lockError;
        }

        createdBooking = booking;
      });

      return createdBooking;
    } finally {
      await session.endSession();
    }
  }

  /**
   * Transition booking state with strict role checking and atomic lock management
   */
  static async transitionStatus({ bookingId, targetStatus, actorId, actorRole, reason }) {
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      throw new NotFoundError('Booking not found');
    }

    // Role & transition validation
    validateTransition(booking.status, targetStatus, actorRole);

    const oldStatus = booking.status;
    booking.status = targetStatus;
    booking.history.push({
      fromStatus: oldStatus,
      toStatus: targetStatus,
      actorId,
      reason: reason || '',
      timestamp: new Date()
    });

    // Handle lock state updates or release
    if (['REJECTED', 'CANCELLED_BY_CLIENT', 'CANCELLED_BY_PROVIDER', 'EXPIRED', 'PAYMENT_FAILED'].includes(targetStatus)) {
      // Release locks
      await SlotLock.deleteMany({ bookingId: booking._id });
    } else if (targetStatus === 'CONFIRMED') {
      // Elevate locks to CONFIRMED
      await SlotLock.updateMany({ bookingId: booking._id }, { state: 'CONFIRMED' });
    }

    await booking.save();
    return booking;
  }

  static async getBookingById(bookingId, userId, userRole) {
    const booking = await Booking.findById(bookingId)
      .populate('clientId', 'fullName email phone avatarUrl')
      .populate('providerId', 'fullName email phone avatarUrl')
      .populate('serviceId', 'name basePrice priceType');

    if (!booking) {
      throw new NotFoundError('Booking not found');
    }

    const isClient = booking.clientId._id.toString() === userId.toString();
    const isProvider = booking.providerId._id.toString() === userId.toString();
    const isAdmin = ['admin', 'superadmin', 'support'].includes(userRole);

    if (!isClient && !isProvider && !isAdmin) {
      throw new ForbiddenError('You are not authorized to view this booking');
    }

    return booking;
  }

  static async listUserBookings(userId, role, { status, limit = 20, page = 1 }) {
    const query = {};
    if (role === 'client') {
      query.clientId = userId;
    } else if (role === 'provider') {
      query.providerId = userId;
    }

    if (status) {
      query.status = status;
    }

    const skip = (page - 1) * limit;
    const [bookings, total] = await Promise.all([
      Booking.find(query)
        .populate('clientId', 'fullName phone')
        .populate('providerId', 'fullName phone')
        .populate('serviceId', 'name basePrice')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Booking.countDocuments(query)
    ]);

    return { bookings, total, page: Number(page), pages: Math.ceil(total / limit) };
  }
}
