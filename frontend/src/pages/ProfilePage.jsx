import { useState, useEffect } from 'react';
import './ProfilePage.css';

const API_BASE = '/api';

export default function ProfilePage({ token, user, onProfileUpdate, onLogout }) {
    const [name, setName] = useState(user?.name || '');
    const [githubUsername, setGithubUsername] = useState(user?.github_username || '');
    const [leetcodeUsername, setLeetcodeUsername] = useState(user?.leetcode_username || '');
    const [resumeFile, setResumeFile] = useState(null);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        setName(user?.name || '');
        setGithubUsername(user?.github_username || '');
        setLeetcodeUsername(user?.leetcode_username || '');
    }, [user]);

    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (file && file.type === 'application/pdf') {
            setResumeFile(file);
        } else if (file) {
            setMessage('❌ Please upload a PDF file.');
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        setMessage('');

        try {
            const formData = new FormData();
            formData.append('name', name.trim());
            formData.append('github_username', githubUsername.trim());
            formData.append('leetcode_username', leetcodeUsername.trim());
            if (resumeFile) {
                formData.append('resume', resumeFile);
            }

            const resp = await fetch(`${API_BASE}/auth/profile`, {
                method: 'PUT',
                headers: {
                    Authorization: `Bearer ${token}`,
                },
                body: formData,
            });

            if (!resp.ok) {
                const data = await resp.json();
                throw new Error(data.detail || 'Failed to update profile.');
            }

            const data = await resp.json();
            // Backend returns: { user: {...}, analysis: {...} }
            onProfileUpdate(data.user, data.analysis);

            if (data.analysis) {
                setMessage(`✅ Saved & Analyzed! (${data.analysis.readiness_category})`);
            } else {
                setMessage('✅ Profile saved!');
            }
            setResumeFile(null); // Clear file input after upload
        } catch (err) {
            setMessage(`❌ ${err.message}`);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="profile-page">
            <h2>Your Profile</h2>
            <p className="profile-subtitle">
                Update your details here. We'll automatically re-analyze your profile whenever you save changes.
            </p>

            {message && (
                <div className={`profile-message ${message.startsWith('✅') ? 'success' : 'error'}`}>
                    {message}
                </div>
            )}

            <form className="profile-form" onSubmit={handleSave}>
                {/* Email */}
                <div className="form-group">
                    <label>Email</label>
                    <input type="email" value={user?.email || ''} disabled />
                </div>

                {/* Name */}
                <div className="form-group">
                    <label htmlFor="prof-name">Full Name</label>
                    <input
                        id="prof-name"
                        type="text"
                        placeholder="Your full name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                    />
                </div>

                {/* Resume Upload */}
                <div className="form-group">
                    <label htmlFor="prof-resume">Resume (PDF)</label>
                    <div className="resume-upload-box">
                        <input
                            id="prof-resume"
                            type="file"
                            accept="application/pdf"
                            onChange={handleFileChange}
                        />
                        <div className="resume-status">
                            {resumeFile
                                ? `📄 Selected: ${resumeFile.name}`
                                : user?.resume_filename
                                    ? `📎 Current: ${user.resume_filename}`
                                    : 'No resume uploaded'}
                        </div>
                    </div>
                </div>

                {/* GitHub */}
                <div className="form-group">
                    <label htmlFor="prof-github">GitHub Username</label>
                    <input
                        id="prof-github"
                        type="text"
                        placeholder="e.g. octocat"
                        value={githubUsername}
                        onChange={(e) => setGithubUsername(e.target.value)}
                    />
                </div>

                {/* LeetCode */}
                <div className="form-group">
                    <label htmlFor="prof-leetcode">LeetCode Username</label>
                    <input
                        id="prof-leetcode"
                        type="text"
                        placeholder="e.g. leetcoder123"
                        value={leetcodeUsername}
                        onChange={(e) => setLeetcodeUsername(e.target.value)}
                    />
                </div>

                <button type="submit" className="save-btn" disabled={saving}>
                    {saving && <span className="spinner" />}
                    {saving ? 'Saving & Analyzing…' : 'Save & Analyze'}
                </button>
            </form>

            <div className="profile-footer" style={{ marginTop: '2rem', borderTop: '1px solid #333', paddingTop: '1rem' }}>
                <button
                    onClick={onLogout}
                    className="logout-btn-profile"
                >
                    Logout
                </button>
            </div>
        </div>
    );
}
