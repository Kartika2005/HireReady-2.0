# services/role_engine.py

ROLE_WEIGHTS = {

    "Backend Developer": {
        "Java": 0.15,
        "Spring": 0.15,
        "Node": 0.15,
        "Django": 0.10,
        "Flask": 0.10,
        "SQL": 0.10,
        "DBMS": 0.10,
        "internship_backend": 0.10,
        "num_backend_projects": 0.05
    },

    "Frontend Developer": {
        "React": 0.20,
        "Angular": 0.15,
        "Vue": 0.15,
        "NextJS": 0.10,
        "HTML": 0.10,
        "CSS": 0.10,
        "JavaScript": 0.10,
        "TypeScript": 0.10
    },

    "Full Stack Developer": {
        "React": 0.15,
        "Node": 0.15,
        "JavaScript": 0.10,
        "SQL": 0.10,
        "internship_backend": 0.15,
        "num_backend_projects": 0.15,
        "github_total_repos": 0.20
    },

    "ML Engineer": {
        "TensorFlow": 0.20,
        "PyTorch": 0.20,
        "Scikit": 0.10,
        "Pandas": 0.10,
        "NLP": 0.10,
        "ComputerVision": 0.10,
        "internship_ai": 0.10,
        "num_ai_projects": 0.10
    },

    "Data Scientist": {
        "Python": 0.15,
        "Pandas": 0.20,
        "Scikit": 0.20,
        "SQL": 0.10,
        "NLP": 0.10,
        "num_ai_projects": 0.10,
        "leetcode_medium": 0.15
    },

    "Data Engineer": {
        "SQL": 0.25,
        "Python": 0.15,
        "Pandas": 0.10,
        "AWS": 0.10,
        "GCP": 0.10,
        "num_cloud_projects": 0.15,
        "internship_data": 0.15
    },

    "Java Developer": {
        "Java": 0.40,
        "Spring": 0.20,
        "OOPS": 0.20,
        "internship_backend": 0.20
    },

    "Python Developer": {
        "Python": 0.40,
        "Flask": 0.20,
        "Django": 0.20,
        "internship_backend": 0.20
    },

    "DevOps Engineer": {
        "Docker": 0.20,
        "Kubernetes": 0.20,
        "CI/CD": 0.20,
        "AWS": 0.10,
        "num_cloud_projects": 0.15,
        "internship_cloud": 0.15
    },

    "Cloud Engineer": {
        "AWS": 0.25,
        "Azure": 0.20,
        "GCP": 0.20,
        "Docker": 0.10,
        "num_cloud_projects": 0.15,
        "internship_cloud": 0.10
    },

    "Mobile Developer": {
        "Android": 0.30,
        "Flutter": 0.20,
        "ReactNative": 0.20,
        "num_mobile_projects": 0.15,
        "internship_mobile": 0.15
    },

    "Android Developer": {
        "Android": 0.60,
        "Java": 0.20,
        "internship_mobile": 0.20
    },

    "iOS Developer": {
        "ReactNative": 0.40,
        "Flutter": 0.20,
        "internship_mobile": 0.20,
        "OOPS": 0.20
    },

    "QA / Test Engineer": {
        "SystemDesign": 0.30,
        "OOPS": 0.20,
        "leetcode_easy": 0.20,
        "internship_backend": 0.15,
        "github_total_repos": 0.15
    },

    "Cybersecurity Analyst": {
        "EthicalHacking": 0.30,
        "Cryptography": 0.25,
        "NetworkSecurity": 0.25,
        "num_security_projects": 0.10,
        "internship_security": 0.10
    },

    "AI Research Engineer": {
        "TensorFlow": 0.20,
        "PyTorch": 0.20,
        "NLP": 0.15,
        "LLM": 0.15,
        "leetcode_hard": 0.20,
        "internship_ai": 0.10
    },

    "Game Developer": {
        "C++": 0.40,
        "OS": 0.20,
        "OOPS": 0.20,
        "num_backend_projects": 0.20
    },

    "Blockchain Developer": {
        "Cryptography": 0.30,
        "Go": 0.20,
        "Rust": 0.20,
        "num_backend_projects": 0.30
    },

    "Database Administrator": {
        "SQL": 0.40,
        "DBMS": 0.40,
        "internship_data": 0.20
    },

    "Systems Engineer": {
        "OS": 0.30,
        "SystemDesign": 0.30,
        "DBMS": 0.20,
        "leetcode_medium": 0.20
    },

    "UI/UX Designer": {
        "HTML": 0.20,
        "CSS": 0.20,
        "React": 0.10,
        "num_mobile_projects": 0.10,
        "github_total_repos": 0.10,
        "internship_backend": 0.10,
        "TypeScript": 0.20
    },

    "Prompt Engineer": {
        "LLM": 0.40,
        "PromptEngineering": 0.40,
        "Python": 0.20
    },

    "AI Engineer": {
        "TensorFlow": 0.20,
        "PyTorch": 0.20,
        "LLM": 0.20,
        "Scikit": 0.10,
        "num_ai_projects": 0.10,
        "internship_ai": 0.20
    }
}

def rank_roles(user_features, top_k=3):
    scores = {}

    for role, weights in ROLE_WEIGHTS.items():
        score = 0
        for feature, weight in weights.items():
            score += user_features.get(feature, 0) * weight

        scores[role] = score

    ranked = sorted(scores.items(), key=lambda x: x[1], reverse=True)

    return ranked[:top_k]
