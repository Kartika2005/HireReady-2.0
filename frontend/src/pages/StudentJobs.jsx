import { useState, useEffect } from 'react';
import './StudentJobs.css';

const API_BASE = '/api';

export default function StudentJobs({ token }) {
  const [jobs, setJobs]         = useState([]);
  const [loading, setLoading]   = useState(true);

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/jobs`, { headers });
      if (res.ok) {
        const data = await res.json();
        setJobs(data.jobs || []);
      }
    } catch { /* */ }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchJobs(); }, []);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner-large" />
        <p>Loading available jobs…</p>
      </div>
    );
  }

  return (
    <div className="student-jobs">
      <h2>Available Job Openings</h2>
      <p className="info-text">Browse available positions. Your profile is automatically matched by the placement team.</p>

      {jobs.length === 0 ? (
        <div className="empty-dashboard">
          <p>No job openings available right now. Check back later!</p>
        </div>
      ) : (
        <div className="jobs-grid">
          {jobs.map(j => (
            <div key={j.id} className="job-card student">
              <div className="job-card-header">
                <h3>{j.title}</h3>
                <span className="job-company">{j.company}</span>
              </div>
              {j.description && <p className="job-desc">{j.description}</p>}
              <div className="job-meta">
                {j.job_role && <span className="meta-tag">🎯 {j.job_role}</span>}
                {j.min_cgpa != null && <span className="meta-tag">📊 Min CGPA: {j.min_cgpa}</span>}
                {j.required_certifications && <span className="meta-tag">📜 {j.required_certifications}</span>}
                {j.preferred_skills && <span className="meta-tag">💡 Skills: {j.preferred_skills}</span>}
                {j.package_lpa != null && <span className="meta-tag">💰 {j.package_lpa} LPA</span>}
                {j.eligibility && <span className="meta-tag">📋 {j.eligibility}</span>}
                {j.deadline && <span className="meta-tag">📅 {j.deadline}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
