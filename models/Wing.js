import mongoose from 'mongoose';

const wingSchema = new mongoose.Schema(
  {
    nameEn: {
      type: String,
      required: true,
      trim: true
    },
    nameBn: {
      type: String,
      required: true,
      trim: true
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true
    },
    description: {
      type: String,
      trim: true,
      default: ''
    },
    missionPoints: {
      type: [String],
      default: []
    },
    coverImage: {
      type: String,
      trim: true,
      default: ''
    },
    leader: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  },
  {
    timestamps: true
  }
);

const Wing = mongoose.models.Wing || mongoose.model('Wing', wingSchema);
export default Wing;
