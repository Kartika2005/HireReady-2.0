
import React, { useState, useEffect } from 'react';
import './QuizRunner.css';

const API_BASE_URL = "http://localhost:8000"; // Adjust if needed

const QuizRunner = ({ role, difficulty, initialResultId, onComplete, onCancel }) => {
    const [questions, setQuestions] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [selectedAnswer, setSelectedAnswer] = useState('');
    const [answers, setAnswers] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const [score, setScore] = useState(0);
    const [resultId, setResultId] = useState(initialResultId || null);

    // Fetch questions on mount
    useEffect(() => {
        const fetchQuestions = async () => {
            try {
                const token = localStorage.getItem("token");
                const res = await fetch(`${API_BASE_URL}/api/quiz/generate`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    },
                    body: JSON.stringify({ role, difficulty })
                });

                if (!res.ok) {
                    const errData = await res.json();
                    throw new Error(errData.detail || "Failed to generate quiz");
                }

                const data = await res.json();
                setQuestions(data.questions || []);
                setLoading(false);
            } catch (err) {
                console.error(err);
                setError(err.message);
                setLoading(false);
            }
        };

        fetchQuestions();
    }, [role, difficulty]);

    const handleNext = async () => {
        if (!selectedAnswer) return;

        const updatedAnswers = { ...answers, [currentIndex]: selectedAnswer };
        setAnswers(updatedAnswers);

        if (currentIndex < questions.length - 1) {
            setCurrentIndex(currentIndex + 1);
            setSelectedAnswer('');
        } else {
            // Calculate score locally
            let correct = 0;
            const answerPayload = questions.map((q, i) => {
                const userAnswer = updatedAnswers[i] || '';
                // Simple logic: check if option string contains correct answer string or vice versa
                // Actually, Groq returns full string "A) Option".
                // We should match exact string.
                const isCorrect = userAnswer === q.correctAnswer;
                if (isCorrect) correct++;
                return {
                    questionIndex: i,
                    userAnswer,
                    isCorrect
                };
            });

            setScore(correct);
            setSubmitted(true);

            // Submit to backend
            try {
                const token = localStorage.getItem("token");
                const res = await fetch(`${API_BASE_URL}/api/quiz/submit`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        role,
                        difficulty,
                        score: correct,
                        totalQuestions: questions.length,
                        answers: answerPayload,
                        resultId: resultId // Send existing ID for updates
                    })
                });

                if (res.ok) {
                    const data = await res.json();
                    setResultId(data.resultId);
                }
            } catch (err) {
                console.error("Failed to submit quiz results", err);
            }
        }
    };

    if (loading) {
        return (
            <div className="quiz-loading">
                <div className="spinner"></div>
                <p>Generating {role} quiz ({difficulty})...</p>
                <p className="loading-sub">This relies on AI and might take 10-20 seconds.</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="quiz-error">
                <div className="error-box">{error}</div>
                <button className="secondary-btn" onClick={onCancel}>
                    ← Back to Selection
                </button>
            </div>
        );
    }

    if (submitted) {
        const pct = Math.round((score / questions.length) * 100);
        let badgeClass = "badge-danger";
        let message = "Needs Practice";
        if (pct >= 80) {
            badgeClass = "badge-success";
            message = "Excellent!";
        } else if (pct >= 50) {
            badgeClass = "badge-warning";
            message = "Good Job";
        }

        return (
            <div className="quiz-result-card">
                <h2>Quiz Complete!</h2>
                <div className="score-circle">
                    <span className="score-num">{score}</span>
                    <span className="score-total">/ {questions.length}</span>
                </div>

                <div className={`result-badge ${badgeClass}`}>
                    {message} ({pct}%)
                </div>

                <div className="result-actions">
                    <button className="primary-btn" onClick={onComplete}>
                        View Results History
                    </button>
                    <button className="secondary-btn" onClick={onCancel}>
                        Take Another Quiz
                    </button>
                </div>
            </div>
        );
    }

    const question = questions[currentIndex];
    const progress = ((currentIndex + 1) / questions.length) * 100;

    return (
        <div className="quiz-runner-container">
            <div className="quiz-header">
                <div className="quiz-info">
                    <span className="role-tag">{role}</span>
                    <span className="diff-tag">{difficulty}</span>
                </div>
                <button className="close-btn" onClick={onCancel}>✕ Cancel</button>
            </div>

            <div className="progress-bar-container">
                <div className="progress-bar" style={{ width: `${progress}%` }}></div>
            </div>

            <div className="question-card">
                <div className="question-meta">
                    <span className="q-num">Question {currentIndex + 1} of {questions.length}</span>
                    <span className={`type-tag ${question.type === 'snippet' ? 'code-type' : 'mcq-type'}`}>
                        {question.type === 'snippet' ? '💻 Code' : '📝 MCQ'}
                    </span>
                </div>

                <div className="question-text">
                    {question.type === 'snippet' ? (
                        <>
                            <p>{question.question.split('```')[0]}</p>
                            <pre className="code-snippet">{question.question.split('```')[1] || question.question}</pre>
                        </>
                    ) : (
                        <h3>{question.question}</h3>
                    )}
                </div>

                <div className="options-grid">
                    {question.options.map((opt) => (
                        <button
                            key={opt}
                            className={`option-btn ${selectedAnswer === opt ? 'selected' : ''}`}
                            onClick={() => setSelectedAnswer(opt)}
                        >
                            {opt}
                        </button>
                    ))}
                </div>

                <div className="quiz-footer">
                    <button
                        className="primary-btn next-btn"
                        disabled={!selectedAnswer}
                        onClick={handleNext}
                    >
                        {currentIndex < questions.length - 1 ? 'Next Question →' : 'Submit Quiz ✓'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default QuizRunner;
