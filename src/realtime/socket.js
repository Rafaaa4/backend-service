import { Server } from 'socket.io';
import { verifyAccessToken } from '../core/security/tokens.js';
import { User } from '../modules/users/user.model.js';
import { Booking } from '../modules/bookings/booking.model.js';
import { ChatService } from '../modules/chat/chat.service.js';
import { logger } from '../core/logger/index.js';

let ioInstance = null;

export const initSocketIO = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    },
    transports: ['websocket', 'polling']
  });

  // Handshake authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];
      if (!token) {
        return next(new Error('Authentication token required'));
      }

      const decoded = verifyAccessToken(token);
      const user = await User.findById(decoded.sub);
      if (!user || user.status === 'suspended') {
        return next(new Error('User account not active'));
      }

      socket.user = user;
      socket.userId = user._id.toString();
      next();
    } catch (err) {
      next(new Error('Authentication failed: ' + err.message));
    }
  });

  io.on('connection', (socket) => {
    logger.info({ userId: socket.userId }, 'Socket connected');

    // Automatically join private user room
    socket.join(`user:${socket.userId}`);

    // Join conversation room with server authorization
    socket.on('join_conversation', async ({ bookingId }, callback) => {
      try {
        const booking = await Booking.findById(bookingId);
        if (!booking) {
          if (callback) callback({ error: 'Booking not found' });
          return;
        }

        const isClient = booking.clientId.toString() === socket.userId;
        const isProvider = booking.providerId.toString() === socket.userId;
        const isAdmin = ['admin', 'superadmin'].includes(socket.user.role);

        if (!isClient && !isProvider && !isAdmin) {
          if (callback) callback({ error: 'Unauthorized room access' });
          return;
        }

        socket.join(`conversation:${bookingId}`);
        if (callback) callback({ success: true, room: `conversation:${bookingId}` });
      } catch (err) {
        if (callback) callback({ error: err.message });
      }
    });

    // Real-time chat message sending
    socket.on('send_message', async ({ bookingId, content }, callback) => {
      try {
        const message = await ChatService.sendMessage({
          bookingId,
          senderId: socket.userId,
          content
        });

        // Broadcast to conversation room
        io.to(`conversation:${bookingId}`).emit('new_message', message);

        if (callback) callback({ success: true, message });
      } catch (err) {
        if (callback) callback({ error: err.message });
      }
    });

    socket.on('disconnect', () => {
      logger.info({ userId: socket.userId }, 'Socket disconnected');
    });
  });

  ioInstance = io;
  return io;
};

export const getIO = () => ioInstance;

/**
 * Emit event to a specific user
 */
export const emitToUser = (userId, event, data) => {
  if (ioInstance) {
    ioInstance.to(`user:${userId}`).emit(event, data);
  }
};
