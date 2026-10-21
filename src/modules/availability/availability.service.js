import { AvailabilityRule } from './availability.model.js';
import { SlotLock } from '../bookings/slotLock.model.js';
import { ProviderProfile } from '../providers/provider.model.js';
import { NotFoundError } from '../../core/errors/AppError.js';

export class AvailabilityService {
  /**
   * Get available booking slots for a provider on a specific date
   * @param {string} providerId 
   * @param {string} dateString "YYYY-MM-DD"
   */
  static async getAvailableSlots(providerId, dateString) {
    const provider = await ProviderProfile.findOne({
      userId: providerId,
      verificationStatus: 'VERIFIED'
    });

    if (!provider) {
      throw new NotFoundError('Provider not found or not yet verified');
    }

    const rule = await AvailabilityRule.findOne({ providerId });
    const slotDuration = rule ? rule.slotDurationMinutes : 60;

    // Check exceptions first
    const targetDate = new Date(`${dateString}T00:00:00.000Z`);
    const dayOfWeek = targetDate.getUTCDay();

    let workingRanges = [{ start: '08:00', end: '18:00' }]; // default

    if (rule) {
      const exception = rule.exceptions?.find(e => e.date === dateString);
      if (exception) {
        if (exception.isOff) {
          return { date: dateString, slots: [] }; // Day off
        }
        workingRanges = exception.customSlots;
      } else {
        const daySchedule = rule.weeklySchedule?.find(d => d.dayOfWeek === dayOfWeek);
        if (daySchedule) {
          if (!daySchedule.isEnabled) {
            return { date: dateString, slots: [] };
          }
          workingRanges = daySchedule.slots;
        }
      }
    }

    // Generate potential slots
    const potentialSlots = [];
    for (const range of workingRanges) {
      const [startHour, startMin] = range.start.split(':').map(Number);
      const [endHour, endMin] = range.end.split(':').map(Number);

      let current = new Date(`${dateString}T${String(startHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}:00.000Z`);
      const endLimit = new Date(`${dateString}T${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}:00.000Z`);

      while (current < endLimit) {
        potentialSlots.push(new Date(current));
        current = new Date(current.getTime() + slotDuration * 60 * 1000);
      }
    }

    // Query active locks for provider
    const dayStart = new Date(`${dateString}T00:00:00.000Z`);
    const dayEnd = new Date(`${dateString}T23:59:59.999Z`);
    const now = new Date();

    const activeLocks = await SlotLock.find({
      providerId,
      slotStart: { $gte: dayStart, $lte: dayEnd },
      $or: [
        { state: 'CONFIRMED' },
        { state: 'HELD', expiresAt: { $gt: now } }
      ]
    });

    const lockedTimestamps = new Set(activeLocks.map(l => l.slotStart.getTime()));

    const slots = potentialSlots.map(slot => {
      const isPast = slot < now;
      const isBooked = lockedTimestamps.has(slot.getTime());
      return {
        startAt: slot.toISOString(),
        available: !isPast && !isBooked,
        durationMinutes: slotDuration
      };
    });

    return {
      date: dateString,
      providerId,
      slotDurationMinutes: slotDuration,
      slots
    };
  }
}
