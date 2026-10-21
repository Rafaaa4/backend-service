import { Router } from 'express';
import { ChatService } from './chat.service.js';
import { Conversation } from './chat.model.js';
import { authenticate } from '../../core/middlewares/auth.js';
import { messageLimiter } from '../../core/middlewares/rateLimiter.js';
import { BadRequestError } from '../../core/errors/AppError.js';

const router = Router();

router.use(authenticate);

// List user's conversations
router.get('/', async (req, res, next) => {
  try {
    const conversations = await Conversation.find({ participants: req.user._id })
      .populate('participants', 'fullName avatarUrl role')
      .populate('bookingId', 'status startAt')
      .sort({ updatedAt: -1 });

    res.json({ success: true, data: conversations });
  } catch (err) {
    next(err);
  }
});

// Get messages for booking conversation
router.get('/:bookingId/messages', async (req, res, next) => {
  try {
    const { bookingId } = req.params;
    const { limit, before } = req.query;

    const messages = await ChatService.getMessages(bookingId, req.user._id, {
      limit: limit ? Number(limit) : 50,
      before
    });

    res.json({ success: true, data: messages });
  } catch (err) {
    next(err);
  }
});

// Send message
router.post('/:bookingId/messages', messageLimiter, async (req, res, next) => {
  try {
    const { bookingId } = req.params;
    const { content } = req.body;

    if (!content || !content.trim()) {
      throw new BadRequestError('Message content cannot be empty');
    }

    const message = await ChatService.sendMessage({
      bookingId,
      senderId: req.user._id,
      content: content.trim()
    });

    res.status(201).json({ success: true, data: message });
  } catch (err) {
    next(err);
  }
});

export default router;
