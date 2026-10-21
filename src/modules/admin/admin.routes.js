import { Router } from 'express';
import { AdminService } from './admin.service.js';
import { ProviderProfile } from '../providers/provider.model.js';
import { User } from '../users/user.model.js';
import { Booking } from '../bookings/booking.model.js';
import { authenticate } from '../../core/middlewares/auth.js';
import { authorize } from '../../core/middlewares/authorize.js';
import { BadRequestError } from '../../core/errors/AppError.js';

const router = Router();

// Strict RBAC: Admin & Superadmin only
router.use(authenticate, authorize('admin', 'superadmin'));

// KPI Metrics Dashboard
router.get('/dashboard', async (req, res, next) => {
  try {
    const metrics = await AdminService.getDashboardMetrics();
    res.json({ success: true, data: metrics });
  } catch (err) {
    next(err);
  }
});

// List pending KYC verification requests
router.get('/providers/pending', async (req, res, next) => {
  try {
    const pending = await ProviderProfile.find({ verificationStatus: 'PENDING' })
      .populate('userId', 'fullName email phone address avatarUrl createdAt')
      .populate('categoryIds', 'name');

    res.json({ success: true, data: pending });
  } catch (err) {
    next(err);
  }
});

// Approve or Reject Provider KYC
router.patch('/providers/:id/verify', async (req, res, next) => {
  try {
    const { status, reason } = req.body;
    if (!status) throw new BadRequestError('status is required (VERIFIED or REJECTED)');

    const provider = await AdminService.verifyProvider({
      providerId: req.params.id,
      status,
      actorId: req.user._id,
      ipAddress: req.ip,
      reason
    });

    res.json({ success: true, data: provider });
  } catch (err) {
    next(err);
  }
});

// List Audit Logs
router.get('/audit-logs', async (req, res, next) => {
  try {
    const { limit, page } = req.query;
    const logs = await AdminService.listAuditLogs({
      limit: limit ? Number(limit) : 50,
      page: page ? Number(page) : 1
    });

    res.json({ success: true, data: logs });
  } catch (err) {
    next(err);
  }
});

// Manage users (list, toggle suspension)
router.get('/users', async (req, res, next) => {
  try {
    const users = await User.find().sort({ createdAt: -1 }).limit(100);
    res.json({ success: true, data: users });
  } catch (err) {
    next(err);
  }
});

router.patch('/users/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body;
    const user = await User.findByIdAndUpdate(req.params.id, { status }, { new: true });
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
});

// View all bookings across system
router.get('/bookings', async (req, res, next) => {
  try {
    const bookings = await Booking.find()
      .populate('clientId', 'fullName email phone')
      .populate('providerId', 'fullName email phone')
      .populate('serviceId', 'name basePrice')
      .sort({ createdAt: -1 })
      .limit(100);

    res.json({ success: true, data: bookings });
  } catch (err) {
    next(err);
  }
});

export default router;
