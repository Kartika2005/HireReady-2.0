"""
Tests for services/feature_analyzer.py

Validates the core contract: 64-feature dictionary with correct types
and schema compliance.
"""

import pytest
from services.feature_analyzer import (
    FEATURE_COLUMNS,
    initialize_feature_vector,
    extract_resume_features,
    build_complete_feature_vector,
    _validate_feature_vector,
)


class TestFeatureColumns:
    """Verify the canonical column list."""

    def test_column_count(self):
        assert len(FEATURE_COLUMNS) == 64

    def test_no_duplicates(self):
        assert len(FEATURE_COLUMNS) == len(set(FEATURE_COLUMNS))

    def test_required_skills_present(self):
        for skill in ["Python", "Java", "C++", "React", "Docker", "LLM"]:
            assert skill in FEATURE_COLUMNS

    def test_required_internships_present(self):
        for col in [
            "internship_backend", "internship_ai", "internship_cloud",
            "internship_security", "internship_mobile", "internship_data",
        ]:
            assert col in FEATURE_COLUMNS

    def test_required_leetcode_present(self):
        for col in [
            "leetcode_easy", "leetcode_medium", "leetcode_hard",
            "leetcode_total", "leetcode_contest_rating",
        ]:
            assert col in FEATURE_COLUMNS


class TestInitializeFeatureVector:
    """Verify the zero-vector initialiser."""

    def test_returns_dict(self):
        vec = initialize_feature_vector()
        assert isinstance(vec, dict)

    def test_correct_key_count(self):
        vec = initialize_feature_vector()
        assert len(vec) == 64

    def test_all_values_zero(self):
        vec = initialize_feature_vector()
        assert all(v == 0 for v in vec.values())

    def test_all_values_are_int(self):
        vec = initialize_feature_vector()
        assert all(isinstance(v, int) for v in vec.values())


class TestExtractResumeFeatures:
    """Verify keyword detection from resume text."""

    def test_empty_text_returns_zeros(self):
        result = extract_resume_features("")
        assert len(result) == 64
        assert all(v == 0 for v in result.values())

    def test_python_detected(self):
        result = extract_resume_features("Experienced Python developer")
        assert result["Python"] == 1

    def test_java_not_triggered_by_javascript(self):
        result = extract_resume_features("I know JavaScript very well")
        assert result["JavaScript"] == 1
        assert result["Java"] == 0

    def test_multiple_skills(self):
        text = "Built REST APIs with Django and Flask. Deployed on Docker and AWS."
        result = extract_resume_features(text)
        assert result["Django"] == 1
        assert result["Flask"] == 1
        assert result["Docker"] == 1
        assert result["AWS"] == 1

    def test_internship_detection(self):
        text = "Completed a backend engineering internship at a tech company."
        result = extract_resume_features(text)
        assert result["internship_backend"] == 1

    def test_ai_internship_detection(self):
        text = "Summer intern in the machine learning research team."
        result = extract_resume_features(text)
        assert result["internship_ai"] == 1

    def test_cicd_detection(self):
        text = "Set up CI/CD pipelines using Jenkins."
        result = extract_resume_features(text)
        assert result["CI/CD"] == 1

    def test_react_native_detected(self):
        text = "Built cross-platform mobile apps with React Native."
        result = extract_resume_features(text)
        assert result["ReactNative"] == 1

    def test_project_counting(self):
        text = (
            "Project: Built a REST API backend server.\n"
            "Project: Developed a mobile app using Flutter."
        )
        result = extract_resume_features(text)
        assert result["num_backend_projects"] >= 1
        assert result["num_mobile_projects"] >= 1

    def test_returns_all_feature_columns(self):
        result = extract_resume_features("Python developer with TensorFlow experience")
        assert set(result.keys()) == set(FEATURE_COLUMNS)


class TestBuildCompleteFeatureVector:
    """Integration test for the orchestrator (uses empty inputs to avoid API calls)."""

    def test_returns_64_keys(self):
        result = build_complete_feature_vector(
            resume_text="Python developer",
            github_username="",
            leetcode_username="",
        )
        assert len(result) == 64

    def test_all_values_are_int(self):
        result = build_complete_feature_vector(
            resume_text="Experienced in Java, Spring Boot, and Docker.",
            github_username="",
            leetcode_username="",
        )
        assert all(isinstance(v, int) for v in result.values())

    def test_skill_detected_from_resume(self):
        result = build_complete_feature_vector(
            resume_text="Expert in TensorFlow and PyTorch for deep learning.",
            github_username="",
            leetcode_username="",
        )
        assert result["TensorFlow"] == 1
        assert result["PyTorch"] == 1

    def test_empty_inputs_return_zeros(self):
        result = build_complete_feature_vector(
            resume_text="",
            github_username="",
            leetcode_username="",
        )
        assert all(v == 0 for v in result.values())


class TestValidation:
    """Verify schema enforcement."""

    def test_valid_vector_passes(self):
        vec = initialize_feature_vector()
        _validate_feature_vector(vec)  # should not raise

    def test_missing_column_raises(self):
        vec = initialize_feature_vector()
        del vec["Python"]
        with pytest.raises(ValueError, match="Missing columns"):
            _validate_feature_vector(vec)

    def test_extra_column_raises(self):
        vec = initialize_feature_vector()
        vec["FakeColumn"] = 0
        with pytest.raises(ValueError, match="Extra columns"):
            _validate_feature_vector(vec)

    def test_non_int_value_raises(self):
        vec = initialize_feature_vector()
        vec["Python"] = 1.5
        with pytest.raises(ValueError, match="non-integer"):
            _validate_feature_vector(vec)
