import { ConflictError, ForbiddenError } from '../../core/errors/AppError.js';

export const VALID_TRANSITIONS = {
  PENDING_PAYMENT: ['AWAITING_PROVIDER', 'EXPIRED', 'PAYMENT_FAILED', 'CANCELLED_BY_CLIENT'],
  AWAITING_PROVIDER: ['CONFIRMED', 'REJECTED', 'EXPIRED', 'CANCELLED_BY_CLIENT'],
  CONFIRMED: ['IN_PROGRESS', 'CANCELLED_BY_CLIENT', 'CANCELLED_BY_PROVIDER', 'DISPUTED'],
  IN_PROGRESS: ['COMPLETED', 'DISPUTED'],
  COMPLETED: ['DISPUTED'],
  EXPIRED: [],
  PAYMENT_FAILED: [],
  REJECTED: [],
  CANCELLED_BY_CLIENT: [],
  CANCELLED_BY_PROVIDER: [],
  DISPUTED: ['COMPLETED', 'CANCELLED_BY_CLIENT', 'CANCELLED_BY_PROVIDER']
};

export const TRANSITION_ACTOR_ROLES = {
  AWAITING_PROVIDER: ['client', 'system', 'admin'],
  CONFIRMED: ['provider', 'admin'],
  REJECTED: ['provider', 'admin'],
  IN_PROGRESS: ['provider', 'admin'],
  COMPLETED: ['provider', 'admin'],
  CANCELLED_BY_CLIENT: ['client', 'admin'],
  CANCELLED_BY_PROVIDER: ['provider', 'admin'],
  DISPUTED: ['client', 'provider', 'admin', 'support'],
  EXPIRED: ['system', 'admin'],
  PAYMENT_FAILED: ['system', 'admin']
};

export const validateTransition = (currentStatus, targetStatus, actorRole) => {
  const allowedNext = VALID_TRANSITIONS[currentStatus] || [];
  if (!allowedNext.includes(targetStatus)) {
    throw new ConflictError(
      `Invalid state transition: Cannot transition booking from ${currentStatus} to ${targetStatus}`,
      'INVALID_TRANSITION'
    );
  }

  const allowedRoles = TRANSITION_ACTOR_ROLES[targetStatus] || ['admin'];
  if (!allowedRoles.includes(actorRole) && actorRole !== 'superadmin') {
    throw new ForbiddenError(
      `Role '${actorRole}' is not authorized to transition booking to ${targetStatus}`,
      'UNAUTHORIZED_TRANSITION'
    );
  }

  return true;
};
