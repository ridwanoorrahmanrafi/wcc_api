import mongoose from 'mongoose';

const wingSchema = new mongoose.Schema(
  {
    nameEn: { type: String, required: true, trim: true },
    nameBn: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    description: { type: String, trim: true, default: '' },
    missionPoints: { type: [String], default: [] },
    coverImage: { type: String, trim: true, default: '' }
  },
  { timestamps: true }
);

const Wing = mongoose.models.Wing || mongoose.model('Wing', wingSchema);
export default Wing;
