

import React, { useState, useEffect } from 'react';
import './QuizPage.css';
import QuizRunner from '../components/QuizRunner';

const API_BASE_URL = "/api";

const QuizPage = () => {
    const [roles, setRoles] = useState([]);
    const [history, setHistory] = useState([]);
    const [selectedRole, setSelectedRole] = useState('');
    const [difficulty, setDifficulty] = useState('Medium');
    const [isRunning, setIsRunning] = useState(false);
    const [loading, setLoading] = useState(true);
    const [retestResultId, setRetestResultId] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const token = localStorage.getItem("token");
                const headers = { "Authorization": `Bearer ${token}` };

                const [rolesRes, historyRes] = await Promise.all([
                    fetch(`${API_BASE_URL}/quiz/roles`, { headers }),
                    fetch(`${API_BASE_URL}/quiz/results`, { headers })
                ]);

                if (rolesRes.status === 401 || historyRes.status === 401) {
                    localStorage.removeItem("token");
                    localStorage.removeItem("user");
                    window.location.href = "/"; // Redirect to login
                    return;
                }

                if (rolesRes.ok) {
                    const data = await rolesRes.json();
                    setRoles(data.roles || []);
                }
                if (historyRes.ok) {
                    const data = await historyRes.json();
                    setHistory(data.results || []);
                }
            } catch (err) {
                console.error("Failed to load quiz data", err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [isRunning]); // Reload history when returning from run

    const handleStart = () => {
        if (selectedRole) {
            setRetestResultId(null);
            setIsRunning(true);
        }
    };

    const handleRetest = (item) => {
        setSelectedRole(item.role);
        setDifficulty(item.difficulty || 'Medium');
        setRetestResultId(item.id);
        setIsRunning(true);
    };

    if (isRunning) {
        return (
            <QuizRunner
                role={selectedRole}
                difficulty={difficulty}
                initialResultId={retestResultId}
                onComplete={() => setIsRunning(false)}
                onCancel={() => setIsRunning(false)}
            />
        );
    }

    return (
        <div className="quiz-page-container">
            <header className="quiz-hero">
                <h1>Skill Assessment</h1>
                <p>Test your knowledge with AI-generated quizzes tailored to your target role.</p>
            </header>

            <div className="quiz-layout">
                <div className="quiz-setup-card">
                    <h2>Start New Quiz</h2>

                    <div className="form-group">
                        <label>Select Role</label>
                        <select
                            value={selectedRole}
                            onChange={(e) => setSelectedRole(e.target.value)}
                            className="quiz-select"
                        >
                            <option value="">-- Choose a Role --</option>
                            {roles.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                    </div>

                    <div className="form-group">
                        <label>Difficulty</label>
                        <div className="diff-options">
                            {['Low', 'Medium', 'High'].map(d => (
                                <button
                                    key={d}
                                    className={`diff-btn ${difficulty === d ? 'active' : ''}`}
                                    onClick={() => setDifficulty(d)}
                                >
                                    {d}
                                </button>
                            ))}
                        </div>
                    </div>

                    <button
                        className="start-quiz-btn"
                        disabled={!selectedRole || loading}
                        onClick={handleStart}
                    >
                        Start Quiz
                    </button>
                    {!selectedRole && <p className="hint">Please select a role to begin.</p>}
                </div>

                <div className="quiz-history-section">
                    <h3>Recent Attempts</h3>
                    {history.length === 0 ? (
                        <p className="no-history">No quizzes taken yet.</p>
                    ) : (
                        <div className="history-list">
                            {history.map(item => (
                                <div key={item.id} className="history-item">
                                    <div className="history-info">
                                        <span className="history-role">{item.role}</span>
                                        <span className="history-meta">{item.difficulty} • {new Date(item.created_at).toLocaleDateString()}</span>
                                    </div>
                                    <div className="history-action">
                                        <span className={`score-badge ${(item.score / item.total_questions) >= 0.8 ? 'good' : (item.score / item.total_questions) >= 0.5 ? 'avg' : 'bad'
                                            }`}>
                                            {item.score}/{item.total_questions}
                                        </span>
                                        <button className="retest-btn" onClick={() => handleRetest(item)}>
                                            Retest
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default QuizPage;
