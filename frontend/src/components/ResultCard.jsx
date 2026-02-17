import './ResultCard.css';

/**
 * ResultCard — Displays a single recommended role with its match score.
 *
 * Props:
 *   role  (string)  – role title, e.g. "ML Engineer"
 *   score (number)  – relevance score (0-1 scale)
 *   rank  (number)  – 1-based rank for visual emphasis
 */
export default function ResultCard({ role, score, rank }) {
    // Convert 0-1 score to a percentage for the progress bar
    const pct = Math.min(Math.round(score * 100), 100);

    return (
        <div className={`result-card rank-${rank}`}>
            <div className="result-card-rank">#{rank}</div>
            <h3 className="result-card-title">{role}</h3>

            <div className="result-card-bar-track">
                <div
                    className="result-card-bar-fill"
                    style={{ width: `${pct}%` }}
                />
            </div>

            <p className="result-card-score">{pct}% match</p>
        </div>
    );
}
