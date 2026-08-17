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