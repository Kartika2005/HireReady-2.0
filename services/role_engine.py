import math

def _normalize(value, max_val):
    """Normalize a value to 0-1 range with a cap."""
    if max_val <= 0: return 0
    return min(value / max_val, 1.0)

# Define roles with required skills and weights
# Weights: skills (binary match), internship (binary), projects (numeric), github/leetcode (numeric)
ROLE_DEFINITIONS = {
    # ── Web Development ───────────────────────────────────────────────────────
    "Software Engineer": {
        "required": ["Python", "Java", "C++", "JavaScript", "SQL", "Git", "DSA", "OOPS"],
        "weights": {"skills": 0.35, "internship": 0.20, "projects": 0.25, "leetcode": 0.20}
    },
    "Backend Developer": {
        "required": ["Java", "Python", "JavaScript", "Spring", "Node", "Django", "Flask", "FastAPI", "Express", "SQL"],
        "weights": {"skills": 0.50, "internship": 0.20, "projects": 0.15, "github": 0.15}
    },
    "Frontend Developer": {
        "required": ["React", "Angular", "Vue", "NextJS", "HTML", "CSS", "JavaScript", "TypeScript"],
        "weights": {"skills": 0.50, "internship": 0.10, "projects": 0.20, "github": 0.10}
    },
    "Full Stack Developer": {
        "required": ["React", "Node", "JavaScript", "SQL", "Django", "Spring"],
        "weights": {"skills": 0.40, "internship": 0.20, "projects": 0.20, "github": 0.20}
    },
    
    # ── Data & AI ─────────────────────────────────────────────────────────────
    "Data Scientist": {
        "required": ["Python", "Pandas", "Scikit", "SQL", "NLP", "TensorFlow", "PyTorch"],
        "weights": {"skills": 0.35, "internship": 0.15, "projects": 0.40, "leetcode": 0.10}
    },
    "ML Engineer": {
        "required": ["Python", "TensorFlow", "PyTorch", "Scikit", "Pandas", "ComputerVision", "NLP"],
        "weights": {"skills": 0.35, "internship": 0.20, "projects": 0.40, "leetcode": 0.05}
    },
    "AI Engineer": {
        "required": ["Python", "TensorFlow", "PyTorch", "LLM", "PromptEngineering", "Scikit"],
        "weights": {"skills": 0.35, "internship": 0.20, "projects": 0.40, "github": 0.05}
    },
    "Data Engineer": {
        "required": ["SQL", "Python", "Pandas", "AWS", "Azure", "GCP", "Spark", "Hadoop"],
        "weights": {"skills": 0.35, "internship": 0.20, "projects": 0.40, "github": 0.05}
    },

    # ── Mobile ────────────────────────────────────────────────────────────────
    "Mobile Developer": {
        "required": ["Android", "Flutter", "ReactNative", "Swift", "Kotlin"],
        "weights": {"skills": 0.50, "internship": 0.20, "projects": 0.30, "github": 0.0}
    },
    "Android Developer": {
        "required": ["Android", "Java", "Kotlin"],
        "weights": {"skills": 0.60, "internship": 0.20, "projects": 0.20, "github": 0.0}
    },
    
    # ── Infrastructure & Security ─────────────────────────────────────────────
    "DevOps Engineer": {
        "required": ["Docker", "Kubernetes", "CI/CD", "AWS", "Azure", "GCP", "Linux"],
        "weights": {"skills": 0.50, "internship": 0.20, "projects": 0.15, "github": 0.15}
    },
    "Cloud Engineer": {
        "required": ["AWS", "Azure", "GCP", "Docker", "Kubernetes"],
        "weights": {"skills": 0.50, "internship": 0.20, "projects": 0.20, "github": 0.10}
    },
    "Cybersecurity Analyst": {
        "required": ["EthicalHacking", "Cryptography", "NetworkSecurity", "Linux"],
        "weights": {"skills": 0.50, "internship": 0.20, "projects": 0.30, "github": 0.0}
    },

    # ── Specialized ───────────────────────────────────────────────────────────
    "Game Developer": {
        "required": ["C++", "C", "Unity", "Unreal", "OpenGL"],
        "weights": {"skills": 0.50, "internship": 0.10, "projects": 0.30, "github": 0.10}
    },
    "Blockchain Developer": {
        "required": ["Solidity", "Rust", "Go", "Cryptography", "SmartContracts"],
        "weights": {"skills": 0.50, "internship": 0.10, "projects": 0.30, "github": 0.10}
    },
    "QA Engineer": {
        "required": ["Selenium", "JUnit", "PyTest", "SystemDesign", "SQL"],
        "weights": {"skills": 0.50, "internship": 0.20, "projects": 0.15, "github": 0.15}
    },
    "Java Developer": {
        "required": ["Java", "Spring", "Hibernate", "SQL", "OOPS"],
        "weights": {"skills": 0.50, "internship": 0.20, "projects": 0.15, "leetcode": 0.15}
    },
    "Python Developer": {
        "required": ["Python", "Django", "Flask", "FastAPI", "SQL", "Pandas"],
        "weights": {"skills": 0.50, "internship": 0.20, "projects": 0.15, "leetcode": 0.15}
    }
}

def rank_roles(user_features, top_k=3):
    """
    Calculate role suitability scores (0-100%) and return top K roles.
    """
    scores = {}

    for role, config in ROLE_DEFINITIONS.items():
        score = 0.0
        weights = config["weights"]
        required = config["required"]

        # 1. Skills Calculation (diminishing returns)
        # Frontend requires 8 skills for max score (stricter)
        # Software Engineer requires 8 (broad)
        # Others require 6
        denom = 8.0 if role in ["Frontend Developer", "Software Engineer"] else 6.0
        matches = sum(1 for s in required if user_features.get(s, 0) > 0)
        skill_score = min(matches / denom, 1.0)
        score += skill_score * weights.get("skills", 0)

        # 2. Key Internship Matching
        intern_score = 0
        if role in ["Software Engineer", "Backend Developer", "Full Stack Developer", "Java Developer", "Python Developer", "Game Developer", "Blockchain Developer"]:
            intern_score = user_features.get("internship_backend", 0)
        elif role in ["Frontend Developer", "QA Engineer"]:
            intern_score = max(user_features.get("internship_backend", 0), user_features.get("internship_mobile", 0)) 
        elif role in ["Data Scientist", "ML Engineer", "AI Engineer", "Data Engineer"]:
            # Allow generic backend internship to count for 80% credit for AI roles
            # (Significant overlap in engineering practices)
            ai_intern = max(user_features.get("internship_ai", 0), user_features.get("internship_data", 0))
            backend_intern = user_features.get("internship_backend", 0) * 0.8
            intern_score = max(ai_intern, backend_intern)
        elif role in ["Mobile Developer", "Android Developer"]:
            intern_score = user_features.get("internship_mobile", 0)
        elif role in ["DevOps Engineer", "Cloud Engineer"]:
            intern_score = user_features.get("internship_cloud", 0)
        elif role == "Cybersecurity Analyst":
            intern_score = user_features.get("internship_security", 0)
        
        score += min(intern_score, 1) * weights.get("internship", 0)

        # 3. Project Count Normalization
        # 4 relevant projects = 100% of project weight (was 8)
        proj_count = 0
        if role in ["Backend Developer", "Full Stack Developer", "Java Developer", "Python Developer", "Game Developer", "Blockchain Developer"]:
            proj_count = user_features.get("num_backend_projects", 0)
        elif role == "Frontend Developer":
            proj_count = max(user_features.get("num_backend_projects", 0), user_features.get("num_mobile_projects", 0))
        elif role in ["Data Scientist", "ML Engineer", "AI Engineer", "Data Engineer"]:
            proj_count = user_features.get("num_ai_projects", 0)
        elif role in ["Mobile Developer", "Android Developer", "QA Engineer"]:
            proj_count = user_features.get("num_mobile_projects", 0)
        elif role in ["DevOps Engineer", "Cloud Engineer"]:
            proj_count = user_features.get("num_cloud_projects", 0)
        elif role == "Cybersecurity Analyst":
            proj_count = user_features.get("num_security_projects", 0)

        proj_score = min(proj_count / 4.0, 1.0)
        score += proj_score * weights.get("projects", 0)

        # 4. Technical Assessment (GitHub or LeetCode)
        if "github" in weights:
            # 300 commits = 100% of github weight (was 150)
            commits = user_features.get("github_total_commits", 0)
            gh_score = min(commits / 300.0, 1.0)
            score += gh_score * weights["github"]
        
        elif "leetcode" in weights:
            # 100 medium/hard problems = 100% of leetcode weight (was 50)
            solved = user_features.get("leetcode_medium", 0) + user_features.get("leetcode_hard", 0) * 2
            lc_score = min(solved / 100.0, 1.0)
            score += lc_score * weights["leetcode"]

        scores[role] = round(score * 100, 2)

    ranked = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    return ranked[:top_k]
