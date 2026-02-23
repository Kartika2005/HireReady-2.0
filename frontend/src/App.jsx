import { useState, useEffect } from 'react';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import TpoLoginPage from './pages/TpoLoginPage';
import TpoDashboard from './pages/TpoDashboard';
import ProfilePage from './pages/ProfilePage';
import ResultCard from './components/ResultCard';
import QuizPage from './pages/QuizPage';
import StudentJobs from './pages/StudentJobs';
import './App.css';

const API_BASE = '/api';

export default function App() {
  /* ── Tab state ───────────────────────────────────────────────────── */
  const [activeTab, setActiveTab] = useState('dashboard');

  /* ── Role selection (landing page) ──────────────────────────────── */
  const [selectedRole, setSelectedRole] = useState(null); // 'student' | 'tpo'

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
    setSelectedRole(null);
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

  /* ── If not logged in, show landing → login flow ─────────────────── */
  if (!isLoggedIn) {
    // No role selected yet → show landing page with two cards
    if (!selectedRole) {
      return <LandingPage onSelectRole={setSelectedRole} />;
    }
    // TPO login
    if (selectedRole === 'tpo') {
      return <TpoLoginPage onLogin={handleLogin} onBack={() => setSelectedRole(null)} />;
    }
    // Student login (default)
    return <LoginPage onLogin={handleLogin} onBack={() => setSelectedRole(null)} />;
  }

  /* ── If TPO is logged in, show TPO dashboard ────────────────────── */
  if (user?.role === 'tpo') {
    return <TpoDashboard token={token} user={user} onLogout={handleLogout} />;
  }

  /* ── Render ─────────────────────────────────────────────────────── */
  return (
    <div className="app-container">
      {/* Unified Navbar */}
      <nav className="main-navbar">
        <div className="nav-left">
          <div className="nav-brand">HireReady</div>
          <button
            className={`nav-link ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            Dashboard
          </button>
          <button
            className={`nav-link ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            Profile
          </button>
          <button
            className={`nav-link ${activeTab === 'quiz' ? 'active' : ''}`}
            onClick={() => setActiveTab('quiz')}
          >
            Take Quizzes
          </button>
          <button
            className={`nav-link ${activeTab === 'jobs' ? 'active' : ''}`}
            onClick={() => setActiveTab('jobs')}
          >
            Jobs
          </button>
        </div>
        <div className="nav-right">
          <span className="user-greeting">
            Hello, {user?.name || user?.email || 'User'}
          </span>
          <button className="logout-btn" onClick={handleLogout}>Logout</button>
        </div>
      </nav>

      <main className="main-content">
        {activeTab === 'dashboard' && (
          <>
            {loadingResult ? (
              <div className="loading-container">
                <div className="spinner-large"></div>
                <p>Loading latest analysis...</p>
              </div>
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
              <div className="empty-dashboard">
                <h2>Welcome to HireReady!</h2>
                <p>You haven't run an analysis yet.</p>
                <div className="empty-actions">
                  <button className="primary-btn" onClick={() => setActiveTab('profile')}>
                    Go to Profile
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === 'profile' && (
          <ProfilePage
            token={token}
            user={user}
            onProfileUpdate={handleProfileUpdate}
            onLogout={handleLogout}
          />
        )}
        {activeTab === 'quiz' && <QuizPage />}
        {activeTab === 'jobs' && <StudentJobs token={token} />}
      </main>
    </div>
  );
}
