const express = require('express');
const { body, validationResult } = require('express-validator');
const crypto = require('crypto');
const PatientGroup = require('../models/PatientGroup');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/patient-groups
// @desc    Get all patient groups for current user
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate({
      path: 'patientGroups.group',
      populate: {
        path: 'owner',
        select: 'firstName lastName email',
      },
    });

    const patientGroups = await PatientGroup.find({
      $or: [
        { owner: req.user.id },
        { 'members.user': req.user.id },
      ],
      isActive: true,
    })
    .populate('owner', 'firstName lastName email')
    .populate('members.user', 'firstName lastName email')
    .populate('patients')
    .sort({ updatedAt: -1 });

    res.json({
      success: true,
      patientGroups,
    });
  } catch (error) {
    console.error('Get patient groups error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/patient-groups
// @desc    Create a new patient group
// @access  Private
router.post('/', auth, [
  body('name').notEmpty().trim(),
  body('description').optional().trim(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, description } = req.body;

    // Check if group with same name exists for this user
    const existingGroup = await PatientGroup.findOne({
      name,
      owner: req.user.id,
      isActive: true,
    });

    if (existingGroup) {
      return res.status(400).json({ message: 'A patient group with this name already exists' });
    }

    const patientGroup = new PatientGroup({
      name,
      description,
      owner: req.user.id,
      members: [{
        user: req.user.id,
        permission: 'admin',
      }],
    });

    await patientGroup.save();

    // Add group to user's patientGroups
    await User.findByIdAndUpdate(req.user.id, {
      $push: {
        patientGroups: {
          group: patientGroup._id,
          permission: 'admin',
        },
      },
    });

    await patientGroup.populate('owner', 'firstName lastName email');
    await patientGroup.populate('members.user', 'firstName lastName email');

    res.status(201).json({
      success: true,
      patientGroup,
    });
  } catch (error) {
    console.error('Create patient group error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/patient-groups/:id
// @desc    Get specific patient group
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const patientGroup = await PatientGroup.findOne({
      _id: req.params.id,
      $or: [
        { owner: req.user.id },
        { 'members.user': req.user.id },
      ],
      isActive: true,
    })
    .populate('owner', 'firstName lastName email')
    .populate('members.user', 'firstName lastName email')
    .populate({
      path: 'patients',
      populate: {
        path: 'priorAuthorizations',
        select: 'dispute.status requestDetails.requestedService denial.denialDate',
      },
    });

    if (!patientGroup) {
      return res.status(404).json({ message: 'Patient group not found' });
    }

    // Get user's permission level
    const userMember = patientGroup.members.find(
      member => member.user._id.toString() === req.user.id.toString()
    );
    const userPermission = userMember ? userMember.permission : 'view';

    res.json({
      success: true,
      patientGroup,
      userPermission,
    });
  } catch (error) {
    console.error('Get patient group error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/patient-groups/:id
// @desc    Update patient group
// @access  Private
router.put('/:id', auth, [
  body('name').optional().notEmpty().trim(),
  body('description').optional().trim(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const patientGroup = await PatientGroup.findOne({
      _id: req.params.id,
      isActive: true,
    });

    if (!patientGroup) {
      return res.status(404).json({ message: 'Patient group not found' });
    }

    // Check if user has edit permission
    const userMember = patientGroup.members.find(
      member => member.user.toString() === req.user.id.toString()
    );

    if (!userMember || !['edit', 'admin'].includes(userMember.permission)) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }

    const { name, description, settings } = req.body;

    if (name) patientGroup.name = name;
    if (description !== undefined) patientGroup.description = description;
    if (settings) patientGroup.settings = { ...patientGroup.settings, ...settings };

    await patientGroup.save();

    await patientGroup.populate('owner', 'firstName lastName email');
    await patientGroup.populate('members.user', 'firstName lastName email');

    res.json({
      success: true,
      patientGroup,
    });
  } catch (error) {
    console.error('Update patient group error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/patient-groups/:id/invite
// @desc    Invite user to patient group
// @access  Private
router.post('/:id/invite', auth, [
  body('email').isEmail().normalizeEmail(),
  body('permission').isIn(['view', 'edit']),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, permission } = req.body;

    const patientGroup = await PatientGroup.findOne({
      _id: req.params.id,
      isActive: true,
    });

    if (!patientGroup) {
      return res.status(404).json({ message: 'Patient group not found' });
    }

    // Check if user has permission to invite
    const userMember = patientGroup.members.find(
      member => member.user.toString() === req.user.id.toString()
    );

    if (!userMember || !['edit', 'admin'].includes(userMember.permission)) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }

    // Check if user is already a member
    const existingMember = patientGroup.members.find(
      member => member.user.email === email
    );

    if (existingMember) {
      return res.status(400).json({ message: 'User is already a member' });
    }

    // Check if invitation already exists
    const existingInvite = patientGroup.pendingInvitations.find(
      invite => invite.email === email
    );

    if (existingInvite) {
      return res.status(400).json({ message: 'Invitation already sent' });
    }

    // Generate invitation token
    const inviteToken = crypto.randomBytes(32).toString('hex');

    // Add pending invitation
    patientGroup.pendingInvitations.push({
      email,
      permission,
      invitedBy: req.user.id,
      token: inviteToken,
    });

    await patientGroup.save();

    // Send notification to invited user (if they exist)
    const invitedUser = await User.findOne({ email });
    if (invitedUser) {
      invitedUser.notifications.push({
        type: 'invitation',
        message: `You've been invited to join "${patientGroup.name}" patient group`,
        relatedGroup: patientGroup._id,
      });
      await invitedUser.save();
    }

    res.json({
      success: true,
      message: 'Invitation sent successfully',
      inviteToken: process.env.NODE_ENV === 'development' ? inviteToken : undefined,
    });
  } catch (error) {
    console.error('Invite user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/patient-groups/join/:token
// @desc    Join patient group with invitation token
// @access  Private
router.post('/join/:token', auth, async (req, res) => {
  try {
    const { token } = req.params;

    const patientGroup = await PatientGroup.findOne({
      'pendingInvitations.token': token,
      isActive: true,
    });

    if (!patientGroup) {
      return res.status(404).json({ message: 'Invalid invitation token' });
    }

    const invitation = patientGroup.pendingInvitations.find(
      invite => invite.token === token
    );

    if (!invitation) {
      return res.status(404).json({ message: 'Invitation not found' });
    }

    // Check if invitation is for current user
    if (invitation.email !== req.user.email) {
      return res.status(403).json({ message: 'This invitation is not for you' });
    }

    // Check if user is already a member
    const existingMember = patientGroup.members.find(
      member => member.user.toString() === req.user.id.toString()
    );

    if (existingMember) {
      return res.status(400).json({ message: 'You are already a member' });
    }

    // Add user to group
    patientGroup.members.push({
      user: req.user.id,
      permission: invitation.permission,
    });

    // Remove pending invitation
    patientGroup.pendingInvitations = patientGroup.pendingInvitations.filter(
      invite => invite.token !== token
    );

    await patientGroup.save();

    // Add group to user's patientGroups
    await User.findByIdAndUpdate(req.user.id, {
      $push: {
        patientGroups: {
          group: patientGroup._id,
          permission: invitation.permission,
        },
      },
    });

    await patientGroup.populate('owner', 'firstName lastName email');
    await patientGroup.populate('members.user', 'firstName lastName email');

    res.json({
      success: true,
      message: 'Successfully joined patient group',
      patientGroup,
    });
  } catch (error) {
    console.error('Join patient group error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/patient-groups/:id/members/:userId
// @desc    Remove member from patient group
// @access  Private
router.delete('/:id/members/:userId', auth, async (req, res) => {
  try {
    const patientGroup = await PatientGroup.findOne({
      _id: req.params.id,
      isActive: true,
    });

    if (!patientGroup) {
      return res.status(404).json({ message: 'Patient group not found' });
    }

    // Check if user has admin permission
    const userMember = patientGroup.members.find(
      member => member.user.toString() === req.user.id.toString()
    );

    if (!userMember || userMember.permission !== 'admin') {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }

    // Don't allow removing the owner
    if (patientGroup.owner.toString() === req.params.userId) {
      return res.status(400).json({ message: 'Cannot remove group owner' });
    }

    // Remove member
    patientGroup.members = patientGroup.members.filter(
      member => member.user.toString() !== req.params.userId
    );

    await patientGroup.save();

    // Remove group from user's patientGroups
    await User.findByIdAndUpdate(req.params.userId, {
      $pull: {
        patientGroups: { group: patientGroup._id },
      },
    });

    res.json({
      success: true,
      message: 'Member removed successfully',
    });
  } catch (error) {
    console.error('Remove member error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/patient-groups/:id
// @desc    Delete patient group
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const patientGroup = await PatientGroup.findOne({
      _id: req.params.id,
      owner: req.user.id,
      isActive: true,
    });

    if (!patientGroup) {
      return res.status(404).json({ message: 'Patient group not found or insufficient permissions' });
    }

    // Soft delete
    patientGroup.isActive = false;
    await patientGroup.save();

    // Remove from all users' patientGroups
    await User.updateMany(
      { 'patientGroups.group': patientGroup._id },
      { $pull: { patientGroups: { group: patientGroup._id } } }
    );

    res.json({
      success: true,
      message: 'Patient group deleted successfully',
    });
  } catch (error) {
    console.error('Delete patient group error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;