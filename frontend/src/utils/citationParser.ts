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

  // Parse the answer text for (docname) or (docname chunk) patterns
  const segments: Array<{ type: 'text' | 'citation'; content: string; citation?: ParsedCitation }> = [];
  const regex = /\(([^)]+)\)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(answerText)) !== null) {
    // Split on commas to handle multi-citation groups like (key1 chunk, key2 chunk)
    const keys = match[1].split(',').map(k => k.trim().replace(/ chunk$/, ''));
    const resolved = keys.map(k => citationMap.get(k)).filter(Boolean) as ParsedCitation[];

    // Add text before the match
    if (match.index > lastIndex) {
      segments.push({
        type: 'text',
        content: answerText.substring(lastIndex, match.index),
      });
    }

    // Add each resolved citation, or fall back to raw text if none matched
    if (resolved.length > 0) {
      for (const citation of resolved) {
        segments.push({
          type: 'citation',
          content: `[${citation.number}]`,
          citation,
        });
      }
    } else {
      segments.push({
        type: 'text',
        content: match[0],
      });
    }

    lastIndex = regex.lastIndex;
  }

  // Add remaining text
  if (lastIndex < answerText.length) {
    segments.push({
      type: 'text',
      content: answerText.substring(lastIndex),
    });
  }

  return { segments, citationMap };



}
