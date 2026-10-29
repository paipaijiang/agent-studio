
import readline from 'node:readline';
import { randomBytes } from 'node:crypto';

const baseUrl = 'http://127.0.0.1:3001';

function readHidden(prompt) {
  return new Promise((resolve, reject) => {
    const input = process.stdin;

    if (!input.isTTY || typeof input.setRawMode !== 'function') {
      reject(new Error('当前终端不支持安全的隐藏密码输入'));
      return;
    }

    const rl = readline.createInterface({
      input,
      output: process.stdout,
      terminal: true,
    });

    rl.stdoutMuted = true;
    const originalWrite = rl._writeToOutput.bind(rl);
    rl._writeToOutput = (stringToWrite) => {
      if (rl.stdoutMuted) {
        const clean = stringToWrite.replace(/[^\r\n]/g, '');
        originalWrite(clean);
      } else {
        originalWrite(stringToWrite);
      }
    };

    process.stdout.write(prompt);

    rl.question('', (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
  });
}

async function main() {
  const password = await readHidden('管理员密码（输入隐藏）: ');
  if (!password) throw new Error('密码不能为空');

  const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password }),
  });

  const loginBody = await loginResponse.json();
  console.log('1. 管理员登录:', loginResponse.status);

  if (!loginResponse.ok) {
    throw new Error('管理员登录失败');
  }

  const setCookie = loginResponse.headers.get('set-cookie');
  if (!setCookie) throw new Error('没有获取到会话 Cookie');

  const cookie = setCookie.split(';')[0];

  const unauthResponse = await fetch(
    `${baseUrl}/api/auth/invitations`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expiresInDays: 7 }),
    }
  );

  console.log('2. 未登录创建邀请码:', unauthResponse.status);

  const invitationResponse = await fetch(
    `${baseUrl}/api/auth/invitations`,
    {
      method: 'POST',
      headers: {
        Cookie: cookie,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ expiresInDays: 1 }),
    }
  );

  const invitationBody = await invitationResponse.json();
  console.log('3. 管理员创建邀请码:', invitationResponse.status);

  if (!invitationResponse.ok) {
    console.log('创建邀请码失败:', invitationBody.message);
    throw new Error('邀请码创建失败');
  }

  const { invitationCode } = invitationBody.data;

  const suffix = randomBytes(5).toString('hex');
  const username = `test_${suffix}`;
  const email = `test_${suffix}@example.com`;
  const testPassword = `T-${randomBytes(18).toString('base64url')}a9`;

  const registerResponse = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username,
      email,
      password: testPassword,
      invitationCode,
      role: 'admin',
    }),
  });

  const registerBody = await registerResponse.json();
  console.log('4. 使用邀请码注册:', registerResponse.status);
  console.log('   注册角色:', registerBody.data?.user?.role ?? '无');

  const duplicateResponse = await fetch(
    `${baseUrl}/api/auth/register`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: `dup_${suffix}`,
        email: `dup_${suffix}@example.com`,
        password: testPassword,
        invitationCode,
      }),
    }
  );

  console.log('5. 重复使用同一邀请码:', duplicateResponse.status);

  if (
    unauthResponse.status !== 401 ||
    invitationResponse.status !== 201 ||
    registerResponse.status !== 201 ||
    registerBody.data?.user?.role !== 'user' ||
    duplicateResponse.status !== 400
  ) {
    throw new Error('有测试未通过，请根据状态码排查');
  }

  console.log('全部测试通过。');
  console.log('测试用户:', username);
  console.log('测试邮箱:', email);
}

main().catch((error) => {
  console.error('测试失败:', error.message);
  process.exitCode = 1;
});
