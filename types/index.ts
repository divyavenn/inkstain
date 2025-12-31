export interface Reader {
  id: string;
  createdAt: string;
  name?: string;
}

export interface Chapter {
  id: number;
  filename: string;
  title: string;
  order: number;
  createdAt: string;
}

export interface ABTest {
  id: number;
  chapterId: number;
  passageId: string; // unique identifier for the passage being tested
  versionA: string;
  versionB: string;
  context?: string; // surrounding text for context
  createdAt: string;
}

export interface ABTestAssignment {
  id: number;
  abTestId: number;
  readerId: string;
  assignedVersion: 'A' | 'B';
  createdAt: string;
}

export interface Feedback {
  id: number;
  readerId: string;
  chapterId: number;
  wordId?: string; // ADDED: Link to word token for version tracking
  snippetText: string;
  snippetStart: number; // character offset in the chapter (kept for backward compatibility)
  snippetEnd: number;
  feedbackType: 'like' | 'dislike' | 'comment' | 'edit';
  comment?: string;
  suggestedEdit?: string;
  createdAtCommit?: string; // ADDED: Commit SHA when feedback was created
  abTestId?: number; // if feedback is related to an A/B test
  abTestVersion?: 'A' | 'B';
  createdAt: string;
}

export interface ReaderSession {
  readerId: string;
  readerName?: string;
  token: string;
}

// Word-level tracking for version control
export interface WordToken {
  wordId: string; // Persistent ID (e.g., "w1", "w2", "w3")
  text: string; // The actual word
  lineNumber: number; // 1-based line number (git convention)
  positionInLine: number; // 0-based position within line
  charStart: number; // Character offset (for display/highlighting)
  charEnd: number; // Character offset end
}

// Git diff parsing
export interface UnchangedRange {
  oldStart: number;
  oldEnd: number;
  newStart: number;
  newEnd: number;
}

// Git version information
export interface GitVersion {
  commitSha: string; // Full SHA hash
  commitShortSha: string; // First 7 chars
  authorName: string;
  authorEmail: string;
  date: Date;
  message: string;
}

// Commit metadata
export interface CommitInfo {
  sha: string;
  shortSha: string;
  author: string;
  date: Date;
  message: string;
}
