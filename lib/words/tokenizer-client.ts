import { WordToken } from '@/types';

/**
 * Client-side word tokenization (simplified version without DB access)
 * This matches the server-side tokenizer but doesn't assign IDs
 * IDs will be fetched from the server
 */
export function tokenizeChapterClient(content: string): Omit<WordToken, 'wordId'>[] {
  const lines = content.split('\n');
  const allTokens: Omit<WordToken, 'wordId'>[] = [];
  let globalCharPosition = 0;

  lines.forEach((line, lineIndex) => {
    // Split on whitespace, keep non-empty words
    const words = line.split(/\s+/).filter(w => w.length > 0);

    // Track position in the original line to calculate char offsets
    let lineCharPosition = 0;
    const originalLine = line;

    words.forEach((word, positionInLine) => {
      // Find where this word appears in the line
      const wordIndexInLine = originalLine.indexOf(word, lineCharPosition);
      const charStart = globalCharPosition + wordIndexInLine;
      const charEnd = charStart + word.length;

      allTokens.push({
        text: word,
        lineNumber: lineIndex + 1, // 1-based (git convention)
        positionInLine: positionInLine, // 0-based
        charStart,
        charEnd
      });

      // Move position forward for next word search
      lineCharPosition = wordIndexInLine + word.length;
    });

    // Add line length + newline character to global position
    globalCharPosition += originalLine.length + 1;
  });

  return allTokens;
}

/**
 * Get word token at a specific character position
 */
export function getWordAtPosition(
  tokens: Omit<WordToken, 'wordId'>[],
  charPosition: number
): Omit<WordToken, 'wordId'> | null {
  return tokens.find(t =>
    charPosition >= t.charStart && charPosition < t.charEnd
  ) || null;
}

/**
 * Get word tokens that overlap with a character range
 */
export function getWordsInRange(
  tokens: Omit<WordToken, 'wordId'>[],
  startPos: number,
  endPos: number
): Omit<WordToken, 'wordId'>[] {
  return tokens.filter(t =>
    (t.charStart >= startPos && t.charStart < endPos) ||
    (t.charEnd > startPos && t.charEnd <= endPos) ||
    (t.charStart <= startPos && t.charEnd >= endPos)
  );
}
