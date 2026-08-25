export interface ParsedCitation {
  number: number;
  docname: string;
  quote: string;
  textName: string,
  relevanceScore: number;
}

export function parseAnswerWithCitations(
  answerText: string,
  citations: Array<{ docname: string; textName: string; relevanceScore: number }>
): {
  segments: Array<{ type: 'text' | 'citation'; content: string; citation?: ParsedCitation }>;
  citationMap: Map<string, ParsedCitation>;
} {
  // Build citation map keyed by both textName and docname so we can match
  // whatever paper-qa inlines in formatted_answer (docname, not full text name)
  const citationMap = new Map<string, ParsedCitation>();
  citations.forEach((cit, idx) => {
    const entry: ParsedCitation = { number: idx + 1, ...cit, quote: "" };
    citationMap.set(cit.textName, entry);
    citationMap.set(cit.docname, entry);
  });

  const segments: Array<{ type: 'text' | 'citation'; content: string; citation?: ParsedCitation }> = [];

  // If no citations, return the text as-is
  if (citationMap.size === 0) {
    segments.push({ type: 'text', content: answerText });
    return { segments, citationMap };
  }

  // Build regex from known keys so docnames containing ")" don't break the match.
  // The naive /\(([^)]+)\)/ stops at the first ")" — which splits keys like "elife-24146-v3 (1)chunk".
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const allKeys = [...citationMap.keys()].sort((a, b) => b.length - a.length); // longest first
  const keyPattern = allKeys.map(escape).join('|');
  // Match one citation group: (key1, key2, ...) where each key may end with optional " chunk"
  const citationEntryRe = new RegExp(`(?:${keyPattern})(?:\\s+chunk)?`, 'g');
  const groupRe = new RegExp(
    `\\(((?:(?:${keyPattern})(?:\\s+chunk)?(?:,\\s*)?)+)\\)`,
    'g'
  );

  let lastIndex = 0;
  let match;

  while ((match = groupRe.exec(answerText)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      segments.push({ type: 'text', content: answerText.substring(lastIndex, match.index) });
    }

    // Extract individual keys from the group
    citationEntryRe.lastIndex = 0;
    let keyMatch;
    while ((keyMatch = citationEntryRe.exec(match[1])) !== null) {
      // Strip trailing " chunk" to get the bare key, then look up
      const bare = keyMatch[0].replace(/\s+chunk$/, '');
      const citation = citationMap.get(bare);
      if (citation) {
        segments.push({ type: 'citation', content: `[${citation.number}]`, citation });
      }
    }

    lastIndex = groupRe.lastIndex;
  }

  // Add remaining text
  if (lastIndex < answerText.length) {
    segments.push({ type: 'text', content: answerText.substring(lastIndex) });
  }

  // In text segments, add spaces around parentheses where the LLM omitted them
  // e.g. "receptor-positive(ER+)breast" → "receptor-positive (ER+) breast"
  for (const seg of segments) {
    if (seg.type === 'text') {
      seg.content = seg.content
        .replace(/(\S)\(/g, '$1 (')
        .replace(/\)(\S)/g, ') $1');
    }
  }

  return { segments, citationMap };



}
