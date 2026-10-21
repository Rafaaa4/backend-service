import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { Payment, PaymentEvent } from './payment.model.js';
import { Booking } from '../bookings/booking.model.js';
import { BookingsService } from '../bookings/bookings.service.js';
import { env } from '../../config/env.js';
import {
  BadRequestError,
  NotFoundError,
  UnauthorizedError
} from '../../core/errors/AppError.js';
import { logger } from '../../core/logger/index.js';

export class PaymentService {
  /**
   * Initiate deposit checkout for a pending booking
   */
  static async initiateCheckout({ bookingId, clientId }) {
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      throw new NotFoundError('Booking not found');
    }

    if (booking.clientId.toString() !== clientId.toString()) {
      throw new UnauthorizedError('You are not authorized to pay for this booking');
    }

    if (booking.status !== 'PENDING_PAYMENT') {
      throw new BadRequestError(`Cannot pay for booking in status ${booking.status}`);
    }

    // Always recalculate amount server-side from frozen price snapshot
    const depositAmount = booking.priceSnapshot.depositAmount;
    const transactionRef = `TXN-${Date.now()}-${uuidv4().substring(0, 8)}`;

    // Create payment URL (points to mock checkout or gateway checkout)
    const paymentUrl = `${env.API_PREFIX}/payments/mock-gateway?ref=${transactionRef}&amount=${depositAmount}`;

    const payment = await Payment.create({
      bookingId: booking._id,
      clientId,
      providerId: booking.providerId,
      amount: depositAmount,
      currency: 'TND',
      type: 'DEPOSIT',
      status: 'INITIATED',
      providerName: 'MOCK_SANDBOX',
      transactionReference: transactionRef,
      paymentUrl
    });

    return {
      paymentId: payment._id,
      transactionReference: transactionRef,
      amount: depositAmount,
      currency: 'TND',
      checkoutUrl: paymentUrl
    };
  }

  /**
   * Verify signature and process webhook with strict idempotency
   */
  static async processWebhook({ signature, payload }) {
    const { eventId, transactionReference, status } = payload;

    if (!eventId || !transactionReference) {
      throw new BadRequestError('Invalid webhook payload: missing eventId or transactionReference');
    }

    // Verify HMAC-SHA256 signature
    const expectedSig = crypto
      .createHmac('sha256', env.PAYMENT_WEBHOOK_SECRET)
      .update(JSON.stringify(payload))
      .digest('hex');

    if (signature !== expectedSig && process.env.NODE_ENV === 'production') {
      throw new UnauthorizedError('Invalid webhook signature');
    }

    // IDEMPOTENCY CHECK: Check if eventId was already processed
    const alreadyProcessed = await PaymentEvent.findOne({ providerEventId: eventId });
    if (alreadyProcessed) {
      logger.info({ eventId }, 'Webhook event already processed (idempotent skipped)');
      return { success: true, idempotent: true };
    }

    // Record event immediately to prevent concurrent duplicate processing
    await PaymentEvent.create({
      providerEventId: eventId,
      providerName: 'MOCK_SANDBOX',
      payload
    });

    const payment = await Payment.findOne({ transactionReference });
    if (!payment) {
      throw new NotFoundError(`Payment with reference ${transactionReference} not found`);
    }

    if (status === 'SUCCESS' || status === 'COMPLETED') {
      payment.status = 'COMPLETED';
      await payment.save();

      const booking = await Booking.findById(payment.bookingId);
      if (booking && booking.status === 'PENDING_PAYMENT') {
        booking.paymentStatus = 'DEPOSIT_PAID';
        await booking.save();

        await BookingsService.transitionStatus({
          bookingId: booking._id,
          targetStatus: 'AWAITING_PROVIDER',
          actorId: payment.clientId,
          actorRole: 'client',
          reason: `Deposit payment of ${payment.amount} millimes confirmed via webhook`
        });
      }
    } else {
      payment.status = 'FAILED';
      await payment.save();

      await BookingsService.transitionStatus({
        bookingId: payment.bookingId,
        targetStatus: 'PAYMENT_FAILED',
        actorId: payment.clientId,
        actorRole: 'system',
        reason: 'Payment transaction failed or rejected'
      });
    }

    return { success: true, processed: true };
  }

  /**
   * Helper to simulate webhook trigger for mock / sandbox gateway
   */
  static async simulatePaymentConfirmation(transactionReference, isSuccess = true) {
    const payload = {
      eventId: `EVT-${Date.now()}-${uuidv4().substring(0, 6)}`,
      transactionReference,
      status: isSuccess ? 'SUCCESS' : 'FAILED',
      timestamp: new Date().toISOString()
    };

    const signature = crypto
      .createHmac('sha256', env.PAYMENT_WEBHOOK_SECRET)
      .update(JSON.stringify(payload))
      .digest('hex');

    return await this.processWebhook({ signature, payload });
  }
}
