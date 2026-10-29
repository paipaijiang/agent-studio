
import {
  randomUUID,
  randomBytes,
  pbkdf2 as pbkdf2Callback,
} from 'node:crypto';
import { promisify } from 'node:util';
import { readFile, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { db, saveDatabase } from '../db.js';

const pbkdf2 = promisify(pbkdf2Callback);
const PBKDF2_ITERATIONS = 600000;

const passwordFile = fileURLToPath(
  new URL('./admin-password.tmp', import.meta.url)
);

// 使用随机盐和 scrypt 对密码进行哈希。
async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const key = await pbkdf2(
    password,
    salt,
    PBKDF2_ITERATIONS,
    64,
    'sha512'
  );

  return `pbkdf2$${PBKDF2_ITERATIONS}$${salt}$${key.toString('hex')}`;
}

async function main() {
  // 先检查管理员是否已经存在，避免重复初始化。
  const admins = db.exec(
    "SELECT id FROM users WHERE role = 'admin' LIMIT 1"
  );

  if (admins.length > 0 && admins[0].values.length > 0) {
    throw new Error('管理员账号已经存在，停止初始化。');
  }

  // 交互式输入用户名和邮箱，不输入密码。
  const username = (
    await ask('管理员用户名：')
  ).trim();

  const email = (
    await ask('管理员邮箱：')
  ).trim();

  if (
    !username ||
    username.length > 50 ||
    !email ||
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    throw new Error('用户名或邮箱格式不正确。');
  }

  // 从临时文件读取密码，避免终端回显。
  const password = await readFile(passwordFile, 'utf8');

  if (
    password.length < 12 ||
    Buffer.byteLength(password, 'utf8') > 1024 ||
    password.trim() !== password
  ) {
    throw new Error(
      '密码不符合要求：至少12个字符、最多1024字节，且首尾不能有空白字符。'
    );
  }

  // 检查用户名或邮箱是否已被使用。
  const existingUser = db.exec(
    `SELECT id FROM users
     WHERE username = ? OR email = ?
     LIMIT 1`,
    [username, email]
  );

  if (
    existingUser.length > 0 &&
    existingUser[0].values.length > 0
  ) {
    throw new Error('用户名或邮箱已经被使用。');
  }

  const now = new Date().toISOString();
  const id = randomUUID();
  const passwordHash = await hashPassword(password);

  // 创建首个管理员。
  db.run(
    `INSERT INTO users
      (id, username, email, password_hash, role, status,
       created_at, updated_at, last_login_at)
     VALUES (?, ?, ?, ?, 'admin', 'active', ?, ?, NULL)`,
    [id, username, email, passwordHash, now, now]
  );

  // 先保存数据库，再删除密码文件。
  saveDatabase();

  try {
    await unlink(passwordFile);
    console.log('临时密码文件已删除。');
  } catch (error) {
    console.error(
      '警告：管理员已创建，但临时密码文件未能删除，请手动删除。',
      error.message
    );
  }

  console.log('\n管理员初始化成功。');
  console.log(`用户名：${username}`);
  console.log(`邮箱：${email}`);
  console.log('密码已使用 scrypt 哈希保存。');
}

// 使用 readline 读取普通文本，不用于输入密码。
async function ask(question) {
  const { createInterface } = await import('node:readline/promises');

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    return await rl.question(question);
  } finally {
    rl.close();
  }
}

main().catch((error) => {
  console.error('\n管理员初始化失败：');
  console.error(error);
  process.exitCode = 1;
});
