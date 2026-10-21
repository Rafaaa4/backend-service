import { Conversation, Message } from './chat.model.js';
import { Booking } from '../bookings/booking.model.js';
import { filterChatContent } from '../../core/security/contentFilter.js';
import { ForbiddenError, NotFoundError } from '../../core/errors/AppError.js';

export class ChatService {
  static async getOrCreateConversation(bookingId, userId) {
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      throw new NotFoundError('Booking not found');
    }

    const isClient = booking.clientId.toString() === userId.toString();
    const isProvider = booking.providerId.toString() === userId.toString();

    if (!isClient && !isProvider) {
      throw new ForbiddenError('You are not authorized to access this conversation');
    }

    let conversation = await Conversation.findOne({ bookingId })
      .populate('participants', 'fullName avatarUrl role');

    if (!conversation) {
      conversation = await Conversation.create({
        bookingId,
        participants: [booking.clientId, booking.providerId]
      });
      conversation = await conversation.populate('participants', 'fullName avatarUrl role');
    }

    return conversation;
  }

  static async sendMessage({ bookingId, senderId, content }) {
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      throw new NotFoundError('Booking not found');
    }

    const isClient = booking.clientId.toString() === senderId.toString();
    const isProvider = booking.providerId.toString() === senderId.toString();

    if (!isClient && !isProvider) {
      throw new ForbiddenError('You are not authorized to send messages in this conversation');
    }

    let conversation = await Conversation.findOne({ bookingId });
    if (!conversation) {
      conversation = await Conversation.create({
        bookingId,
        participants: [booking.clientId, booking.providerId]
      });
    }

    // Filter contact details if booking is not yet confirmed
    let finalContent = content;
    const isConfirmed = ['CONFIRMED', 'IN_PROGRESS', 'COMPLETED'].includes(booking.status);
    if (!isConfirmed) {
      const { sanitized } = filterChatContent(content);
      finalContent = sanitized;
    }

    const message = await Message.create({
      conversationId: conversation._id,
      bookingId,
      senderId,
      content: finalContent,
      readBy: [senderId]
    });

    conversation.lastMessage = {
      content: finalContent,
      senderId,
      createdAt: new Date()
    };
    await conversation.save();

    return message;
  }

  static async getMessages(bookingId, userId, { limit = 50, before }) {
    const conversation = await this.getOrCreateConversation(bookingId, userId);

    const query = { conversationId: conversation._id };
    if (before) {
      query.createdAt = { $lt: new Date(before) };
    }

    const messages = await Message.find(query)
      .populate('senderId', 'fullName avatarUrl')
      .sort({ createdAt: -1 })
      .limit(Number(limit));

    // Mark as read
    await Message.updateMany(
      { conversationId: conversation._id, readBy: { $ne: userId } },
      { $addToSet: { readBy: userId } }
    );

    return messages.reverse();
  }
}
