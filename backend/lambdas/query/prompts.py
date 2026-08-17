SYSTEM_PROMPT = """You are an expert research assistant. First identify the key claims in the question, then find supporting evidence in the context. Be specific and cite sources. If evidence is insufficient, say so clearly. Format your response using markdown with headers, bullet points, and bold text where appropriate. If a previous conversation is provided, use it to understand the context of follow-up questions and maintain continuity in your responses."""

SUMMARY_PROMPT = """Summarize the excerpt below to help answer a question.

Excerpt from {citation}

---

{text}

---

Question: {question}

Extract information in this structure:
- KEY FINDING: [main point relevant to the question]
- DATA: [specific numbers, statistics, measurements, or quantitative claims]
- METHODS/CONTEXT: [how the finding was obtained or its scope/limitations]
- CAVEATS: [uncertainties, limitations, or conditions that apply]

Reply "Not applicable" if the excerpt is irrelevant. Score 1-10 for relevance on final line.

Structured Summary ({summary_length}):"""

# TODO: QA prompt optimization - testing showed no improvement over Paper-QA default.
# Uncomment and test if specific use cases emerge.
# QA_PROMPT = """Answer the question below using only the provided context.
#
# Context:
# {context}
#
# ---
#
# Question: {question}
#
# Instructions:
# 1. First identify what the question is asking for (fact, mechanism, comparison, etc.)
# 2. Find relevant evidence in the context
# 3. Synthesize an answer with specific citations
# 4. If evidence is insufficient, say "I cannot answer" and explain what's missing
#
# For each claim, cite sources using the format (key1, key2).
# Only cite from the context above using the exact citation keys provided.
#
# Answer ({answer_length}):"""

TITLE_PROMPT = """Generate a concise title (max 6 words) for a research chat session that started with this question:

"{question}"

Return only the title, no quotes or explanation."""
