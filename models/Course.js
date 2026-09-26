import mongoose from 'mongoose';

const lessonSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true,
    default: ''
  },
  videoUrl: {
    type: String,
    trim: true,
    default: ''
  },
  duration: {
    type: String,
    trim: true,
    default: ''
  },
  order: {
    type: Number,
    default: 1
  },
  resources: [
    {
      title: String,
      url: String
    }
  ]
});

const courseSchema = new mongoose.Schema(
  {
    title: {
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
      required: true,
      trim: true
    },
    wing: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Wing',
      required: true
    },
    wingSlug: {
      type: String,
      default: 'education'
    },
    category: {
      type: String,
      trim: true,
      default: 'General'
    },
    level: {
      type: String,
      enum: ['All Levels', 'Beginner', 'Intermediate', 'Advanced'],
      default: 'Beginner'
    },
    duration: {
      type: String,
      trim: true,
      default: 'Self-paced'
    },
    thumbnail: {
      type: String,
      trim: true,
      default: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&q=80&w=800'
    },
    instructor: {
      name: { type: String, default: 'WCC Mentor Team' },
      title: { type: String, default: 'Education Wing Mentor' },
      organization: { type: String, default: 'We Can Change' },
      avatar: { type: String, default: '' }
    },
    lessons: [lessonSchema],
    enrolledMembers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    ],
    status: {
      type: String,
      enum: ['published', 'draft', 'archived'],
      default: 'published'
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  {
    timestamps: true
  }
);

const Course = mongoose.models.Course || mongoose.model('Course', courseSchema);
export default Course;
