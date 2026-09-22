import mongoose from 'mongoose';

const volunteerLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    userEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true
    },
    volunteerName: {
      type: String,
      required: true
    },
    driveName: {
      type: String,
      required: true
    },
    hours: {
      type: Number,
      required: true,
      min: 0.5
    },
    notes: {
      type: String,
      default: ''
    },
    date: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

const VolunteerLog = mongoose.models.VolunteerLog || mongoose.model('VolunteerLog', volunteerLogSchema);
export default VolunteerLog;
