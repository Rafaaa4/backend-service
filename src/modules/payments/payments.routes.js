import { Router } from 'express';
import { PaymentService } from './payment.service.js';
import { authenticate } from '../../core/middlewares/auth.js';
import { BadRequestError } from '../../core/errors/AppError.js';

const router = Router();

// Authenticated: Initiate payment for booking deposit
router.post('/checkout', authenticate, async (req, res, next) => {
  try {
    const { bookingId } = req.body;
    if (!bookingId) throw new BadRequestError('bookingId is required');

    const result = await PaymentService.initiateCheckout({
      bookingId,
      clientId: req.user._id
    });

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// Webhook endpoint: Unauthenticated, signature protected & idempotent
router.post('/webhook', async (req, res, next) => {
  try {
    const signature = req.headers['x-signature'] || req.headers['x-webhook-signature'];
    const result = await PaymentService.processWebhook({
      signature,
      payload: req.body
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Sandbox Mock helper: Simulate payment completion
router.post('/mock-simulate', async (req, res, next) => {
  try {
    const { transactionReference, success = true } = req.body;
    if (!transactionReference) throw new BadRequestError('transactionReference is required');

    const result = await PaymentService.simulatePaymentConfirmation(transactionReference, success);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

export default router;
