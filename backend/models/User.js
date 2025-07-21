const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    required: true,
    minlength: 6,
  },
  firstName: {
    type: String,
    required: true,
    trim: true,
  },
  lastName: {
    type: String,
    required: true,
    trim: true,
  },
  role: {
    type: String,
    enum: ['physician', 'admin', 'staff'],
    default: 'physician',
  },
  isEmailVerified: {
    type: Boolean,
    default: false,
  },
  passwordResetToken: {
    type: String,
  },
  passwordResetExpires: {
    type: Date,
  },
  patientGroups: [{
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PatientGroup',
    },
    permission: {
      type: String,
      enum: ['view', 'edit', 'admin'],
      default: 'view',
    },
  }],
  notifications: [{
    type: {
      type: String,
      enum: [
        'invitation', 
        'dispute_complete', 
        'group_update',
        'dispute_analysis_complete',
        'document_generated',
        'dispute_status_update',
        'dispute_deadline_reminder',
        'group_invitation'
      ],
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    relatedGroup: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PatientGroup',
    },
    relatedDispute: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PriorAuthorization',
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  }],
  preferences: {
    theme: {
      type: String,
      enum: ['light', 'dark'],
      default: 'light',
    },
    notifications: {
      email: {
        type: Boolean,
        default: true,
      },
      inApp: {
        type: Boolean,
        default: true,
      },
      push: {
        type: Boolean,
        default: true,
      },
      disputeUpdates: {
        type: Boolean,
        default: true,
      },
      groupInvitations: {
        type: Boolean,
        default: true,
      },
      deadlineReminders: {
        type: Boolean,
        default: true,
      },
      analysisComplete: {
        type: Boolean,
        default: true,
      },
    },
  },
}, {
  timestamps: true,
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Generate password reset token
userSchema.methods.generatePasswordResetToken = function() {
  const resetToken = require('crypto').randomBytes(32).toString('hex');
  this.passwordResetToken = require('crypto').createHash('sha256').update(resetToken).digest('hex');
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
  return resetToken;
};

// Method to add notification
userSchema.methods.addNotification = function(notificationData) {
  this.notifications.unshift({
    type: notificationData.type,
    message: notificationData.message,
    relatedGroup: notificationData.relatedGroup,
    relatedDispute: notificationData.relatedDispute,
  });
  
  // Keep only latest 50 notifications
  if (this.notifications.length > 50) {
    this.notifications = this.notifications.slice(0, 50);
  }
};

// Virtual for unread notification count
userSchema.virtual('unreadNotificationCount').get(function() {
  return this.notifications.filter(n => !n.isRead).length;
});

module.exports = mongoose.model('User', userSchema);