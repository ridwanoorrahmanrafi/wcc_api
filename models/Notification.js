import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    recipientUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true
    },
    recipientMemberId: {
      type: String,
      default: '',
      index: true
    },
    recipientEmail: {
      type: String,
      required: true,
      index: true
    },
    recipientName: {
      type: String,
      default: ''
    },
    senderId: {
      type: String,
      default: 'admin'
    },
    senderName: {
      type: String,
      default: 'WCC Central Administration'
    },
    type: {
      type: String,
      enum: ['role_invitation', 'announcement', 'general_alert'],
      default: 'role_invitation',
      index: true
    },
    title: {
      type: String,
      required: true
    },
    message: {
      type: String,
      required: true
    },
    targetRole: {
      type: String,
      enum: ['volunteer', 'coordinator'],
      required: true
    },
    targetWing: {
      type: String,
      default: ''
    },
    targetWingId: {
      type: String,
      default: ''
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected', 'dismissed'],
      default: 'pending',
      index: true
    },
    actionTakenAt: {
      type: Date
    },
    read: {
      type: Boolean,
      default: false
    },
    adminNotes: {
      type: String,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

const Notification = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);
export default Notification;
