import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema({
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: true,
    index: true
  },
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  providerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: {
    type: Number, // In Millimes
    required: true
  },
  currency: {
    type: String,
    default: 'TND'
  },
  type: {
    type: String,
    enum: ['DEPOSIT', 'FINAL_BALANCE', 'REFUND'],
    default: 'DEPOSIT'
  },
  status: {
    type: String,
    enum: ['INITIATED', 'COMPLETED', 'FAILED', 'REFUNDED'],
    default: 'INITIATED',
    index: true
  },
  providerName: {
    type: String,
    enum: ['FLOUCI', 'KONNECT', 'PAYMEE', 'MOCK_SANDBOX'],
    default: 'MOCK_SANDBOX'
  },
  transactionReference: {
    type: String,
    required: true,
    unique: true
  },
  paymentUrl: {
    type: String
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true
});

const paymentEventSchema = new mongoose.Schema({
  providerEventId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  providerName: {
    type: String,
    required: true
  },
  payload: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  processedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

export const Payment = mongoose.model('Payment', paymentSchema);
export const PaymentEvent = mongoose.model('PaymentEvent', paymentEventSchema);
