import { WordToken } from '@/types';
import { getDb } from '@/lib/db';

// Global counter for generating word IDs
let wordIdCounter = 0;
let initialized = false;

/**
 * Initialize the word ID counter from database
 * Called automatically on first use (lazy initialization)
 */
export function initializeWordIdCounter(): void {
  if (initialized) return;

  try {
    const db = getDb();
    const result = db.prepare(`
      SELECT next_id FROM word_id_counter WHERE id = 1
    `).get() as { next_id: number } | undefined;

    if (result) {
      wordIdCounter = result.next_id;
    } else {
      // Initialize counter in database
      db.prepare(`
        INSERT OR REPLACE INTO word_id_counter (id, next_id) VALUES (1, 1)
      `).run();
      wordIdCounter = 1;
    }
    initialized = true;
  } catch (error) {
    console.error('Failed to initialize word ID counter:', error);
    wordIdCounter = 1;
    initialized = true; // Mark as initialized to avoid repeated errors
  }
}

/**
 * Generate a new unique word ID and persist to database
 * @returns Persistent word ID (e.g., "w1", "w2", "w3")
 */
export function generateNewWordId(): string {
  // Lazy initialization
  if (!initialized) {
    initializeWordIdCounter();
  }

  const newId = `w${wordIdCounter}`;
  wordIdCounter++;

  // Update counter in database
  try {
    const db = getDb();
    db.prepare(`
      UPDATE word_id_counter SET next_id = ? WHERE id = 1
    `).run(wordIdCounter);
  } catch (error) {
    console.error('Failed to update word ID counter:', error);
  }

  return newId;
}

/**
 * Tokenize chapter content into words with position tracking
 * NOTE: Word IDs are NOT assigned here - they're assigned/inherited
 * when processing git diffs. This just tokenizes for position tracking.
 *
 * @param content Raw markdown content
 * @returns Array of word tokens without IDs assigned
 */
export function tokenizeChapter(content: string): WordToken[] {
  const lines = content.split('\n');
  const allTokens: WordToken[] = [];
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
        wordId: '', // Filled in later during diff processing
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
 * Useful for converting old position-based feedback to word IDs
 *
 * @param tokens Array of word tokens
 * @param charPosition Character offset in content
 * @returns Word token at that position, or null
 */
export function getWordAtPosition(tokens: WordToken[], charPosition: number): WordToken | null {
  return tokens.find(t =>
    charPosition >= t.charStart && charPosition < t.charEnd
  ) || null;
}

/**
 * Get word tokens that overlap with a character range
 * Used for feedback that spans multiple words
 *
 * @param tokens Array of word tokens
 * @param startPos Start character position
 * @param endPos End character position
 * @returns Array of word tokens in range
 */
export function getWordsInRange(
  tokens: WordToken[],
  startPos: number,
  endPos: number
): WordToken[] {
  return tokens.filter(t =>
    (t.charStart >= startPos && t.charStart < endPos) ||
    (t.charEnd > startPos && t.charEnd <= endPos) ||
    (t.charStart <= startPos && t.charEnd >= endPos)
  );
}

/**
 * Build a map of line:position -> wordId for efficient lookup
 * Used when processing git diffs to inherit word IDs
 *
 * @param tokens Array of word tokens with assigned IDs
 * @returns Map with keys like "10:3" mapping to word IDs
 */
export function buildPositionToWordIdMap(tokens: WordToken[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const token of tokens) {
    const key = `${token.lineNumber}:${token.positionInLine}`;
    map.set(key, token.wordId);
  }
  return map;
}
