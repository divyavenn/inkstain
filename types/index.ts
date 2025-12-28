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
  snippetText: string;
  snippetStart: number; // character offset in the chapter
  snippetEnd: number;
  feedbackType: 'like' | 'dislike' | 'comment' | 'edit';
  comment?: string;
  suggestedEdit?: string;
  abTestId?: number; // if feedback is related to an A/B test
  abTestVersion?: 'A' | 'B';
  createdAt: string;
}

export interface ReaderSession {
  readerId: string;
  readerName?: string;
  token: string;
}
