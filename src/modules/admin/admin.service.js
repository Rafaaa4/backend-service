import { ProviderProfile } from '../providers/provider.model.js';
import { User } from '../users/user.model.js';
import { Booking } from '../bookings/booking.model.js';
import { Payment } from '../payments/payment.model.js';
import { AuditLog } from './auditLog.model.js';
import { NotFoundError, BadRequestError } from '../../core/errors/AppError.js';

export class AdminService {
  static async getDashboardMetrics() {
    const [
      totalUsers,
      totalProviders,
      pendingProviders,
      totalBookings,
      activeBookings,
      completedBookings,
      financialStats
    ] = await Promise.all([
      User.countDocuments({ role: 'client' }),
      ProviderProfile.countDocuments({ verificationStatus: 'VERIFIED' }),
      ProviderProfile.countDocuments({ verificationStatus: 'PENDING' }),
      Booking.countDocuments(),
      Booking.countDocuments({ status: { $in: ['CONFIRMED', 'IN_PROGRESS'] } }),
      Booking.countDocuments({ status: 'COMPLETED' }),
      Payment.aggregate([
        { $match: { status: 'COMPLETED' } },
        { $group: { _id: null, totalRevenue: { $sum: '$amount' } } }
      ])
    ]);

    return {
      users: { totalClients: totalUsers, verifiedProviders: totalProviders, pendingProviders },
      bookings: { total: totalBookings, active: activeBookings, completed: completedBookings },
      finances: {
        totalProcessedMillimes: financialStats[0]?.totalRevenue || 0,
        currency: 'TND'
      }
    };
  }

  static async verifyProvider({ providerId, status, actorId, ipAddress, reason }) {
    if (!['VERIFIED', 'REJECTED'].includes(status)) {
      throw new BadRequestError('Status must be either VERIFIED or REJECTED');
    }

    const provider = await ProviderProfile.findOne({ userId: providerId });
    if (!provider) {
      throw new NotFoundError('Provider profile not found');
    }

    const oldStatus = provider.verificationStatus;
    provider.verificationStatus = status;
    await provider.save();

    await User.findByIdAndUpdate(providerId, {
      status: status === 'VERIFIED' ? 'active' : 'suspended'
    });

    // Record immutable audit log
    await AuditLog.create({
      actorId,
      action: status === 'VERIFIED' ? 'PROVIDER_APPROVED' : 'PROVIDER_REJECTED',
      resourceType: 'ProviderProfile',
      resourceId: provider._id.toString(),
      details: { oldStatus, newStatus: status, reason: reason || '' },
      ipAddress
    });

    return provider;
  }

  static async listAuditLogs({ limit = 50, page = 1 }) {
    const skip = (page - 1) * limit;
    const [logs, total] = await Promise.all([
      AuditLog.find()
        .populate('actorId', 'fullName email role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      AuditLog.countDocuments()
    ]);

    return { logs, total, page: Number(page), pages: Math.ceil(total / limit) };
  }
}
