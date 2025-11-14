'use client';

import { useAuth } from '@/lib/auth';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

/**
 * Eztract AI Login Page
 * Beautiful, modern login interface with theme support
 */
function LoginPage() {
  const { signIn } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  // Initialize theme on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initialTheme = savedTheme || (prefersDark ? 'dark' : 'light');
    setTheme(initialTheme);
    document.documentElement.setAttribute('data-theme', initialTheme);
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    return router.push("/");
    // 
    // setError('');
    // setIsLoading(true);

    // try {
    //   await signIn(email, password);
    //   // Redirect to dashboard or next page
    //   const next = router.query.next as string;
    //   router.push(next || '/');
    // } catch (err) {
    //   setError(err instanceof Error ? err.message : 'Failed to sign in');
    // } finally {
    //   setIsLoading(false);
    // }
  };

  const handleForgotPassword = () => {
    alert('Forgot password functionality will be implemented soon. Please contact support for assistance.');
  };

  return (
    <>
      <style jsx>{`
        .login-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background:
            radial-gradient(1200px 600px at -10% -20%, #1a2655 0%, transparent 60%),
            radial-gradient(900px 500px at 110% 0%, #1a3a5f 0%, transparent 60%),
            linear-gradient(180deg, var(--background), var(--card));
          padding: 20px;
          position: relative;
          overflow: hidden;
        }

        [data-theme="light"] .login-page {
          background:
            radial-gradient(1200px 600px at -10% -20%, rgba(59,130,246,0.1) 0%, transparent 60%),
            radial-gradient(900px 500px at 110% 0%, rgba(99,102,241,0.08) 0%, transparent 60%),
            linear-gradient(180deg, var(--background), var(--card));
        }

        .login-page::before {
          content: '';
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background:
            radial-gradient(circle at 20% 20%, rgba(106,166,255,0.1) 0%, transparent 50%),
            radial-gradient(circle at 80% 80%, rgba(138,123,255,0.08) 0%, transparent 50%);
          animation: float 20s ease-in-out infinite;
          z-index: 0;
        }

        @keyframes float {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          33% { transform: translate(30px, -30px) rotate(120deg); }
          66% { transform: translate(-20px, 20px) rotate(240deg); }
        }

        .login-container {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 420px;
          margin: 0 auto;
        }

        .login-card {
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: 20px;
          padding: 40px;
          box-shadow:
            0 20px 60px rgba(0,0,0,0.4),
            0 0 0 1px rgba(255,255,255,0.05);
          backdrop-filter: blur(20px);
          position: relative;
          overflow: hidden;
        }

        .login-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 4px;
          background: linear-gradient(90deg, var(--primary), #8b7bff);
          border-radius: 20px 20px 0 0;
        }

        .login-header {
          text-align: center;
          margin-bottom: 32px;
        }

        .login-logo {
          width: 80px;
          height: 80px;
          margin: 0 auto 20px;
          background: linear-gradient(135deg, var(--primary), #8b7bff);
          border-radius: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 8px 24px rgba(106,166,255,0.3);
          position: relative;
          overflow: hidden;
        }

        .login-logo::before {
          content: '';
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: linear-gradient(45deg, transparent, rgba(255,255,255,0.1), transparent);
          animation: shimmer 3s ease-in-out infinite;
        }

        @keyframes shimmer {
          0% { transform: translateX(-100%) translateY(-100%) rotate(45deg); }
          100% { transform: translateX(100%) translateY(100%) rotate(45deg); }
        }

        .login-logo-text {
          font-size: 48px;
          position: relative;
          z-index: 1;
        }

        .login-title {
          font-size: 28px;
          font-weight: 800;
          color: var(--foreground);
          margin: 0 0 8px 0;
          letter-spacing: -0.5px;
        }

        .login-subtitle {
          font-size: 16px;
          color: var(--muted-foreground);
          margin: 0;
          font-weight: 400;
        }

        .login-form {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .form-group {
          position: relative;
        }

        .form-group label {
          display: block;
          font-size: 14px;
          font-weight: 600;
          color: var(--foreground);
          margin-bottom: 8px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .form-input {
          width: 100%;
          padding: 16px 20px;
          border: 2px solid var(--border);
          border-radius: 12px;
          background: rgba(255,255,255,0.03);
          color: var(--foreground);
          font-size: 16px;
          font-weight: 500;
          transition: all 0.3s ease;
          box-sizing: border-box;
        }

        .form-input:focus {
          outline: none;
          border-color: var(--primary);
          background: rgba(255,255,255,0.05);
          box-shadow: 0 0 0 4px rgba(106,166,255,0.1);
          transform: translateY(-1px);
        }

        .form-input::placeholder {
          color: var(--muted-foreground);
          font-weight: 400;
        }

        .form-options {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin: 8px 0;
        }

        .remember-me {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
        }

        .remember-me input[type="checkbox"] {
          width: 18px;
          height: 18px;
          accent-color: var(--primary);
          cursor: pointer;
        }

        .remember-me-label {
          font-size: 14px;
          color: var(--muted-foreground);
          cursor: pointer;
          margin: 0;
          font-weight: 400;
        }

        .forgot-password {
          color: var(--primary);
          text-decoration: none;
          font-size: 14px;
          font-weight: 500;
          transition: all 0.2s ease;
          cursor: pointer;
          background: none;
          border: none;
          padding: 0;
        }

        .forgot-password:hover {
          color: #8b7bff;
          text-decoration: underline;
        }

        .login-button {
          width: 100%;
          padding: 16px 24px;
          background: linear-gradient(135deg, var(--primary), #8b7bff);
          border: none;
          border-radius: 12px;
          color: white;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 0 8px 24px rgba(106,166,255,0.3);
          position: relative;
          overflow: hidden;
        }

        .login-button:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 12px 32px rgba(106,166,255,0.4);
        }

        .login-button:active:not(:disabled) {
          transform: translateY(0);
        }

        .login-button:disabled {
          opacity: 0.7;
          cursor: not-allowed;
          transform: none;
        }

        .login-button.loading::after {
          content: '';
          position: absolute;
          width: 20px;
          height: 20px;
          top: 50%;
          left: 50%;
          margin-left: -10px;
          margin-top: -10px;
          border: 2px solid rgba(255,255,255,0.3);
          border-radius: 50%;
          border-top-color: white;
          animation: spinner 0.8s linear infinite;
        }

        @keyframes spinner {
          to { transform: rotate(360deg); }
        }

        .theme-toggle-login {
          position: absolute;
          top: 20px;
          right: 20px;
          width: 44px;
          height: 44px;
          border-radius: 12px;
          border: 1px solid var(--border);
          background: rgba(255,255,255,0.06);
          color: var(--foreground);
          cursor: pointer;
          transition: all 0.3s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          backdrop-filter: blur(10px);
          z-index: 10;
        }

        .theme-toggle-login:hover {
          background: rgba(106,166,255,0.15);
          border-color: var(--primary);
          transform: scale(1.05);
        }

        .error-message {
          padding: 12px 16px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          background: rgba(239,68,68,0.1);
          border: 1px solid rgba(239,68,68,0.3);
          color: #ef4444;
          margin-bottom: 16px;
        }

        @media (max-width: 480px) {
          .login-page {
            padding: 16px;
          }

          .login-card {
            padding: 32px 24px;
            border-radius: 16px;
          }

          .login-title {
            font-size: 24px;
          }

          .login-subtitle {
            font-size: 14px;
          }

          .form-input {
            padding: 14px 16px;
            font-size: 16px;
          }

          .login-button {
            padding: 14px 20px;
            font-size: 16px;
          }

          .theme-toggle-login {
            top: 16px;
            right: 16px;
            width: 40px;
            height: 40px;
            font-size: 16px;
          }
        }
      `}</style>

      <div className="login-page">
        {/* Theme Toggle */}
        <button
          className="theme-toggle-login"
          onClick={toggleTheme}
          aria-label="Toggle Theme"
        >
          <span>{theme === 'dark' ? '🌙' : '☀️'}</span>
        </button>

        <div className="login-container">
          <div className="login-card">
            {/* Header */}
            <div className="login-header">
              <div className="login-logo">
                <span className="login-logo-text">📊</span>
              </div>
              <h1 className="login-title">Welcome Back</h1>
              <p className="login-subtitle">Sign in to your Eztract AI account</p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="error-message">
                {error}
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="login-form">
              <div className="form-group">
                <label htmlFor="email">Email Address</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  className="form-input"
                  placeholder="Enter your email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  autoComplete="email"
                />
              </div>

              <div className="form-group">
                <label htmlFor="password">Password</label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  className="form-input"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>

              <div className="form-options">
                <label className="remember-me">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  <span className="remember-me-label">Remember me</span>
                </label>
                <button
                  type="button"
                  className="forgot-password"
                  onClick={handleForgotPassword}
                >
                  Forgot password?
                </button>
              </div>

              <button
                type="submit"
                className={`login-button ${isLoading ? 'loading' : ''}`}
                disabled={isLoading}
              >
                <span className="button-text">
                  {isLoading ? 'Signing In...' : 'Sign In'}
                </span>
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}

export default LoginPage;
