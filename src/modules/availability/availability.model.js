import mongoose from 'mongoose';

const timeSlotRuleSchema = new mongoose.Schema({
  start: { type: String, required: true }, // "08:00"
  end: { type: String, required: true }    // "18:00"
}, { _id: false });

const dayScheduleSchema = new mongoose.Schema({
  dayOfWeek: {
    type: Number, // 0 = Sunday, 1 = Monday, ... 6 = Saturday
    required: true,
    min: 0,
    max: 6
  },
  isEnabled: { type: Boolean, default: true },
  slots: [timeSlotRuleSchema]
}, { _id: false });

const availabilityRuleSchema = new mongoose.Schema({
  providerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  slotDurationMinutes: {
    type: Number,
    default: 60,
    enum: [15, 30, 60, 120]
  },
  weeklySchedule: [dayScheduleSchema],
  exceptions: [{
    date: { type: String, required: true }, // "YYYY-MM-DD"
    isOff: { type: Boolean, default: true },
    customSlots: [timeSlotRuleSchema]
  }]
}, {
  timestamps: true
});

export const AvailabilityRule = mongoose.model('AvailabilityRule', availabilityRuleSchema);
