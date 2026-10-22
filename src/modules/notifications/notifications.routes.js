import { Router } from 'express';
import { Notification } from './notification.model.js';
import { authenticate } from '../../core/middlewares/auth.js';

const router = Router();

router.use(authenticate);

// Get current user's notifications
router.get('/', async (req, res, next) => {
  try {
    let notifications = await Notification.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(30);

    // If empty for demo/new user, auto-populate welcome notifications
    if (notifications.length === 0) {
      notifications = await Notification.create([
        {
          userId: req.user._id,
          title: 'Bienvenue sur HomeServices TN 🎉',
          message: 'Votre compte est prêt ! Trouvez dès maintenant les meilleurs artisans certifiés en Tunisie.',
          type: 'SYSTEM',
          isRead: false
        },
        {
          userId: req.user._id,
          title: 'Paiement en séquestre sécurisé 🛡️',
          message: 'Vos acomptes sont protégés par la plateforme et libérés uniquement après confirmation de la prestation.',
          type: 'PAYMENT',
          isRead: false
        },
        {
          userId: req.user._id,
          title: 'Offre Spéciale Bienvenue (-15%)',
          message: 'Profitez de 15% de réduction sur votre première réservation de plomberie ou électricité.',
          type: 'PROMO',
          isRead: true
        }
      ]);
    }

    const unreadCount = await Notification.countDocuments({ userId: req.user._id, isRead: false });

    res.json({
      success: true,
      data: {
        notifications,
        unreadCount
      }
    });
  } catch (err) {
    next(err);
  }
});

// Mark single notification as read
router.patch('/:id/read', async (req, res, next) => {
  try {
    const notif = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $set: { isRead: true } },
      { new: true }
    );
    res.json({ success: true, data: notif });
  } catch (err) {
    next(err);
  }
});

// Mark all as read
router.patch('/read-all', async (req, res, next) => {
  try {
    await Notification.updateMany(
      { userId: req.user._id, isRead: false },
      { $set: { isRead: true } }
    );
    res.json({ success: true, message: 'Toutes les notifications sont marquées comme lues' });
  } catch (err) {
    next(err);
  }
});

export default router;
