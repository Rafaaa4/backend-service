import mongoose from 'mongoose';

const providerProfileSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  businessName: {
    type: String,
    required: true,
    trim: true
  },
  bio: {
    type: String,
    default: ''
  },
  categoryIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    index: true
  }],
  serviceIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service'
  }],
  verificationStatus: {
    type: String,
    enum: ['PENDING', 'VERIFIED', 'REJECTED'],
    default: 'PENDING',
    index: true
  },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], default: [10.1815, 36.8065] } // [longitude, latitude]
  },
  serviceRadiusKm: {
    type: Number,
    default: 30,
    min: 1,
    max: 150
  },
  ratingAvg: {
    type: Number,
    default: 5.0,
    min: 0,
    max: 5
  },
  ratingCount: {
    type: Number,
    default: 0
  },
  hourlyRate: {
    type: Number, // In Millimes
    default: 30000
  },
  documents: [{
    docType: { type: String, required: true }, // 'id_card', 'business_license', etc.
    fileUrl: { type: String, required: true },
    status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING' },
    uploadedAt: { type: Date, default: Date.now }
  }]
}, {
  timestamps: true
});

// Geo 2dsphere index for location searches
providerProfileSchema.index({ location: '2dsphere' });
providerProfileSchema.index({ verificationStatus: 1, categoryIds: 1, ratingAvg: -1 });

export const ProviderProfile = mongoose.model('ProviderProfile', providerProfileSchema);
