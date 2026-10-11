import { Router } from 'express';
import { login, adminLogin, getCurrentUser, logout, logoutAll, changePassword } from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';
import { loginAccountLimiter, loginIpLimiter, passwordLimiter } from '../middleware/rateLimit.js';
import { asyncHandler } from '../utils/httpError.js';

const router = Router();


router.post('/login', loginIpLimiter, loginAccountLimiter, asyncHandler(login));
router.post('/admin-login', loginIpLimiter, loginAccountLimiter, asyncHandler(adminLogin));
router.get('/me', authenticate, asyncHandler(getCurrentUser));
router.post('/logout', authenticate, logout);
router.post('/logout-all', authenticate, asyncHandler(logoutAll));
router.post('/change-password', authenticate, passwordLimiter, asyncHandler(changePassword));

export default router;
