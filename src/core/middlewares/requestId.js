import { v4 as uuidv4 } from 'uuid';

export const requestIdMiddleware = (req, res, next) => {
  const incomingId = req.headers['x-request-id'];
  const requestId = incomingId || uuidv4();
  req.id = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
};
