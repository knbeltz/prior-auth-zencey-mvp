// services/deadlineMonitoringService.js
const PriorAuthorization = require('../models/PriorAuthorization');
const notificationService = require('./notificationService');
const { logger } = require('../utils/logger');

class DeadlineMonitoringService {
  constructor() {
    this.isRunning = false;
    this.intervalId = null;
    this.checkInterval = 60 * 60 * 1000; // Check every hour
  }

  start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.intervalId = setInterval(() => {
      this.checkDeadlines();
    }, this.checkInterval);
    
    // Run initial check
    this.checkDeadlines();
    
    logger.info('Deadline monitoring service started');
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    logger.info('Deadline monitoring service stopped');
  }

  async checkDeadlines() {
    try {
      logger.info('Running deadline check...');
      
      // Get all active disputes
      const activeDisputes = await PriorAuthorization.find({
        isActive: true,
        'dispute.status': { 
          $in: ['pending', 'in_progress', 'submitted', 'under_review'] 
        }
      }).populate('createdBy patient');

      const flaggedDisputes = [];
      const notifications = [];

      for (const dispute of activeDisputes) {
        // Update deadline flags
        dispute.updateDeadlineFlags();
        
        // Check for new flags that need notifications
        const newFlags = dispute.deadlines.deadlineFlags.filter(flag => 
          !flag.resolved && 
          (new Date() - flag.flaggedAt) < this.checkInterval + 60000 // Recently flagged
        );

        if (newFlags.length > 0) {
          flaggedDisputes.push(dispute);
          
          // Create notifications for new flags
          for (const flag of newFlags) {
            await this.createDeadlineNotification(dispute, flag);
          }
        }

        await dispute.save();
      }

      logger.info(`Deadline check completed. Flagged ${flaggedDisputes.length} disputes`);
      
      return {
        totalChecked: activeDisputes.length,
        flaggedDisputes: flaggedDisputes.length,
        notifications: notifications.length
      };

    } catch (error) {
      logger.error('Error during deadline check:', error);
      throw error;
    }
  }

  async createDeadlineNotification(dispute, flag) {
    const patient = dispute.patient;
    const creator = dispute.createdBy;

    let message, urgency;

    switch (flag.type) {
      case 'overdue':
        message = `OVERDUE: Response deadline passed ${flag.daysRemaining} days ago for ${patient.firstName} ${patient.lastName} - ${dispute.requestDetails.requestedService}`;
        urgency = 'critical';
        break;
      case 'urgent':
        message = `URGENT: Response deadline in ${flag.daysRemaining} days for ${patient.firstName} ${patient.lastName} - ${dispute.requestDetails.requestedService}`;
        urgency = 'high';
        break;
      case 'warning':
        message = `Reminder: Response deadline in ${flag.daysRemaining} days for ${patient.firstName} ${patient.lastName} - ${dispute.requestDetails.requestedService}`;
        urgency = 'medium';
        break;
    }

    // Send notification to dispute creator
    await notificationService.notifyDeadlineReminder(
      dispute._id,
      flag.daysRemaining
    );

    // Also notify patient group members with admin/edit permissions
    await this.notifyGroupMembers(dispute, flag, message);

    logger.info(`Deadline notification sent for dispute ${dispute._id}: ${flag.type}`);
  }

  async notifyGroupMembers(dispute, flag, message) {
    try {
      const PatientGroup = require('../models/PatientGroup');
      const group = await PatientGroup.findById(dispute.patientGroup)
        .populate('members.user');

      if (!group) return;

      // Notify members with edit or admin permissions
      const eligibleMembers = group.members.filter(member => 
        ['edit', 'admin'].includes(member.permission) &&
        member.user._id.toString() !== dispute.createdBy._id.toString()
      );

      for (const member of eligibleMembers) {
        await notificationService.queueNotification({
          userId: member.user._id,
          type: 'dispute_deadline_reminder',
          data: {
            message,
            disputeId: dispute._id,
            patientName: `${dispute.patient.firstName} ${dispute.patient.lastName}`,
            daysRemaining: flag.daysRemaining,
            urgency: flag.type
          },
          channels: flag.type === 'overdue' ? ['email', 'in_app', 'push'] : ['in_app'],
          priority: flag.type === 'overdue' ? 'high' : 'normal'
        });
      }
    } catch (error) {
      logger.error('Error notifying group members:', error);
    }
  }

  // Get deadline summary for dashboard
  async getDeadlineSummary(userId, patientGroupIds = []) {
    try {
      const query = {
        isActive: true,
        'dispute.status': { 
          $in: ['pending', 'in_progress', 'submitted', 'under_review'] 
        }
      };

      // Filter by user's patient groups if provided
      if (patientGroupIds.length > 0) {
        query.patientGroup = { $in: patientGroupIds };
      } else {
        query.createdBy = userId;
      }

      const disputes = await PriorAuthorization.find(query);
      
      const summary = {
        overdue: 0,
        urgent: 0, // <= 3 days
        warning: 0, // <= 7 days
        total: disputes.length,
        details: []
      };

      const now = new Date();

      for (const dispute of disputes) {
        const deadline = dispute.deadlines.responseDeadline;
        if (!deadline) continue;

        const daysRemaining = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
        
        let category = 'normal';
        if (daysRemaining < 0) {
          summary.overdue++;
          category = 'overdue';
        } else if (daysRemaining <= 3) {
          summary.urgent++;
          category = 'urgent';
        } else if (daysRemaining <= 7) {
          summary.warning++;
          category = 'warning';
        }

        if (category !== 'normal') {
          summary.details.push({
            disputeId: dispute._id,
            patientName: `${dispute.patient?.firstName} ${dispute.patient?.lastName}`,
            service: dispute.requestDetails.requestedService,
            deadline,
            daysRemaining: Math.abs(daysRemaining),
            category,
            status: dispute.dispute.status
          });
        }
      }

      // Sort by urgency
      summary.details.sort((a, b) => {
        const urgencyOrder = { overdue: 0, urgent: 1, warning: 2 };
        return urgencyOrder[a.category] - urgencyOrder[b.category];
      });

      return summary;
    } catch (error) {
      logger.error('Error getting deadline summary:', error);
      throw error;
    }
  }

  // Update deadline for a specific dispute
  async updateDisputeDeadline(disputeId, newDeadline, deadlineType = 'responseDeadline') {
    try {
      const dispute = await PriorAuthorization.findById(disputeId);
      if (!dispute) {
        throw new Error('Dispute not found');
      }

      dispute.deadlines[deadlineType] = new Date(newDeadline);
      
      // Clear existing flags as deadline changed
      dispute.deadlines.deadlineFlags.forEach(flag => {
        flag.resolved = true;
      });

      // Update flags with new deadline
      dispute.updateDeadlineFlags();
      
      await dispute.save();

      logger.info(`Updated deadline for dispute ${disputeId}: ${deadlineType} = ${newDeadline}`);
      
      return dispute;
    } catch (error) {
      logger.error('Error updating dispute deadline:', error);
      throw error;
    }
  }

  // Resolve deadline flag (mark as handled)
  async resolveDeadlineFlag(disputeId, flagId) {
    try {
      const dispute = await PriorAuthorization.findById(disputeId);
      if (!dispute) {
        throw new Error('Dispute not found');
      }

      const flag = dispute.deadlines.deadlineFlags.id(flagId);
      if (flag) {
        flag.resolved = true;
        await dispute.save();
        logger.info(`Resolved deadline flag ${flagId} for dispute ${disputeId}`);
      }

      return dispute;
    } catch (error) {
      logger.error('Error resolving deadline flag:', error);
      throw error;
    }
  }
}

module.exports = new DeadlineMonitoringService();