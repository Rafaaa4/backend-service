import mongoose from 'mongoose';

const serviceSchema = new mongoose.Schema({
  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  priceType: {
    type: String,
    enum: ['hourly', 'fixed'],
    default: 'fixed'
  },
  basePrice: {
    type: Number, // In Millimes (e.g., 30000 = 30 TND)
    required: true,
    min: 0
  },
  depositPercentage: {
    type: Number, // e.g. 20 (for 20% deposit)
    default: 20,
    min: 0,
    max: 100
  },
  estimatedDurationMinutes: {
    type: Number,
    default: 60,
    min: 15
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  }
}, {
  timestamps: true
});

export const Service = mongoose.model('Service', serviceSchema);
