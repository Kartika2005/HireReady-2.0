import { useState, useEffect } from 'react';
import LoginPage from './pages/LoginPage';
import ProfilePage from './pages/ProfilePage';
import ResultCard from './components/ResultCard';
import './App.css';

const API_BASE = '/api';

export default function App() {
  /* ── Tab state ───────────────────────────────────────────────────── */
  const [activeTab, setActiveTab] = useState('dashboard');

  /* ── Analysis state ─────────────────────────────────────────────── */
  const [result, setResult] = useState(null);
  const [loadingResult, setLoadingResult] = useState(false);

  /* ── Auth state ─────────────────────────────────────────────────── */
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('user'));
    } catch {
      return null;
    }
  });

  const isLoggedIn = !!token;

  /* ── Fetch profile & latest analysis on login ───────────────────── */
  useEffect(() => {
    if (!token) return;

    const fetchData = async () => {
      try {
        // 1. Fetch User Profile
        const profileResp = await fetch(`${API_BASE}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (profileResp.ok) {
          const profile = await profileResp.json();
          setUser(profile);
          localStorage.setItem('user', JSON.stringify(profile));
        } else if (profileResp.status === 401) {
          handleLogout();
          return;
        }

        // 2. Fetch Latest Analysis
        fetchAnalysis();

      } catch {
        // Silently fail
      }
    };

    fetchData();
  }, [token]);

  const fetchAnalysis = async () => {
    setLoadingResult(true);
    try {
      const resp = await fetch(`${API_BASE}/analysis/latest`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data.status === 'success') {
          setResult(data);
        } else {
          setResult(null); // No analysis yet
        }
      }
    } catch (e) {
      console.error("Failed to fetch analysis", e);
    } finally {
      setLoadingResult(false);
    }
  };

  const handleLogin = (newToken, newUser) => {
    setToken(newToken);
    setUser(newUser);
  };

  const handleLogout = () => {
    setToken('');
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setResult(null);
    setActiveTab('dashboard');
  };

  const handleProfileUpdate = (updatedUser, newAnalysis) => {
    setUser(updatedUser);
    localStorage.setItem('user', JSON.stringify(updatedUser));

    // If the profile update triggered a new analysis, update state immediately
    if (newAnalysis) {
      setResult(newAnalysis);
    }
  };

  /* ── Helpers ────────────────────────────────────────────────────── */
  const categoryColor = (cat) => {
    if (!cat) return 'green';
    const lower = cat.toLowerCase();
    if (lower.includes('ready') && !lower.includes('almost')) return 'green';
    if (lower.includes('almost')) return 'orange';
    return 'red';
  };

  /* ── If not logged in, show login page ──────────────────────────── */
  if (!isLoggedIn) {
    return <LoginPage onLogin={handleLogin} />;
  }

  /* ── Render ─────────────────────────────────────────────────────── */
  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <h1>HireReady</h1>
        <p>AI-powered career readiness analysis</p>
        <div className="user-bar">
          <span className="user-greeting">
            👋 {user?.name || user?.email || 'User'}
          </span>
          <button className="logout-btn" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      {/* Tab Navigation */}
      <nav className="tab-nav">
        <button
          className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          Dashboard
        </button>
        <button
          className={`tab-btn ${activeTab === 'profile' ? 'active' : ''}`}
          onClick={() => setActiveTab('profile')}
        >
          Profile
        </button>
      </nav>

      {/* ═══ Dashboard Tab ═══ */}
      {activeTab === 'dashboard' && (
        <div className="dashboard-view">
          {loadingResult ? (
            <div className="loading-state">Loading analysis...</div>
          ) : result ? (
            <div className="results-section">
              {/* Score hero */}
              <div className={`score-hero ${categoryColor(result.readiness_category)}`}>
                <div className="score-label">Readiness Score</div>
                <div className="score-value">{result.readiness_score}</div>
                <span className={`category-badge ${categoryColor(result.readiness_category)}`}>
                  {result.readiness_category}
                </span>
                <div className="features-used">
                  Analysis based on your latest profile data
                  <br />
                  <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>
                    Updated: {new Date(result.created_at).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Recommended roles */}
              {result.recommended_roles?.length > 0 && (
                <>
                  <h3 className="roles-heading">Top Recommended Roles</h3>
                  <div className="roles-grid">
                    {result.recommended_roles.map((r, i) => (
                      <ResultCard
                        key={r.role}
                        role={r.role}
                        score={r.score}
                        rank={i + 1}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : (
            /* Empty State */
            <div className="empty-dashboard">
              <h2>Welcome to HireReady!</h2>
              <p>
                To get your AI readiness analysis, please set up your profile with your Resume and coding handles.
              </p>
              <button
                className="analyze-btn"
                onClick={() => setActiveTab('profile')}
                style={{ maxWidth: '200px', margin: '1.5rem auto' }}
              >
                Go to Profile
              </button>
            </div>
          )}
        </div>
      )}

      {/* ═══ Profile Tab ═══ */}
      {activeTab === 'profile' && (
        <ProfilePage
          token={token}
          user={user}
          onProfileUpdate={handleProfileUpdate}
        />
      )}
    </div>
  );
}
