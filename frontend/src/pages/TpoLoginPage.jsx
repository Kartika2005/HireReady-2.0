import { useState } from 'react';
import './LoginPage.css';           /* Reuse existing login styles */

const API_BASE = '/api';

export default function TpoLoginPage({ onLogin, onBack }) {
  const [mode, setMode]       = useState('login');
  const [name, setName]       = useState('');
  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password.trim()) {
      setError('Please fill in all fields.');
      return;
    }
    if (mode === 'register' && !name.trim()) {
      setError('Please enter your name.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);

    try {
      const endpoint = mode === 'login' ? '/auth/login' : '/auth/register';
      const body =
        mode === 'login'
          ? { email: email.trim(), password }
          : { name: name.trim(), email: email.trim(), password, role: 'tpo' };

      const resp = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await resp.json();

      if (!resp.ok) throw new Error(data.detail || 'Something went wrong.');

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      onLogin(data.token, data.user);
    } catch (err) {
      setError(err.name === 'TypeError' ? 'Network error — is the backend running?' : err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-header">
        <h1>HireReady</h1>
        <p>Training &amp; Placement Officer Portal</p>
      </div>

      <div className="login-card">
        {/* Back button */}
        <button className="back-link" onClick={onBack}>← Back to role selection</button>

        <div className="auth-toggle">
          <button className={mode === 'login' ? 'active' : ''} onClick={() => { setMode('login'); setError(''); }}>Login</button>
          <button className={mode === 'register' ? 'active' : ''} onClick={() => { setMode('register'); setError(''); }}>Register</button>
        </div>

        <h2>{mode === 'login' ? 'Welcome back, TPO' : 'Create TPO account'}</h2>
        <p className="subtitle">
          {mode === 'login' ? 'Sign in to manage placements' : 'Register as a placement officer'}
        </p>

        {error && <div className="login-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          {mode === 'register' && (
            <div className="form-group">
              <label htmlFor="tpo-name">Full Name</label>
              <input id="tpo-name" type="text" placeholder="e.g. Dr. Sharma" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="tpo-email">Email</label>
            <input id="tpo-email" type="email" placeholder="you@college.edu" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>

          <div className="form-group">
            <label htmlFor="tpo-password">Password</label>
            <input id="tpo-password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>

          <button type="submit" className="login-btn tpo-btn" disabled={loading}>
            {loading && <span className="spinner" />}
            {loading
              ? (mode === 'login' ? 'Signing in…' : 'Creating account…')
              : (mode === 'login' ? 'Sign In as TPO' : 'Create TPO Account')}
          </button>
        </form>
      </div>
    </div>
  );
}
