
import { useState, type FormEvent } from 'react';
import {
  loginApi,
  registerApi,
  type AuthUser,
} from './api';
import './AuthPage.css';

interface AuthPageProps {
  onAuthenticated: (user: AuthUser) => void;
}

export default function AuthPage({
  onAuthenticated,
}: AuthPageProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [invitationCode, setInvitationCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  function switchMode(nextMode: 'login' | 'register') {
    setMode(nextMode);
    setError('');
    setMessage('');
    setPassword('');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading) return;

    setLoading(true);
    setError('');
    setMessage('');

    try {
      if (mode === 'login') {
        const user = await loginApi(username.trim(), password);
        onAuthenticated(user);
        return;
      }

      const user = await registerApi({
        username: username.trim(),
        email: email.trim(),
        password,
        invitationCode: invitationCode.trim(),
      });

      // 注册成功后提示用户登录，不假设注册接口创建了会话。
      setMessage(`注册成功，欢迎 ${user.username}！请登录。`);
      setMode('login');
      setPassword('');
      setInvitationCode('');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : '操作失败，请稍后重试'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-brand">
          <div className="auth-logo">A</div>
          <div>
            <h1>Agent Studio</h1>
            <p>智能体开发与管理平台</p>
          </div>
        </div>

        <div className="auth-heading">
          <h2>{mode === 'login' ? '欢迎回来' : '创建账户'}</h2>
          <p>
            {mode === 'login'
              ? '登录以继续使用工作台'
              : '使用管理员提供的邀请码注册'}
          </p>
        </div>

        <div className="auth-tabs">
          <button
            type="button"
            className={mode === 'login' ? 'active' : ''}
            onClick={() => switchMode('login')}
            disabled={loading}
          >
            登录
          </button>
          <button
            type="button"
            className={mode === 'register' ? 'active' : ''}
            onClick={() => switchMode('register')}
            disabled={loading}
          >
            注册
          </button>
        </div>

        {error && (
          <div className="auth-alert auth-error" role="alert">
            {error}
          </div>
        )}

        {message && (
          <div className="auth-alert auth-success" role="status">
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <label htmlFor="auth-username">用户名或邮箱</label>
          <input
            id="auth-username"
            type="text"
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="请输入用户名或邮箱"
            minLength={3}
            maxLength={254}
            required
          />

          {mode === 'register' && (
            <>
              <label htmlFor="auth-email">邮箱</label>
              <input
                id="auth-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="请输入邮箱地址"
                maxLength={254}
                required
              />

              <label htmlFor="auth-invitation">邀请码</label>
              <input
                id="auth-invitation"
                type="text"
                value={invitationCode}
                onChange={(event) =>
                  setInvitationCode(event.target.value)
                }
                placeholder="请输入管理员提供的邀请码"
                minLength={20}
                maxLength={200}
                required
              />
            </>
          )}

          <label htmlFor="auth-password">密码</label>
          <input
            id="auth-password"
            type="password"
            autoComplete={
              mode === 'login' ? 'current-password' : 'new-password'
            }
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={
              mode === 'login'
                ? '请输入密码'
                : '至少 12 个字符'
            }
            minLength={mode === 'register' ? 12 : undefined}
            maxLength={1024}
            required
          />

          <button
            type="submit"
            className="auth-submit"
            disabled={loading}
          >
            {loading
              ? '请稍候…'
              : mode === 'login'
                ? '登录工作台'
                : '注册账户'}
          </button>
        </form>

        <p className="auth-footer">
          {mode === 'login'
            ? '还没有账户？请联系管理员获取邀请码。'
            : '注册账户默认拥有普通用户权限。'}
        </p>
      </section>
    </main>
  );
}
