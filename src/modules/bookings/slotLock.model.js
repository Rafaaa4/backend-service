import mongoose from 'mongoose';

const slotLockSchema = new mongoose.Schema({
  providerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  slotStart: {
    type: Date,
    required: true
  },
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: true
  },
  state: {
    type: String,
    enum: ['HELD', 'CONFIRMED'],
    default: 'HELD',
    required: true
  },
  expiresAt: {
    type: Date,
    required: true
  }
}, {
  timestamps: true
});

// CRITICAL ATOMIC ANTI-CONFLICT UNIQUE INDEX:
// Guarantees at the database engine level that no two concurrent requests can ever lock the same slot for the same provider!
slotLockSchema.index({ providerId: 1, slotStart: 1 }, { unique: true });

// TTL Index for expired HELD locks
slotLockSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const SlotLock = mongoose.model('SlotLock', slotLockSchema);
