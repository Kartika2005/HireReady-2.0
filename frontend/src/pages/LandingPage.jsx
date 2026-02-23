import './LandingPage.css';

export default function LandingPage({ onSelectRole }) {
  return (
    <div className="landing-container">
      <div className="landing-header">
        <h1>HireReady</h1>
        <p>AI-powered career readiness analysis</p>
      </div>

      <div className="landing-cards">
        {/* Student Card */}
        <div className="role-card" onClick={() => onSelectRole('student')}>
          <div className="role-icon">🎓</div>
          <h2>Student</h2>
          <p>Analyze your resume, GitHub &amp; LeetCode profiles. Get placement readiness scores, role recommendations, and practice quizzes.</p>
          <span className="role-cta">Continue as Student →</span>
        </div>

        {/* TPO Card */}
        <div className="role-card tpo" onClick={() => onSelectRole('tpo')}>
          <div className="role-icon">🏢</div>
          <h2>TPO / Placement Officer</h2>
          <p>Post job openings, review student applications, view resumes and readiness scores — all in one dashboard.</p>
          <span className="role-cta">Continue as TPO →</span>
        </div>
      </div>
    </div>
  );
}
