
import { Router } from 'express';
import {
  randomUUID,
  randomBytes,
  createHash,
  pbkdf2 as pbkdf2Callback,
  timingSafeEqual,
} from 'node:crypto';
import { promisify } from 'node:util';
import { db, saveDatabase } from '../db.js';
import { queryOne } from '../utils/db-query.js';

const router = Router();
const pbkdf2 = promisify(pbkdf2Callback);
const PBKDF2_ITERATIONS = 600000;

const SESSION_COOKIE_NAME = 'agent_studio_session';
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

// 密码使用随机盐和 scrypt 哈希，不保存明文密码。

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = await pbkdf2(
    password,
    salt,
    PBKDF2_ITERATIONS,
    64,
    'sha512'
  );

  return `pbkdf2$${PBKDF2_ITERATIONS}$${salt}$${derivedKey.toString('hex')}`;
}

async function verifyPassword(password, storedHash) {
  try {
    const parts = storedHash.split('$');

    if (parts.length !== 4 || parts[0] !== 'pbkdf2') {
      return false;
    }

    const iterations = Number(parts[1]);
    const salt = parts[2];
    const keyHex = parts[3];

    if (
      !Number.isSafeInteger(iterations) ||
      iterations < 100000 ||
      iterations > 1000000 ||
      !/^[a-f0-9]{32}$/i.test(salt) ||
      !/^[a-f0-9]{128}$/i.test(keyHex)
    ) {
      return false;
    }

    const expected = Buffer.from(keyHex, 'hex');
    const actual = await pbkdf2(
      password,
      salt,
      iterations,
      expected.length,
      'sha512'
    );

    return timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}


function getCookie(req, name) {
  const cookieHeader = req.headers.cookie ?? '';

  for (const item of cookieHeader.split(';')) {
    const separator = item.indexOf('=');

    if (separator < 0) continue;

    const key = item.slice(0, separator).trim();
    const value = item.slice(separator + 1).trim();

    if (key === name) {
      try {
        return decodeURIComponent(value);
      } catch {
        return null;
      }
    }
  }

  return null;
}

function setSessionCookie(res, token, expiresAt) {
  const cookie = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Expires=${new Date(expiresAt).toUTCString()}`,
  ];

  if (process.env.NODE_ENV === 'production') {
    cookie.push('Secure');
  }

  res.setHeader('Set-Cookie', cookie.join('; '));
}

function clearSessionCookie(res) {
  const cookie = [
    `${SESSION_COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
    'Max-Age=0',
  ];

  if (process.env.NODE_ENV === 'production') {
    cookie.push('Secure');
  }

  res.setHeader('Set-Cookie', cookie.join('; '));
}

// 验证会话，并从数据库获取用户身份。
export function getCurrentUser(req) {
  const token = getCookie(req, SESSION_COOKIE_NAME);

  if (!token || token.length > 200) {
    return null;
  }

  const session = queryOne(
    `SELECT
       s.id AS session_id,
       s.user_id,
       s.expires_at,
       u.username,
       u.email,
       u.role,
       u.status
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ?
       AND s.revoked_at IS NULL`,
    [hashToken(token)]
  );

  if (!session) return null;

  if (
    !Number.isFinite(Date.parse(session.expires_at)) ||
    Date.parse(session.expires_at) <= Date.now()
  ) {
    return null;
  }

  if (session.status !== 'active') {
    return null;
  }

  return {
    sessionId: session.session_id,
    id: session.user_id,
    username: session.username,
    email: session.email,
    role: session.role,
  };
}

// POST /api/auth/login

/**
 * 管理员权限检查。
 * 不依赖 middleware/auth.js，避免与当前认证模块形成循环导入。
 */
function getAdminUser(req) {
  const user = getCurrentUser(req);
  return user?.role === 'admin' ? user : null;
}

// POST /api/auth/register
// 使用有效邀请码注册普通用户，不允许客户端指定角色。
router.post('/register', async (req, res) => {
  const { username, email, password, invitationCode } = req.body ?? {};

  if (
    typeof username !== 'string' ||
    typeof email !== 'string' ||
    typeof password !== 'string' ||
    typeof invitationCode !== 'string'
  ) {
    return res.status(400).json({
      success: false,
      message: '请填写用户名、邮箱、密码和邀请码',
    });
  }

  const normalizedUsername = username.trim();
  const normalizedEmail = email.trim().toLowerCase();

  if (!/^[a-zA-Z0-9_-]{3,32}$/.test(normalizedUsername)) {
    return res.status(400).json({
      success: false,
      message: '用户名须为 3-32 位字母、数字、下划线或连字符',
    });
  }

  if (
    normalizedEmail.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
  ) {
    return res.status(400).json({
      success: false,
      message: '邮箱格式不正确',
    });
  }

  if (password.length < 12 || password.length > 1024) {
    return res.status(400).json({
      success: false,
      message: '密码长度须为 12-1024 个字符',
    });
  }

  if (
    invitationCode.length < 20 ||
    invitationCode.length > 200
  ) {
    return res.status(400).json({
      success: false,
      message: '邀请码无效或已失效',
    });
  }

  // 先完成耗时的密码哈希，避免持有数据库事务时进行 PBKDF2 运算。
  let passwordHash;

  try {
    passwordHash = await hashPassword(password);
  } catch (error) {
    console.error('注册密码处理失败：', error.message);
    return res.status(500).json({
      success: false,
      message: '注册失败，请稍后重试',
    });
  }

  const now = new Date().toISOString();
  const userId = randomUUID();

  try {
    db.run('BEGIN IMMEDIATE');

    const invitation = queryOne(
      `SELECT id, expires_at, used_at, revoked_at
       FROM invitations
       WHERE token_hash = ?`,
      [hashToken(invitationCode)]
    );

    if (
      !invitation ||
      invitation.used_at !== null ||
      invitation.revoked_at !== null ||
      !Number.isFinite(Date.parse(invitation.expires_at)) ||
      Date.parse(invitation.expires_at) <= Date.now()
    ) {
      db.run('ROLLBACK');

      return res.status(400).json({
        success: false,
        message: '邀请码无效或已失效',
      });
    }

    // role 固定为 user，不读取客户端传来的 role。
    db.run(
      `INSERT INTO users
        (id, username, email, password_hash, role, status,
         created_at, updated_at, last_login_at)
       VALUES (?, ?, ?, ?, 'user', 'active', ?, ?, NULL)`,
      [
        userId,
        normalizedUsername,
        normalizedEmail,
        passwordHash,
        now,
        now,
      ]
    );

    // 条件更新再次检查状态，避免重复使用。
    db.run(
      `UPDATE invitations
       SET used_by = ?, used_at = ?
       WHERE id = ?
         AND used_at IS NULL
         AND revoked_at IS NULL
         AND expires_at > ?`,
      [userId, now, invitation.id, now]
    );

    const updatedInvitation = queryOne(
      `SELECT used_by
       FROM invitations
       WHERE id = ?`,
      [invitation.id]
    );

    if (!updatedInvitation || updatedInvitation.used_by !== userId) {
      throw new Error('邀请码状态更新失败');
    }

    db.run('COMMIT');
    saveDatabase();

    return res.status(201).json({
      success: true,
      message: '注册成功，请登录',
      data: {
        user: {
          id: userId,
          username: normalizedUsername,
          email: normalizedEmail,
          role: 'user',
        },
      },
    });
  } catch (error) {
    try {
      db.run('ROLLBACK');
    } catch {
      // 事务可能已经结束。
    }

    // 不向客户端泄露数据库错误、SQL 或账号是否已存在的细节。
    if (
      /UNIQUE constraint failed: users\.(username|email)/i.test(
        error.message
      )
    ) {
      return res.status(409).json({
        success: false,
        message: '用户名或邮箱已被使用',
      });
    }

    console.error('注册失败：', error.message);

    return res.status(500).json({
      success: false,
      message: '注册失败，请稍后重试',
    });
  }
});

// POST /api/auth/invitations
// 只有管理员能创建邀请码。
router.post('/invitations', (req, res) => {
  const admin = getAdminUser(req);

  if (!admin) {
    const currentUser = getCurrentUser(req);

    return res.status(currentUser ? 403 : 401).json({
      success: false,
      message: currentUser ? '权限不足' : '请先登录',
    });
  }

  const { expiresInDays = 7 } = req.body ?? {};

  if (
    !Number.isSafeInteger(expiresInDays) ||
    expiresInDays < 1 ||
    expiresInDays > 30
  ) {
    return res.status(400).json({
      success: false,
      message: '邀请码有效期须为 1-30 天',
    });
  }

  const id = randomUUID();
  const token = randomBytes(32).toString('base64url');
  const now = new Date();
  const createdAt = now.toISOString();
  const expiresAt = new Date(
    now.getTime() + expiresInDays * 24 * 60 * 60 * 1000
  ).toISOString();

  try {
    db.run(
      `INSERT INTO invitations
        (id, token_hash, created_by, used_by, created_at,
         expires_at, used_at, revoked_at)
       VALUES (?, ?, ?, NULL, ?, ?, NULL, NULL)`,
      [id, hashToken(token), admin.id, createdAt, expiresAt]
    );

    saveDatabase();

    // 明文邀请码只在创建成功时返回一次。
    return res.status(201).json({
      success: true,
      message: '邀请码创建成功，请立即安全保存',
      data: {
        id,
        invitationCode: token,
        expiresAt,
      },
    });
  } catch (error) {
    console.error('创建邀请码失败：', error.message);

    return res.status(500).json({
      success: false,
      message: '创建邀请码失败',
    });
  }
});

// POST /api/auth/invitations/:id/revoke
router.post('/invitations/:id/revoke', (req, res) => {
  const admin = getAdminUser(req);

  if (!admin) {
    const currentUser = getCurrentUser(req);

    return res.status(currentUser ? 403 : 401).json({
      success: false,
      message: currentUser ? '权限不足' : '请先登录',
    });
  }

  const id = req.params.id;

  try {
    db.run(
      `UPDATE invitations
       SET revoked_at = ?
       WHERE id = ?
         AND used_at IS NULL
         AND revoked_at IS NULL`,
      [new Date().toISOString(), id]
    );

    saveDatabase();

    return res.json({
      success: true,
      message: '撤销请求已处理；邀请码可能已使用或不存在',
    });
  } catch (error) {
    console.error('撤销邀请码失败：', error.message);

    return res.status(500).json({
      success: false,
      message: '撤销邀请码失败',
    });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body ?? {};

    if (
      typeof username !== 'string' ||
      typeof password !== 'string' ||
      !username.trim() ||
      !password ||
      username.length > 254 ||
      password.length > 1024
    ) {
      return res.status(400).json({
        success: false,
        message: '请输入有效的用户名和密码',
      });
    }

    const account = queryOne(
      `SELECT id, username, email, password_hash, role, status
       FROM users
       WHERE username = ? OR email = ?
       LIMIT 1`,
      [username.trim(), username.trim()]
    );

    if (
      !account ||
      account.status !== 'active' ||
      !(await verifyPassword(password, account.password_hash))
    ) {
      return res.status(401).json({
        success: false,
        message: '用户名、邮箱或密码错误',
      });
    }

    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + SESSION_DURATION_MS
    ).toISOString();

    const sessionId = randomUUID();
    const token = randomBytes(32).toString('base64url');

    db.run(
      `INSERT INTO sessions
        (id, user_id, token_hash, created_at, expires_at,
         last_seen_at, revoked_at)
       VALUES (?, ?, ?, ?, ?, ?, NULL)`,
      [
        sessionId,
        account.id,
        hashToken(token),
        now.toISOString(),
        expiresAt,
        now.toISOString(),
      ]
    );

    db.run(
      `UPDATE users
       SET last_login_at = ?, updated_at = ?
       WHERE id = ?`,
      [now.toISOString(), now.toISOString(), account.id]
    );

    saveDatabase();
    setSessionCookie(res, token, expiresAt);

    return res.json({
      success: true,
      data: {
        user: {
          id: account.id,
          username: account.username,
          email: account.email,
          role: account.role,
        },
      },
      message: '登录成功',
    });
  } catch (error) {
    console.error('登录失败：', error.message);

    return res.status(500).json({
      success: false,
      message: '登录失败，请稍后重试',
    });
  }
});

// GET /api/auth/me
router.get('/me', (req, res) => {
  try {
    const user = getCurrentUser(req);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: '尚未登录或登录已过期',
      });
    }

    return res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
        },
      },
    });
  } catch (error) {
    console.error('获取当前用户失败：', error.message);

    return res.status(500).json({
      success: false,
      message: '获取当前用户失败',
    });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  try {
    const token = getCookie(req, SESSION_COOKIE_NAME);

    if (token && token.length <= 200) {
      db.run(
        `UPDATE sessions
         SET revoked_at = ?
         WHERE token_hash = ? AND revoked_at IS NULL`,
        [new Date().toISOString(), hashToken(token)]
      );

      saveDatabase();
    }

    clearSessionCookie(res);

    return res.json({
      success: true,
      message: '已退出登录',
    });
  } catch (error) {
    console.error('退出登录失败：', error.message);

    return res.status(500).json({
      success: false,
      message: '退出登录失败',
    });
  }
});

export default router;