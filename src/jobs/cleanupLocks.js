import { SlotLock } from '../modules/bookings/slotLock.model.js';
import { Booking } from '../modules/bookings/booking.model.js';
import { logger } from '../core/logger/index.js';

/**
 * Background worker to release expired HELD slot locks and transition bookings to EXPIRED
 */
export const runLockCleanupJob = async () => {
  try {
    const now = new Date();

    // Find expired HELD locks
    const expiredLocks = await SlotLock.find({
      state: 'HELD',
      expiresAt: { $lt: now }
    });

    if (expiredLocks.length === 0) return;

    const expiredBookingIds = [...new Set(expiredLocks.map(l => l.bookingId.toString()))];

    // Transition affected PENDING_PAYMENT bookings to EXPIRED
    for (const bookingId of expiredBookingIds) {
      const booking = await Booking.findOne({
        _id: bookingId,
        status: 'PENDING_PAYMENT'
      });

      if (booking) {
        booking.status = 'EXPIRED';
        booking.history.push({
          fromStatus: 'PENDING_PAYMENT',
          toStatus: 'EXPIRED',
          actorId: booking.clientId,
          reason: 'Slot reservation expired before payment confirmation',
          timestamp: now
        });
        await booking.save();
      }
    }

    // Delete expired locks
    const deleteResult = await SlotLock.deleteMany({
      state: 'HELD',
      expiresAt: { $lt: now }
    });

    if (deleteResult.deletedCount > 0) {
      logger.info({ releasedLocks: deleteResult.deletedCount, expiredBookings: expiredBookingIds.length }, 'Expired slot locks cleaned up');
    }
  } catch (err) {
    logger.error({ error: err.message }, 'Error in lock cleanup job');
  }
};

export const startLockCleanupInterval = (intervalMs = 30000) => {
  const timer = setInterval(runLockCleanupJob, intervalMs);
  return timer;
};
