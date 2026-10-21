import mongoose from 'mongoose';

const stateHistorySchema = new mongoose.Schema({
  fromStatus: { type: String, required: true },
  toStatus: { type: String, required: true },
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reason: { type: String, default: '' },
  timestamp: { type: Date, default: Date.now }
}, { _id: false });

const bookingSchema = new mongoose.Schema({
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  providerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  serviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service',
    required: true
  },
  // Frozen pricing snapshot at time of booking (in Millimes)
  priceSnapshot: {
    unitPrice: { type: Number, required: true },
    durationMinutes: { type: Number, required: true },
    totalAmount: { type: Number, required: true },
    depositAmount: { type: Number, required: true },
    remainingAmount: { type: Number, required: true },
    currency: { type: String, default: 'TND' },
    platformCommissionRate: { type: Number, default: 0.15 } // 15%
  },
  startAt: {
    type: Date,
    required: true,
    index: true
  },
  endAt: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: [
      'PENDING_PAYMENT',
      'AWAITING_PROVIDER',
      'CONFIRMED',
      'IN_PROGRESS',
      'COMPLETED',
      'EXPIRED',
      'PAYMENT_FAILED',
      'REJECTED',
      'CANCELLED_BY_CLIENT',
      'CANCELLED_BY_PROVIDER',
      'DISPUTED'
    ],
    default: 'PENDING_PAYMENT',
    index: true
  },
  paymentStatus: {
    type: String,
    enum: ['UNPAID', 'DEPOSIT_PAID', 'FULLY_PAID', 'REFUNDED'],
    default: 'UNPAID'
  },
  address: {
    street: { type: String, required: true },
    city: { type: String, default: 'Tunis' },
    coordinates: { type: [Number], default: [10.1815, 36.8065] }
  },
  clientNotes: {
    type: String,
    default: ''
  },
  idempotencyKey: {
    type: String,
    unique: true,
    sparse: true,
    index: true
  },
  expiresAt: {
    type: Date,
    required: true,
    index: true
  },
  history: [stateHistorySchema]
}, {
  timestamps: true
});

bookingSchema.index({ clientId: 1, createdAt: -1 });
bookingSchema.index({ providerId: 1, startAt: 1 });
bookingSchema.index({ status: 1, expiresAt: 1 });

export const Booking = mongoose.model('Booking', bookingSchema);
