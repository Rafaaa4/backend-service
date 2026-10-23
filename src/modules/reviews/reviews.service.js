import { Review } from './review.model.js';
import { Booking } from '../bookings/booking.model.js';
import { Service } from '../services/service.model.js';
import { ProviderProfile } from '../providers/provider.model.js';
import { BadRequestError, NotFoundError, ForbiddenError, ConflictError } from '../../core/errors/AppError.js';

export class ReviewsService {
  static async createReview({ bookingId, providerId, serviceId, clientId, rating, comment }) {
    let targetProviderId = providerId;
    let targetServiceId = serviceId;

    if (bookingId) {
      const booking = await Booking.findById(bookingId);
      if (!booking) {
        throw new NotFoundError('Booking not found');
      }

      if (booking.clientId.toString() !== clientId.toString()) {
        throw new ForbiddenError('Only the client who booked the service can leave a review');
      }

      if (booking.status !== 'COMPLETED') {
        throw new BadRequestError('Reviews can only be submitted for completed services');
      }

      const existingReview = await Review.findOne({ bookingId });
      if (existingReview) {
        throw new ConflictError('A review has already been submitted for this booking');
      }

      targetProviderId = booking.providerId;
      targetServiceId = booking.serviceId;
    } else if (serviceId && !targetProviderId) {
      const service = await Service.findById(serviceId);
      if (service) {
        targetProviderId = service.providerId;
      }
    }

    if (!targetProviderId) {
      throw new BadRequestError('providerId, serviceId or valid bookingId is required to leave a review');
    }

    const review = await Review.create({
      bookingId: bookingId || null,
      providerId: targetProviderId,
      serviceId: targetServiceId || null,
      clientId,
      rating,
      comment
    });

    // Atomically recalculate and denormalize provider rating average
    const stats = await Review.aggregate([
      { $match: { providerId: review.providerId } },
      { $group: { _id: '$providerId', avgRating: { $avg: '$rating' }, total: { $sum: 1 } } }
    ]);

    if (stats.length > 0) {
      const avg = Math.round(stats[0].avgRating * 10) / 10;
      await ProviderProfile.findOneAndUpdate(
        { userId: review.providerId },
        { ratingAvg: avg, ratingCount: stats[0].total }
      );
    }

    await review.populate('clientId', 'fullName avatarUrl');
    if (review.serviceId) {
      await review.populate('serviceId', 'name imageUrl');
    }

    return review;
  }

  static async getProviderReviews(providerId, { limit = 20, page = 1 }) {
    const skip = (page - 1) * limit;
    const [reviews, total] = await Promise.all([
      Review.find({ providerId })
        .populate('clientId', 'fullName avatarUrl')
        .populate('serviceId', 'name imageUrl')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Review.countDocuments({ providerId })
    ]);

    return { reviews, total, page: Number(page), pages: Math.ceil(total / limit) };
  }

  static async getServiceReviews(serviceId, { limit = 20, page = 1 }) {
    const skip = (page - 1) * limit;
    const [reviews, total] = await Promise.all([
      Review.find({ serviceId })
        .populate('clientId', 'fullName avatarUrl')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Review.countDocuments({ serviceId })
    ]);

    return { reviews, total, page: Number(page), pages: Math.ceil(total / limit) };
  }
}
