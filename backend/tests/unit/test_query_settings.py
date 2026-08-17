"""Unit tests for query handler helpers."""

from lambdas.query.handler import (
    _format_conversation_history,
    _build_settings,
    DEFAULT_MODEL,
    DEFAULT_EMBEDDING,
    DEFAULT_RETRIEVAL,
    SYSTEM_PROMPT,
    SUMMARY_PROMPT,
)


class TestFormatConversationHistory:
    """Tests for _format_conversation_history."""

    def test_returns_none_for_empty_jobs(self):
        result = _format_conversation_history([], "current question")
        assert result is None

    def test_returns_none_for_no_completed_jobs(self):
        jobs = [{"status": "pending", "question": "q1"}]
        result = _format_conversation_history(jobs, "current question")
        assert result is None

    def test_returns_none_when_only_current_question(self):
        jobs = [{"status": "completed", "question": "current question", "answer": "a1", "created_at": "2026-01-01"}]
        result = _format_conversation_history(jobs, "current question")
        assert result is None

    def test_formats_single_completed_job(self):
        jobs = [
            {"status": "completed", "question": "What is HER2?", "answer": "HER2 is a protein.", "created_at": "2026-01-01"}
        ]
        result = _format_conversation_history(jobs, "different question")
        assert "Previous conversation:" in result
        assert "User: What is HER2?" in result
        assert "Assistant: HER2 is a protein." in result
        assert "---" in result

    def test_formats_multiple_jobs_in_order(self):
        jobs = [
            {"status": "completed", "question": "Q2", "answer": "A2", "created_at": "2026-01-02"},
            {"status": "completed", "question": "Q1", "answer": "A1", "created_at": "2026-01-01"},
        ]
        result = _format_conversation_history(jobs, "different question")
        q1_pos = result.find("Q1")
        q2_pos = result.find("Q2")
        assert q1_pos < q2_pos, "Jobs should be sorted by created_at ascending"

    def test_excludes_jobs_without_answer(self):
        jobs = [
            {"status": "completed", "question": "Q1", "created_at": "2026-01-01"},  # no answer
            {"status": "completed", "question": "Q2", "answer": "A2", "created_at": "2026-01-02"},
        ]
        result = _format_conversation_history(jobs, "different question")
        assert "Q1" not in result
        assert "Q2" in result


class TestBuildSettings:
    """Tests for _build_settings."""

    def test_uses_defaults_for_empty_settings(self):
        settings = _build_settings({}, None)

        assert settings.answer.evidence_k == DEFAULT_RETRIEVAL["evidence_k"]
        assert settings.answer.answer_max_sources == DEFAULT_RETRIEVAL["max_sources"]
        assert settings.texts_index_mmr_lambda == DEFAULT_RETRIEVAL["mmr_lambda"]

    def test_uses_user_settings_when_provided(self):
        user_settings = {
            "model_config": {
                "llm": {"provider": "bedrock", "model_id": "custom-model"},
                "summary_llm": {"provider": "bedrock", "model_id": "custom-summary"},
                "embedding": {"provider": "bedrock", "model_id": "custom-embed"},
            },
            "retrieval_config": {
                "evidence_k": 30,
                "max_sources": 15,
                "mmr_lambda": 0.5,
                "evidence_summary_length": 150,
                "answer_length": 500,
            },
        }
        settings = _build_settings(user_settings, None)

        assert "custom-model" in settings.llm
        assert settings.answer.evidence_k == 30
        assert settings.answer.answer_max_sources == 15
        assert "150 words" in settings.answer.evidence_summary_length
        assert "500 words" in settings.answer.answer_length
        assert settings.texts_index_mmr_lambda == 0.5

    def test_includes_conversation_history_in_system_prompt(self):
        history = "Previous conversation:\nUser: Q1\nAssistant: A1"
        settings = _build_settings({}, history)

        assert history in settings.prompts.system
        assert SYSTEM_PROMPT in settings.prompts.system

    def test_system_prompt_unchanged_when_no_history(self):
        settings = _build_settings({}, None)

        assert settings.prompts.system == SYSTEM_PROMPT

    def test_summary_prompt_is_constant(self):
        settings = _build_settings({}, None)

        assert settings.prompts.summary == SUMMARY_PROMPT

    def test_relevance_cutoff_is_always_one(self):
        """CRITICAL: evidence_relevance_score_cutoff must be 1 for Bedrock KB."""
        settings = _build_settings({}, None)

        assert settings.answer.evidence_relevance_score_cutoff == 1
