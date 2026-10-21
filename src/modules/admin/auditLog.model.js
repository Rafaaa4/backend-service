import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema({
  actorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  action: {
    type: String, // e.g. 'PROVIDER_APPROVED', 'PROVIDER_SUSPENDED', 'DISPUTE_RESOLVED'
    required: true,
    index: true
  },
  resourceType: {
    type: String, // 'User', 'ProviderProfile', 'Booking', 'Payment'
    required: true
  },
  resourceId: {
    type: String,
    required: true
  },
  details: {
    type: mongoose.Schema.Types.Mixed
  },
  ipAddress: {
    type: String,
    default: ''
  }
}, {
  timestamps: { createdAt: true, updatedAt: false } // Immutable append-only
});

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
