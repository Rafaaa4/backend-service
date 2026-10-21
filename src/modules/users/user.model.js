import mongoose from 'mongoose';

const addressSchema = new mongoose.Schema({
  street: { type: String, trim: true },
  city: { type: String, trim: true, default: 'Tunis' },
  state: { type: String, trim: true },
  postalCode: { type: String, trim: true },
  country: { type: String, default: 'TN' },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], default: [10.1815, 36.8065] } // [longitude, latitude] Tunis default
  }
}, { _id: false });

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true
  },
  passwordHash: {
    type: String,
    required: true,
    select: false
  },
  phone: {
    type: String,
    sparse: true,
    trim: true
  },
  fullName: {
    type: String,
    required: true,
    trim: true
  },
  role: {
    type: String,
    enum: ['client', 'provider', 'support', 'moderator', 'finance', 'admin', 'superadmin'],
    default: 'client',
    index: true
  },
  status: {
    type: String,
    enum: ['active', 'suspended', 'pending_verification'],
    default: 'active'
  },
  avatarUrl: {
    type: String,
    default: ''
  },
  twoFactorEnabled: {
    type: Boolean,
    default: false
  },
  twoFactorSecret: {
    type: String,
    select: false
  },
  address: addressSchema,
  lastLoginAt: {
    type: Date
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function (doc, ret) {
      delete ret.passwordHash;
      delete ret.twoFactorSecret;
      delete ret.__v;
      return ret;
    }
  }
});

// 2dsphere index for geo queries
userSchema.index({ 'address.location': '2dsphere' });

export const User = mongoose.model('User', userSchema);
