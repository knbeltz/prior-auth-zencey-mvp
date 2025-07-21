// services/notificationService.js
const User = require('../models/User');
const { logger } = require('../utils/logger');

class NotificationService {
  // Basic notification queueing
  async queueNotification(notificationData) {
    try {
      const { userId, type, data, channels = ['in_app'], priority = 'normal' } = notificationData;
      
      // For now, just add to user's notifications
      const user = await User.findById(userId);
      if (!user) {
        logger.error(`User not found for notification: ${userId}`);
        return;
      }

      user.notifications.push({
        type,
        message: data.message,
        relatedGroup: data.relatedGroup,
        isRead: false
      });

      await user.save();
      logger.info(`Notification queued for user ${userId}: ${type}`);
      
    } catch (error) {
      logger.error('Error queueing notification:', error);
    }
  }

  // Deadline reminder notification
  async notifyDeadlineReminder(disputeId, daysRemaining) {
    try {
      // This would normally send emails, push notifications, etc.
      // For now, just log it
      logger.info(`Deadline reminder: Dispute ${disputeId} has ${daysRemaining} days remaining`);
    } catch (error) {
      logger.error('Error sending deadline reminder:', error);
    }
  }

  // Batch notification for multiple users
  async notifyMultipleUsers(userIds, notificationData) {
    try {
      const promises = userIds.map(userId => 
        this.queueNotification({ ...notificationData, userId })
      );
      await Promise.all(promises);
    } catch (error) {
      logger.error('Error notifying multiple users:', error);
    }
  }

  // Analysis complete notification
  async notifyAnalysisComplete(disputeId, userId, successProbability) {
    try {
      await this.queueNotification({
        userId,
        type: 'dispute_analysis_complete',
        data: {
          message: `AI analysis completed for dispute. Success probability: ${successProbability}%`,
          disputeId,
        },
        channels: ['in_app']
      });
    } catch (error) {
      logger.error('Error sending analysis complete notification:', error);
    }
  }

  // Document generation notification
  async notifyDocumentGenerated(disputeId, userId, documentType) {
    try {
      await this.queueNotification({
        userId,
        type: 'document_generated',
        data: {
          message: `${documentType} document has been generated for your dispute`,
          disputeId,
        },
        channels: ['in_app']
      });
    } catch (error) {
      logger.error('Error sending document generated notification:', error);
    }
  }

  // Status update notification
  async notifyStatusUpdate(disputeId, userId, oldStatus, newStatus) {
    try {
      await this.queueNotification({
        userId,
        type: 'dispute_status_update',
        data: {
          message: `Dispute status changed from ${oldStatus} to ${newStatus}`,
          disputeId,
        },
        channels: ['in_app']
      });
    } catch (error) {
      logger.error('Error sending status update notification:', error);
    }
  }

  // Group invitation notification
  async notifyGroupInvitation(userId, groupName, inviterName) {
    try {
      await this.queueNotification({
        userId,
        type: 'group_invitation',
        data: {
          message: `${inviterName} invited you to join "${groupName}" patient group`,
        },
        channels: ['in_app', 'email']
      });
    } catch (error) {
      logger.error('Error sending group invitation notification:', error);
    }
  }
}

module.exports = new NotificationService();