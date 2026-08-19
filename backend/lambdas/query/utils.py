def build_retrieval_query(question: str, jobs: list[dict]) -> str:
    """Build a context-aware search query for the vector store.

    When there is prior conversation, the current question may be a follow-up
    that is ambiguous on its own (e.g. "Can you elaborate on that?"). We
    prepend a compact summary of what the session has been about so the
    vector search returns documents relevant to the actual topic.
    """
    completed = [
        j for j in jobs
        if j["status"] == "completed" and "answer" in j and j["question"] != question
    ]
    if not completed:
        return question

    prior = sorted(completed, key=lambda j: j["created_at"])
    # Use the last prior question as context — it's the most relevant anchor
    last_question = prior[-1]["question"]
    return f"{question} [Context: {last_question}]"


def format_conversation_history(jobs: list[dict], current_question: str) -> str | None:
    """Format prior Q&A pairs for the pre-prompt.

    Args:
        jobs: List of jobs from the session
        current_question: The current question being asked (to exclude from history)

    Returns:
        Formatted conversation history string, or None if no prior conversation
    """
    completed = [
        j for j in jobs
        if j["status"] == "completed"
        and "answer" in j
        and j["question"] != current_question
    ]
    if not completed:
        return None

    lines = ["Previous conversation:\n"]
    for job in sorted(completed, key=lambda j: j["created_at"]):
        lines.append(f"User: {job['question']}")
        lines.append(f"Assistant: {job['answer']}\n")
    lines.append("---\n")
    return "\n".join(lines)