import { AuthService } from './auth.service.js';

export class AuthController {
  static async register(req, res, next) {
    try {
      const result = await AuthService.register({
        ...req.body,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'] || '',
        deviceId: req.body.deviceId
      });

      res.status(201).json({
        success: true,
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  static async login(req, res, next) {
    try {
      const result = await AuthService.login({
        ...req.body,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'] || ''
      });

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  static async refresh(req, res, next) {
    try {
      const result = await AuthService.refreshTokens({
        refreshToken: req.body.refreshToken,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'] || ''
      });

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  static async logout(req, res, next) {
    try {
      await AuthService.logout(req.sessionId);
      res.status(200).json({
        success: true,
        message: 'Successfully logged out'
      });
    } catch (err) {
      next(err);
    }
  }

  static async logoutAll(req, res, next) {
    try {
      await AuthService.logoutAll(req.user._id);
      res.status(200).json({
        success: true,
        message: 'All active sessions have been terminated'
      });
    } catch (err) {
      next(err);
    }
  }

  static async setup2fa(req, res, next) {
    try {
      const result = await AuthService.setup2fa(req.user._id);
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  static async enable2fa(req, res, next) {
    try {
      const result = await AuthService.enable2fa(req.user._id, req.body.totpCode);
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (err) {
      next(err);
    }
  }
}
