import { useState, useEffect } from 'react';
import './TpoDashboard.css';

const API_BASE = '/api';

export default function TpoDashboard({ token, user, onLogout }) {
  const [tab, setTab]             = useState('jobs');
  const [jobs, setJobs]           = useState([]);
  const [loadingJobs, setLoadingJobs] = useState(false);

  /* New-job form */
  const [title, setTitle]               = useState('');
  const [company, setCompany]           = useState('');
  const [description, setDescription]   = useState('');
  const [eligibility, setEligibility]   = useState('');
  const [jobRole, setJobRole]           = useState('');
  const [minCgpa, setMinCgpa]           = useState('');
  const [requiredCerts, setRequiredCerts] = useState('');
  const [preferredSkills, setPreferredSkills] = useState('');
  const [packageLpa, setPackageLpa]     = useState('');
  const [deadline, setDeadline]         = useState('');
  const [posting, setPosting]           = useState(false);
  const [postMsg, setPostMsg]           = useState('');

  /* Shortlisted Students */
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [shortlisted, setShortlisted]     = useState([]);
  const [shortlistedJob, setShortlistedJob] = useState(null);
  const [loadingShortlisted, setLoadingShortlisted] = useState(false);
  const [shortlistedTotal, setShortlistedTotal] = useState(0);

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  /* ── Fetch my jobs ──────────────────────────────────────────────── */
  const fetchJobs = async () => {
    setLoadingJobs(true);
    try {
      const res = await fetch(`${API_BASE}/tpo/jobs`, { headers });
      if (res.ok) {
        const data = await res.json();
        setJobs(data.jobs || []);
      }
    } catch { /* */ } finally { setLoadingJobs(false); }
  };

  useEffect(() => { fetchJobs(); }, []);

  /* ── Post a job ─────────────────────────────────────────────────── */
  const handlePostJob = async (e) => {
    e.preventDefault();
    if (!title.trim() || !company.trim()) return;
    setPosting(true);
    setPostMsg('');
    try {
      const res = await fetch(`${API_BASE}/tpo/jobs`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          title, company, description, eligibility, deadline,
          job_role: jobRole,
          min_cgpa: minCgpa ? parseFloat(minCgpa) : null,
          required_certifications: requiredCerts,
          preferred_skills: preferredSkills,
          package_lpa: packageLpa ? parseFloat(packageLpa) : null,
        }),
      });
      if (res.ok) {
        setPostMsg('Job posted successfully!');
        setTitle(''); setCompany(''); setDescription(''); setEligibility(''); setDeadline('');
        setJobRole(''); setMinCgpa(''); setRequiredCerts(''); setPreferredSkills(''); setPackageLpa('');
        fetchJobs();
      } else {
        const d = await res.json();
        setPostMsg(d.detail || 'Failed to post job');
      }
    } catch { setPostMsg('Network error'); }
    finally { setPosting(false); }
  };

  /* ── Delete a job ──────────────────────────────────────────────── */
  const handleDelete = async (jobId) => {
    if (!confirm('Delete this job posting?')) return;
    await fetch(`${API_BASE}/tpo/jobs/${jobId}`, { method: 'DELETE', headers });
    fetchJobs();
  };

  /* ── View shortlisted students ────────────────────────────────── */
  const viewShortlisted = async (jobId) => {
    setSelectedJobId(jobId);
    setLoadingShortlisted(true);
    setTab('shortlisted');
    try {
      const res = await fetch(`${API_BASE}/tpo/jobs/${jobId}/shortlisted`, { headers });
      if (res.ok) {
        const data = await res.json();
        setShortlisted(data.shortlisted_students || []);
        setShortlistedJob(data.job || null);
        setShortlistedTotal(data.total || 0);
      }
    } catch { /* */ } finally { setLoadingShortlisted(false); }
  };

  /* ── Render ─────────────────────────────────────────────────────── */
  return (
    <div className="app-container">
      {/* Navbar */}
      <nav className="main-navbar">
        <div className="nav-left">
          <div className="nav-brand">HireReady <span className="tpo-badge">TPO</span></div>
          <button className={`nav-link ${tab === 'post' ? 'active' : ''}`}   onClick={() => setTab('post')}>Post Job</button>
          <button className={`nav-link ${tab === 'jobs' ? 'active' : ''}`}   onClick={() => setTab('jobs')}>My Jobs</button>
          <button className={`nav-link ${tab === 'shortlisted' ? 'active' : ''}`} onClick={() => { if (selectedJobId) setTab('shortlisted'); }}>Shortlisted</button>
        </div>
        <div className="nav-right">
          <span className="user-greeting">Hello, {user?.name || 'TPO'}</span>
          <button className="logout-btn" onClick={onLogout}>Logout</button>
        </div>
      </nav>

      <main className="main-content">
        {/* ── Post Job Tab ─────────────────────────────────────────── */}
        {tab === 'post' && (
          <div className="tpo-section">
            <h2>Post a New Job</h2>
            {postMsg && <div className={`tpo-msg ${postMsg.includes('success') ? 'success' : 'error'}`}>{postMsg}</div>}
            <form className="tpo-form" onSubmit={handlePostJob}>
              <div className="form-row">
                <div className="form-group">
                  <label>Job Title *</label>
                  <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Software Engineer Intern" required />
                </div>
                <div className="form-group">
                  <label>Company *</label>
                  <input value={company} onChange={e => setCompany(e.target.value)} placeholder="e.g. Google" required />
                </div>
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea rows={4} value={description} onChange={e => setDescription(e.target.value)} placeholder="Job responsibilities, tech stack, etc." />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Job Role / Category</label>
                  <input value={jobRole} onChange={e => setJobRole(e.target.value)} placeholder="e.g. Backend Developer" />
                </div>
                <div className="form-group">
                  <label>Min CGPA (out of 10)</label>
                  <input type="number" step="0.1" min="0" max="10" value={minCgpa} onChange={e => setMinCgpa(e.target.value)} placeholder="e.g. 7.0" />
                </div>
              </div>
              <div className="form-group">
                <label>Required Certifications (comma-separated)</label>
                <input value={requiredCerts} onChange={e => setRequiredCerts(e.target.value)} placeholder="e.g. AWS Cloud Practitioner, Google Data Analytics" />
                <span className="form-hint">Leave blank if no certifications required</span>
              </div>
              <div className="form-group">
                <label>Preferred Skills (comma-separated)</label>
                <input value={preferredSkills} onChange={e => setPreferredSkills(e.target.value)} placeholder="e.g. Python, React, Machine Learning" />
                <span className="form-hint">Used for automatic skill matching with student profiles</span>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Package (LPA)</label>
                  <input type="number" step="0.1" min="0" value={packageLpa} onChange={e => setPackageLpa(e.target.value)} placeholder="e.g. 12.0" />
                  <span className="form-hint">Annual package in Lakhs Per Annum</span>
                </div>
                <div className="form-group">
                  <label>Eligibility (general text)</label>
                  <input value={eligibility} onChange={e => setEligibility(e.target.value)} placeholder="e.g. B.Tech CS, 2025 batch" />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Deadline</label>
                  <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} />
                </div>
              </div>
              <button type="submit" className="login-btn" disabled={posting}>
                {posting ? 'Posting…' : 'Post Job'}
              </button>
            </form>
          </div>
        )}

        {/* ── My Jobs Tab ──────────────────────────────────────────── */}
        {tab === 'jobs' && (
          <div className="tpo-section">
            <h2>My Job Postings</h2>
            {loadingJobs ? (
              <div className="loading-container"><div className="spinner-large" /><p>Loading jobs…</p></div>
            ) : jobs.length === 0 ? (
              <div className="empty-dashboard">
                <p>No jobs posted yet.</p>
                <button className="primary-btn" onClick={() => setTab('post')}>Post Your First Job</button>
              </div>
            ) : (
              <div className="jobs-grid">
                {jobs.map(j => (
                  <div className="job-card" key={j.id}>
                    <div className="job-card-header">
                      <h3>{j.title}</h3>
                      <span className="job-company">{j.company}</span>
                    </div>
                    {j.description && <p className="job-desc">{j.description}</p>}
                    <div className="job-meta">
                      {j.job_role && <span className="meta-tag">🎯 {j.job_role}</span>}
                      {j.min_cgpa != null && <span className="meta-tag">📊 Min CGPA: {j.min_cgpa}</span>}
                      {j.required_certifications && <span className="meta-tag">📜 Certs: {j.required_certifications}</span>}
                      {j.preferred_skills && <span className="meta-tag">💡 Skills: {j.preferred_skills}</span>}
                      {j.package_lpa != null && <span className="meta-tag">💰 {j.package_lpa} LPA</span>}
                      {j.eligibility && <span className="meta-tag">📋 {j.eligibility}</span>}
                      {j.deadline && <span className="meta-tag">📅 {j.deadline}</span>}
                    </div>
                    <div className="job-actions">
                      <button className="eligible-btn" onClick={() => viewShortlisted(j.id)}>View Shortlisted</button>
                      <button className="danger-btn" onClick={() => handleDelete(j.id)}>Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Shortlisted Students Tab ─────────────────────────────────── */}
        {tab === 'shortlisted' && (
          <div className="tpo-section">
            <button className="back-link" onClick={() => setTab('jobs')}>← Back to jobs</button>
            <h2>Auto-Shortlisted Students</h2>
            {shortlistedJob && (
              <div className="eligible-criteria">
                <h3>{shortlistedJob.title} — {shortlistedJob.company}</h3>
                <div className="criteria-tags">
                  {shortlistedJob.job_role && <span className="meta-tag">🎯 Role: {shortlistedJob.job_role}</span>}
                  {shortlistedJob.min_cgpa != null && <span className="meta-tag">📊 Min CGPA: {shortlistedJob.min_cgpa}</span>}
                  {shortlistedJob.required_certifications && <span className="meta-tag">📜 Required Certs: {shortlistedJob.required_certifications}</span>}
                  {shortlistedJob.preferred_skills && <span className="meta-tag">💡 Skills: {shortlistedJob.preferred_skills}</span>}
                </div>
                <p className="eligible-count">{shortlistedTotal} student{shortlistedTotal !== 1 ? 's' : ''} shortlisted</p>
              </div>
            )}
            {loadingShortlisted ? (
              <div className="loading-container"><div className="spinner-large" /><p>Finding shortlisted students…</p></div>
            ) : shortlisted.length === 0 ? (
              <p className="empty-text">No students match the shortlisting criteria (CGPA, certifications, resume score ≥ 50).</p>
            ) : (
              <div className="applicants-list">
                {shortlisted.map((item, idx) => (
                  <div key={item.student.id} className="applicant-card eligible-card">
                    <div className="applicant-header">
                      <div>
                        <span className="eligible-rank">#{idx + 1}</span>
                        <h3>{item.student.name}</h3>
                        <span className="applicant-email">{item.student.email}</span>
                      </div>
                      <div className="match-score-badge">
                        <span className="badge-score">{item.match_score}%</span>
                        <span className="badge-label">Match Score</span>
                      </div>
                    </div>

                    <div className="applicant-details">
                      {item.student.cgpa != null && <span className="detail-chip">CGPA: {item.student.cgpa}</span>}
                      {item.student.mobile_number && <span className="detail-chip">📱 {item.student.mobile_number}</span>}
                      <span className="detail-chip">📄 Resume Score: {item.student.resume_score}</span>
                    </div>

                    {item.matched_skills && item.matched_skills.length > 0 && (
                      <div className="cert-section">
                        <span className="cert-label">Matched Skills:</span>
                        <div className="cert-chips">
                          {item.matched_skills.map((s, i) => (
                            <span key={i} className="cert-chip matched">{s}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {item.student.certifications && (
                      <div className="cert-section">
                        <span className="cert-label">Certifications:</span>
                        <div className="cert-chips">
                          {item.student.certifications.split(',').map((c, i) => (
                            <span key={i} className={`cert-chip ${item.matched_certifications?.includes(c.trim().toLowerCase()) ? 'matched' : ''}`}>
                              {c.trim()}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {item.student.preferred_job_roles && (
                      <div className="cert-section">
                        <span className="cert-label">Preferred Roles:</span>
                        <span className="detail-chip">{item.student.preferred_job_roles}</span>
                      </div>
                    )}

                    {item.student.resume_text && (
                      <details className="resume-preview">
                        <summary>View Resume Text</summary>
                        <pre>{item.student.resume_text}</pre>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
