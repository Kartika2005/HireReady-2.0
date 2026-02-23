import { useState } from 'react';
import './LoginPage.css';

const API_BASE = '/api';

export default function LoginPage({ onLogin, onBack }) {
    const [mode, setMode] = useState('login'); // 'login' | 'register'
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        // Basic validation
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
                    : { name: name.trim(), email: email.trim(), password };

            const resp = await fetch(`${API_BASE}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            const data = await resp.json();

            if (!resp.ok) {
                throw new Error(data.detail || 'Something went wrong.');
            }

            // Save token and user info
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            onLogin(data.token, data.user);
        } catch (err) {
            if (err.name === 'TypeError') {
                setError('Network error — is the backend running?');
            } else {
                setError(err.message);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            {/* Branding */}
            <div className="login-header">
                <h1>HireReady</h1>
                <p>AI-powered career readiness analysis</p>
            </div>

            <div className="login-card">
                {/* Back button */}
                {onBack && <button className="back-link" onClick={onBack}>← Back to role selection</button>}

                {/* Toggle */}
                <div className="auth-toggle">
                    <button
                        className={mode === 'login' ? 'active' : ''}
                        onClick={() => { setMode('login'); setError(''); }}
                    >
                        Login
                    </button>
                    <button
                        className={mode === 'register' ? 'active' : ''}
                        onClick={() => { setMode('register'); setError(''); }}
                    >
                        Register
                    </button>
                </div>

                <h2>{mode === 'login' ? 'Welcome back' : 'Create account'}</h2>
                <p className="subtitle">
                    {mode === 'login'
                        ? 'Sign in to analyze your profile'
                        : 'Register to get started'}
                </p>

                {error && <div className="login-error">{error}</div>}

                <form onSubmit={handleSubmit}>
                    {/* Name (register only) */}
                    {mode === 'register' && (
                        <div className="form-group">
                            <label htmlFor="name">Full Name</label>
                            <input
                                id="name"
                                type="text"
                                placeholder="e.g. Kartika Thite"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                            />
                        </div>
                    )}

                    {/* Email */}
                    <div className="form-group">
                        <label htmlFor="email">Email</label>
                        <input
                            id="email"
                            type="email"
                            placeholder="you@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>

                    {/* Password */}
                    <div className="form-group">
                        <label htmlFor="password">Password</label>
                        <input
                            id="password"
                            type="password"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>

                    <button type="submit" className="login-btn" disabled={loading}>
                        {loading && <span className="spinner" />}
                        {loading
                            ? (mode === 'login' ? 'Signing in…' : 'Creating account…')
                            : (mode === 'login' ? 'Sign In' : 'Create Account')}
                    </button>
                </form>
            </div>
        </div>
    );
}
