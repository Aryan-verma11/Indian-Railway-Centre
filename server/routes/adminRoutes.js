import { Router } from 'express';
import * as admin from '../controllers/adminController.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { adminResetLimiter } from '../middleware/rateLimit.js';
import { asyncHandler as wrap } from '../utils/httpError.js';

const router = Router();

router.use(authenticate, requireRole('admin'));

router.get('/stats', wrap(admin.getStats));
router.get('/audit-logs', wrap(admin.listAuditLogs));
router.get('/users', wrap(admin.listUsers));
router.post('/users', wrap(admin.createUser));
router.get('/users/:id', wrap(admin.getUser));
router.put('/users/:id', wrap(admin.updateUser));
router.delete('/users/:id', wrap(admin.deleteUser));
router.patch('/users/:id/status', wrap(admin.setStatus));
router.patch('/users/:id/role', wrap(admin.setRole));
router.post('/users/:id/reset-password', adminResetLimiter, wrap(admin.resetPassword));

export default router;
