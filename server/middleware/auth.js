
import { getCurrentUser } from '../routes/auth.js';

// 要求用户已登录
export function requireAuth(req, res, next) {
  const user = getCurrentUser(req);

  if (!user) {
    return res.status(401).json({
      success: false,
      message: '请先登录',
    });
  }

  req.user = user;
  next();
}

// 要求用户已登录且具有管理员权限
export function requireAdmin(req, res, next) {
  const user = getCurrentUser(req);

  if (!user) {
    return res.status(401).json({
      success: false,
      message: '请先登录',
    });
  }

  if (user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: '权限不足',
    });
  }

  req.user = user;
  next();
}
