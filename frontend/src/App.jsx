import { useState, useEffect } from 'react';
import LoginPage from './pages/LoginPage';
import ResultCard from './components/ResultCard';
import './App.css';

const API_URL = '/api/analyze-full-profile';

export default function App() {
  /* ── Analyzer state ─────────────────────────────────────────────────── */
  const [resumeFile, setResumeFile] = useState(null);
  const [githubUsername, setGithubUsername] = useState('');
  const [leetcodeUsername, setLeetcodeUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  /* ── Auth state ─────────────────────────────────────────────────────── */
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('user'));
    } catch {
      return null;
    }
  });

  const isLoggedIn = !!token;

  const handleLogin = (newToken, newUser) => {
    setToken(newToken);
    setUser(newUser);
  };

  const handleLogout = () => {
    setToken('');
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setResult(null); // Clear previous results
    setResumeFile(null);
  };

  /* ── Handlers ───────────────────────────────────────────────────────── */
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setResumeFile(file);
      setError('');
    } else if (file) {
      setError('Please upload a PDF file.');
      setResumeFile(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setResult(null);

    if (!resumeFile) {
      setError('Please upload your resume (PDF) before analyzing.');
      return;
    }

    const formData = new FormData();
    formData.append('resume', resumeFile);
    formData.append('github_username', githubUsername.trim());
    formData.append('leetcode_username', leetcodeUsername.trim());

    setLoading(true);

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (response.status === 401) {
        // Token expired or invalid
        handleLogout();
        return;
      }

      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(errBody || `Server error (${response.status})`);
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      if (err.name === 'TypeError') {
        setError('Network error — is the backend running?');
      } else {
        setError(err.message || 'Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  /* ── Helpers ────────────────────────────────────────────────────────── */
  const categoryColor = (cat) => {
    if (!cat) return 'green';
    const lower = cat.toLowerCase();
    if (lower.includes('ready') && !lower.includes('almost')) return 'green';
    if (lower.includes('almost')) return 'orange';
    return 'red';
  };

  /* ── If not logged in, show login page ──────────────────────────────── */
  if (!isLoggedIn) {
    return <LoginPage onLogin={handleLogin} />;
  }

  /* ── Render ─────────────────────────────────────────────────────────── */
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

      {/* Input form */}
      <form className="form-card" onSubmit={handleSubmit}>
        <h2>Analyze Your Profile</h2>

        {/* Resume upload */}
        <div className="form-group">
          <label htmlFor="resume">Resume (PDF)</label>
          <div className={`file-upload-area ${resumeFile ? 'has-file' : ''}`}>
            <input
              id="resume"
              type="file"
              accept="application/pdf"
              onChange={handleFileChange}
            />
            <div className="file-upload-icon">
              {resumeFile ? '✅' : '📄'}
            </div>
            <div className="file-upload-text">
              {resumeFile ? 'File selected' : 'Click or drag to upload PDF'}
            </div>
            {resumeFile && (
              <div className="file-upload-name">{resumeFile.name}</div>
            )}
          </div>
        </div>

        {/* GitHub */}
        <div className="form-group">
          <label htmlFor="github">GitHub Username</label>
          <input
            id="github"
            type="text"
            placeholder="e.g. octocat"
            value={githubUsername}
            onChange={(e) => setGithubUsername(e.target.value)}
          />
        </div>

        {/* LeetCode */}
        <div className="form-group">
          <label htmlFor="leetcode">LeetCode Username</label>
          <input
            id="leetcode"
            type="text"
            placeholder="e.g. leetcoder123"
            value={leetcodeUsername}
            onChange={(e) => setLeetcodeUsername(e.target.value)}
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          className="analyze-btn"
          disabled={loading}
        >
          {loading && <span className="spinner" />}
          {loading ? 'Analyzing…' : 'Analyze Profile'}
        </button>
      </form>

      {/* Error */}
      {error && <div className="error-banner">{error}</div>}

      {/* Results */}
      {result && (
        <div className="results-section">
          {/* Score hero */}
          <div className={`score-hero ${categoryColor(result.readiness_category)}`}>
            <div className="score-label">Readiness Score</div>
            <div className="score-value">{result.readiness_score}</div>
            <span className={`category-badge ${categoryColor(result.readiness_category)}`}>
              {result.readiness_category}
            </span>
            <div className="features-used">
              Based on <span>{result.total_features_used}</span> features analyzed
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
      )}
    </div>
  );
}
