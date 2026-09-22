import mongoose from 'mongoose';

const activitySchema = new mongoose.Schema(
  {
    activityId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    type: {
      type: String,
      enum: ['Health Camp', 'Event', 'Campaign', 'Meeting', 'Training', 'Office Operation', 'Project', 'Workshop'],
      default: 'Event'
    },
    startDate: {
      type: String,
      trim: true
    },
    endDate: {
      type: String,
      trim: true
    },
    location: {
      type: String,
      trim: true
    },
    description: {
      type: String,
      trim: true
    },
    budget: {
      type: Number,
      default: 0
    },
    actualExpense: {
      type: Number,
      default: 0
    },
    responsiblePerson: {
      type: String,
      trim: true
    },
    status: {
      type: String,
      enum: ['Active', 'Completed', 'Closed'],
      default: 'Active'
    },
    notes: {
      type: String,
      trim: true
    }
  },
  {
    timestamps: true
  }
);

const Activity = mongoose.models.Activity || mongoose.model('Activity', activitySchema);
export default Activity;
