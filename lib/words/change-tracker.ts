import { WordToken, UnchangedRange } from '@/types';
import { getFileContentAtCommit, getFileDiff, getChapterVersions } from '@/lib/git';
import { tokenizeChapter, generateNewWordId, buildPositionToWordIdMap } from './tokenizer';

// In-memory cache for computed word versions with LRU eviction
// Key: chapterId, Value: Map of commitSha → WordTokens[]
// Max 10 chapters cached at once, each with all their versions
const MAX_CACHED_CHAPTERS = 10;
const versionCache = new Map<string, Map<string, WordToken[]>>();
const cacheAccessOrder: string[] = []; // Track access order for LRU

/**
 * Update LRU cache access order
 */
function touchCache(chapterId: string): void {
  // Remove if exists
  const index = cacheAccessOrder.indexOf(chapterId);
  if (index > -1) {
    cacheAccessOrder.splice(index, 1);
  }
  // Add to end (most recently used)
  cacheAccessOrder.push(chapterId);

  // Evict oldest if over limit
  if (cacheAccessOrder.length > MAX_CACHED_CHAPTERS) {
    const oldestChapterId = cacheAccessOrder.shift();
    if (oldestChapterId) {
      versionCache.delete(oldestChapterId);
      console.log(`Evicted chapter ${oldestChapterId} from version cache (LRU)`);
    }
  }
}

/**
 * Parse git unified diff output to extract unchanged line ranges
 * These ranges tell us which lines (and their words) can inherit IDs
 *
 * @param diffOutput Git diff in unified format
 * @returns Array of unchanged line ranges
 */
export function parseDiffToUnchangedRanges(diffOutput: string): UnchangedRange[] {
  const ranges: UnchangedRange[] = [];
  const lines = diffOutput.split('\n');

  let oldLineNum = 0;
  let newLineNum = 0;
  let currentUnchangedStart: { old: number; new: number } | null = null;

  for (const line of lines) {
    if (line.startsWith('@@')) {
      // Parse hunk header: @@ -oldStart,oldCount +newStart,newCount @@
      const match = line.match(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
      if (match) {
        // Close any open unchanged range before starting new hunk
        if (currentUnchangedStart) {
          ranges.push({
            oldStart: currentUnchangedStart.old,
            oldEnd: oldLineNum - 1,
            newStart: currentUnchangedStart.new,
            newEnd: newLineNum - 1
          });
          currentUnchangedStart = null;
        }

        oldLineNum = parseInt(match[1]);
        newLineNum = parseInt(match[3]);
      }
    } else if (line.startsWith('-')) {
      // Line removed from old
      if (currentUnchangedStart) {
        ranges.push({
          oldStart: currentUnchangedStart.old,
          oldEnd: oldLineNum - 1,
          newStart: currentUnchangedStart.new,
          newEnd: newLineNum - 1
        });
        currentUnchangedStart = null;
      }
      oldLineNum++;
    } else if (line.startsWith('+')) {
      // Line added to new
      if (currentUnchangedStart) {
        ranges.push({
          oldStart: currentUnchangedStart.old,
          oldEnd: oldLineNum - 1,
          newStart: currentUnchangedStart.new,
          newEnd: newLineNum - 1
        });
        currentUnchangedStart = null;
      }
      newLineNum++;
    } else if (line.startsWith(' ')) {
      // Unchanged line (context)
      if (!currentUnchangedStart) {
        currentUnchangedStart = { old: oldLineNum, new: newLineNum };
      }
      oldLineNum++;
      newLineNum++;
    }
  }

  // Close final range if open
  if (currentUnchangedStart) {
    ranges.push({
      oldStart: currentUnchangedStart.old,
      oldEnd: oldLineNum - 1,
      newStart: currentUnchangedStart.new,
      newEnd: newLineNum - 1
    });
  }

  return ranges;
}

/**
 * Process a single commit diff to assign or inherit word IDs
 * This is where the magic happens - words in unchanged lines inherit their IDs
 *
 * @param filename Path to chapter file
 * @param newCommit SHA of new commit
 * @param previousCommit SHA of previous commit (null for first commit)
 * @param previousWords Word tokens from previous version
 * @returns Word tokens for new version with IDs assigned
 */
export async function processCommitDiff(
  filename: string,
  newCommit: string,
  previousCommit: string | null,
  previousWords: WordToken[]
): Promise<WordToken[]> {
  // Tokenize new version
  const newContent = await getFileContentAtCommit(filename, newCommit);
  const newWords = tokenizeChapter(newContent);

  if (!previousCommit) {
    // First commit - assign new IDs to all words
    for (const word of newWords) {
      word.wordId = generateNewWordId();
    }
    return newWords;
  }

  // Get git diff to find unchanged lines
  const diff = await getFileDiff(filename, previousCommit, newCommit);
  const unchangedRanges = parseDiffToUnchangedRanges(diff);
  const previousWordMap = buildPositionToWordIdMap(previousWords);

  // Assign word IDs based on whether they're in unchanged ranges
  for (const newWord of newWords) {
    const unchangedRange = unchangedRanges.find(
      range => newWord.lineNumber >= range.newStart && newWord.lineNumber <= range.newEnd
    );

    if (unchangedRange) {
      // Word in unchanged range - try to inherit ID
      const lineOffset = newWord.lineNumber - unchangedRange.newStart;
      const oldLineNumber = unchangedRange.oldStart + lineOffset;
      const key = `${oldLineNumber}:${newWord.positionInLine}`;
      const previousWordId = previousWordMap.get(key);

      if (previousWordId) {
        const prevWord = previousWords.find(
          w => w.lineNumber === oldLineNumber && w.positionInLine === newWord.positionInLine
        );

        if (prevWord && prevWord.text === newWord.text) {
          // Text matches - inherit ID
          newWord.wordId = previousWordId;
        } else {
          // Position matches but text changed - new ID
          newWord.wordId = generateNewWordId();
        }
      } else {
        // No previous word at this position - new ID
        newWord.wordId = generateNewWordId();
      }
    } else {
      // In changed range - new word ID
      newWord.wordId = generateNewWordId();
    }
  }

  return newWords;
}

/**
 * Walk through git history and compute word IDs for all versions up to target commit
 * Results are cached in memory for instant access
 *
 * @param chapterId Chapter ID for caching
 * @param filename Path to chapter file
 * @param targetCommit SHA of commit to compute up to
 * @returns Word tokens for target commit
 */
export async function computeFromGitHistory(
  chapterId: number,
  filename: string,
  targetCommit: string
): Promise<WordToken[]> {
  // Get all commits up to target
  const allVersions = await getChapterVersions(filename);
  const targetIndex = allVersions.findIndex(v => v.commitSha === targetCommit);

  if (targetIndex === -1) {
    throw new Error(`Commit ${targetCommit} not found in file history`);
  }

  // Get commits from oldest to target (reverse order, slice to target)
  const commitsToProcess = allVersions.slice(targetIndex).reverse();

  let currentWords: WordToken[] = [];

  for (let i = 0; i < commitsToProcess.length; i++) {
    const commit = commitsToProcess[i];
    const previousCommit = i > 0 ? commitsToProcess[i - 1].commitSha : null;

    currentWords = await processCommitDiff(filename, commit.commitSha, previousCommit, currentWords);
  }

  return currentWords;
}

/**
 * Pre-compute word IDs for ALL versions of a chapter
 * This runs once when dashboard loads to enable instant version switching
 *
 * @param chapterId Chapter ID for caching
 * @param filename Path to chapter file
 * @param onProgress Optional progress callback (progress percentage 0-100)
 */
export async function preComputeAllVersions(
  chapterId: number,
  filename: string,
  onProgress?: (progress: number) => void
): Promise<void> {
  // Get all commits
  const commits = await getChapterVersions(filename);

  if (commits.length === 0) {
    console.warn(`No commits found for chapter ${chapterId} (${filename})`);
    return;
  }

  const orderedCommits = commits.reverse(); // Oldest first
  let currentWords: WordToken[] = [];
  const chapterCache = new Map<string, WordToken[]>();

  // Process each commit sequentially
  for (let i = 0; i < orderedCommits.length; i++) {
    const commit = orderedCommits[i];
    const previousCommit = i > 0 ? orderedCommits[i - 1].commitSha : null;

    currentWords = await processCommitDiff(filename, commit.commitSha, previousCommit, currentWords);

    // Cache this version (clone array to avoid mutations)
    chapterCache.set(commit.commitSha, [...currentWords]);

    // Report progress
    if (onProgress) {
      const progress = Math.round(((i + 1) / orderedCommits.length) * 100);
      onProgress(progress);
    }
  }

  // Store in global cache
  versionCache.set(chapterId.toString(), chapterCache);
  touchCache(chapterId.toString());

  console.log(`Pre-computed ${orderedCommits.length} versions for chapter ${chapterId}`);
}

/**
 * Get pre-computed word tokens for a specific version
 * Returns instantly from memory cache
 *
 * @param chapterId Chapter ID
 * @param commitSha Commit SHA
 * @returns Word tokens or null if not cached
 */
export function getComputedVersion(chapterId: number, commitSha: string): WordToken[] | null {
  const chapterIdStr = chapterId.toString();
  const chapterCache = versionCache.get(chapterIdStr);
  if (chapterCache) {
    touchCache(chapterIdStr); // Mark as recently used
  }
  return chapterCache?.get(commitSha) || null;
}

/**
 * Check if pre-computation is complete for a chapter
 *
 * @param chapterId Chapter ID
 * @returns True if all versions are cached
 */
export function isPreComputeComplete(chapterId: number): boolean {
  return versionCache.has(chapterId.toString());
}

/**
 * Clear cached versions for a chapter
 * Useful after chapter edits or for memory management
 *
 * @param chapterId Chapter ID to clear
 */
export function clearChapterCache(chapterId: number): void {
  versionCache.delete(chapterId.toString());
}

/**
 * Clear all cached versions
 * Useful for testing or when memory needs to be freed
 */
export function clearAllCaches(): void {
  versionCache.clear();
}

/**
 * Get cache statistics
 * Useful for debugging and monitoring
 *
 * @returns Cache stats
 */
export function getCacheStats(): {
  chaptersCached: number;
  totalVersions: number;
  memoryEstimateMB: number;
} {
  let totalVersions = 0;
  versionCache.forEach(chapterCache => {
    totalVersions += chapterCache.size;
  });

  // Rough estimate: 100 bytes per word token
  const avgWordsPerVersion = 5000;
  const bytesPerWord = 100;
  const memoryEstimate = totalVersions * avgWordsPerVersion * bytesPerWord;

  return {
    chaptersCached: versionCache.size,
    totalVersions,
    memoryEstimateMB: Math.round(memoryEstimate / (1024 * 1024))
  };
}
