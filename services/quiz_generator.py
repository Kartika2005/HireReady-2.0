
import os
import json
import logging
from typing import List, Dict, Any, Optional
from groq import Groq

logger = logging.getLogger(__name__)

def build_prompt(role: str, difficulty: str) -> str:
    level_guidance = ""
    if difficulty == "Low":
        level_guidance = 'Generate 10 MCQ questions ONLY (no code snippets) suitable for beginners. All questions must have type: "mcq".'
    elif difficulty == "Medium":
        level_guidance = 'Generate 10 mixed questions of intermediate complexity. Mix regular MCQs (type: "mcq") and code snippet MCQs (type: "snippet"). Include at least 4 code snippet questions.'
    else:
        # High
        level_guidance = 'Generate 10 mixed questions with advanced difficulty. Mix regular MCQs (type: "mcq") and code snippet MCQs (type: "snippet"). Include at least 5 code snippet questions with complex problems.'

    return f"""You are an expert interviewer. Generate exactly 10 questions for the selected role and difficulty level.

{level_guidance}

Role: {role}
Difficulty: {difficulty}

Rules:
- Each question must include: type ("mcq" or "snippet"), question text, 4 options, correctAnswer, and explanation.
- For "snippet" type questions, include code examples in the question text.
- Provide 4 multiple-choice options labeled A, B, C, D.
- correctAnswer must exactly match one of the options.
- explanation should provide clear reasoning for the correct answer.
- Return ONLY valid JSON array of exactly 10 objects with this exact shape:
  [
    {{
      "type": "mcq" or "snippet",
      "question": "...",
      "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
      "correctAnswer": "A) ...",
      "explanation": "..."
    }}
  ]
- No markdown, no extra text, no code blocks - just the JSON array.
"""

def parse_questions(text: str) -> Optional[List[Dict[str, Any]]]:
    try:
        start = text.find('[')
        end = text.rfind(']')
        if start == -1 or end == -1:
            return None
        json_text = text[start:end+1]
        return json.loads(json_text)
    except Exception as e:
        logger.error(f"Failed to parse quiz JSON: {e}")
        return None

def generate_quiz_questions(role: str, difficulty: str) -> List[Dict[str, Any]]:
    """
    Generates 10 quiz questions for the given role and difficulty using Groq API.
    Raises ValueError if GROQ_API_KEY is missing.
    Returns a list of question objects.
    """
    api_key = os.getenv("GROQ_API_KEY") or os.getenv("GROQ_API")
    if not api_key:
        raise ValueError("GROQ_API_KEY (or GROQ_API) is not set in environment variables.")

    client = Groq(api_key=api_key)
    
    prompt = build_prompt(role, difficulty)
    
    try:
        chat_completion = client.chat.completions.create(
            messages=[
                {
                    "role": "system",
                    "content": "You return strict JSON only."
                },
                {
                    "role": "user",
                    "content": prompt,
                }
            ],
            model="llama-3.3-70b-versatile",
            temperature=0.9,
        )
        
        content = chat_completion.choices[0].message.content
        questions = parse_questions(content)
        
        if not questions or len(questions) < 8:
            logger.warning("Groq returned too few questions or invalid JSON.")
            # Retry or fail? For now, we will return empty list or let the caller handle.
            # But let's assume we want to be robust.
            if not questions:
                raise Exception("Failed to parse questions from LLM response.")
        
        return questions

    except Exception as e:
        logger.error(f"Groq API error: {e}")
        raise e
