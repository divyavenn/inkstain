import Database from 'better-sqlite3';
import path from 'path';
import { Reader, Chapter, ABTest, ABTestAssignment, Feedback } from '@/types';

const dbPath = path.join(process.cwd(), 'bookbeta.db');
const db = new Database(dbPath);

// Enable WAL mode for better concurrent access
db.pragma('journal_mode = WAL');

// Initialize database schema
export function initDB() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS readers (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      name TEXT
    );

    CREATE TABLE IF NOT EXISTS chapters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      order_num INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS ab_tests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chapter_id INTEGER NOT NULL,
      passage_id TEXT NOT NULL,
      version_a TEXT NOT NULL,
      version_b TEXT NOT NULL,
      context TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (chapter_id) REFERENCES chapters(id)
    );

    CREATE TABLE IF NOT EXISTS ab_test_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ab_test_id INTEGER NOT NULL,
      reader_id TEXT NOT NULL,
      assigned_version TEXT NOT NULL CHECK(assigned_version IN ('A', 'B')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (ab_test_id) REFERENCES ab_tests(id),
      FOREIGN KEY (reader_id) REFERENCES readers(id),
      UNIQUE(ab_test_id, reader_id)
    );

    CREATE TABLE IF NOT EXISTS feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reader_id TEXT NOT NULL,
      chapter_id INTEGER NOT NULL,
      snippet_text TEXT NOT NULL,
      snippet_start INTEGER NOT NULL,
      snippet_end INTEGER NOT NULL,
      feedback_type TEXT NOT NULL CHECK(feedback_type IN ('like', 'dislike', 'comment', 'edit')),
      comment TEXT,
      suggested_edit TEXT,
      ab_test_id INTEGER,
      ab_test_version TEXT CHECK(ab_test_version IN ('A', 'B')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (reader_id) REFERENCES readers(id),
      FOREIGN KEY (chapter_id) REFERENCES chapters(id),
      FOREIGN KEY (ab_test_id) REFERENCES ab_tests(id)
    );

    CREATE INDEX IF NOT EXISTS idx_feedback_reader ON feedback(reader_id);
    CREATE INDEX IF NOT EXISTS idx_feedback_chapter ON feedback(chapter_id);
    CREATE INDEX IF NOT EXISTS idx_ab_assignments ON ab_test_assignments(ab_test_id, reader_id);
  `);
}

// Reader operations
export function createReader(id: string, name?: string): Reader {
  const stmt = db.prepare('INSERT INTO readers (id, name) VALUES (?, ?)');
  stmt.run(id, name || null);

  const reader = db.prepare('SELECT id, created_at as createdAt, name FROM readers WHERE id = ?').get(id) as Reader;
  return reader;
}

export function getReader(id: string): Reader | undefined {
  return db.prepare('SELECT id, created_at as createdAt, name FROM readers WHERE id = ?').get(id) as Reader | undefined;
}

// Chapter operations
export function getAllChapters(): Chapter[] {
  return db.prepare(`
    SELECT id, filename, title, order_num as "order", created_at as createdAt
    FROM chapters
    ORDER BY order_num
  `).all() as Chapter[];
}

export function getChapterById(id: number): Chapter | undefined {
  return db.prepare(`
    SELECT id, filename, title, order_num as "order", created_at as createdAt
    FROM chapters
    WHERE id = ?
  `).get(id) as Chapter | undefined;
}

export function upsertChapter(filename: string, title: string, order: number): Chapter {
  const existing = db.prepare('SELECT id FROM chapters WHERE filename = ?').get(filename) as { id: number } | undefined;

  if (existing) {
    db.prepare('UPDATE chapters SET title = ?, order_num = ? WHERE filename = ?').run(title, order, filename);
    return getChapterById(existing.id)!;
  } else {
    const result = db.prepare('INSERT INTO chapters (filename, title, order_num) VALUES (?, ?, ?)').run(filename, title, order);
    return getChapterById(result.lastInsertRowid as number)!;
  }
}

// A/B Test operations
export function createABTest(chapterId: number, passageId: string, versionA: string, versionB: string, context?: string): ABTest {
  const result = db.prepare(`
    INSERT INTO ab_tests (chapter_id, passage_id, version_a, version_b, context)
    VALUES (?, ?, ?, ?, ?)
  `).run(chapterId, passageId, versionA, versionB, context || null);

  return db.prepare(`
    SELECT id, chapter_id as chapterId, passage_id as passageId,
           version_a as versionA, version_b as versionB, context,
           created_at as createdAt
    FROM ab_tests WHERE id = ?
  `).get(result.lastInsertRowid) as ABTest;
}

export function getABTestsForChapter(chapterId: number): ABTest[] {
  return db.prepare(`
    SELECT id, chapter_id as chapterId, passage_id as passageId,
           version_a as versionA, version_b as versionB, context,
           created_at as createdAt
    FROM ab_tests
    WHERE chapter_id = ?
  `).all(chapterId) as ABTest[];
}

export function getOrCreateABTestAssignment(abTestId: number, readerId: string): ABTestAssignment {
  const existing = db.prepare(`
    SELECT id, ab_test_id as abTestId, reader_id as readerId,
           assigned_version as assignedVersion, created_at as createdAt
    FROM ab_test_assignments
    WHERE ab_test_id = ? AND reader_id = ?
  `).get(abTestId, readerId) as ABTestAssignment | undefined;

  if (existing) {
    return existing;
  }

  // Randomly assign version A or B
  const assignedVersion = Math.random() < 0.5 ? 'A' : 'B';
  const result = db.prepare(`
    INSERT INTO ab_test_assignments (ab_test_id, reader_id, assigned_version)
    VALUES (?, ?, ?)
  `).run(abTestId, readerId, assignedVersion);

  return db.prepare(`
    SELECT id, ab_test_id as abTestId, reader_id as readerId,
           assigned_version as assignedVersion, created_at as createdAt
    FROM ab_test_assignments
    WHERE id = ?
  `).get(result.lastInsertRowid) as ABTestAssignment;
}

// Feedback operations
export function createFeedback(
  readerId: string,
  chapterId: number,
  snippetText: string,
  snippetStart: number,
  snippetEnd: number,
  feedbackType: 'like' | 'dislike' | 'comment' | 'edit',
  comment?: string,
  suggestedEdit?: string,
  abTestId?: number,
  abTestVersion?: 'A' | 'B'
): Feedback {
  const result = db.prepare(`
    INSERT INTO feedback (
      reader_id, chapter_id, snippet_text, snippet_start, snippet_end,
      feedback_type, comment, suggested_edit, ab_test_id, ab_test_version
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    readerId, chapterId, snippetText, snippetStart, snippetEnd,
    feedbackType, comment || null, suggestedEdit || null,
    abTestId || null, abTestVersion || null
  );

  return db.prepare(`
    SELECT id, reader_id as readerId, chapter_id as chapterId,
           snippet_text as snippetText, snippet_start as snippetStart,
           snippet_end as snippetEnd, feedback_type as feedbackType,
           comment, suggested_edit as suggestedEdit,
           ab_test_id as abTestId, ab_test_version as abTestVersion,
           created_at as createdAt
    FROM feedback WHERE id = ?
  `).get(result.lastInsertRowid) as Feedback;
}

export function getAllFeedback(): Feedback[] {
  return db.prepare(`
    SELECT id, reader_id as readerId, chapter_id as chapterId,
           snippet_text as snippetText, snippet_start as snippetStart,
           snippet_end as snippetEnd, feedback_type as feedbackType,
           comment, suggested_edit as suggestedEdit,
           ab_test_id as abTestId, ab_test_version as abTestVersion,
           created_at as createdAt
    FROM feedback
    ORDER BY created_at DESC
  `).all() as Feedback[];
}

export function getFeedbackForChapter(chapterId: number): Feedback[] {
  return db.prepare(`
    SELECT id, reader_id as readerId, chapter_id as chapterId,
           snippet_text as snippetText, snippet_start as snippetStart,
           snippet_end as snippetEnd, feedback_type as feedbackType,
           comment, suggested_edit as suggestedEdit,
           ab_test_id as abTestId, ab_test_version as abTestVersion,
           created_at as createdAt
    FROM feedback
    WHERE chapter_id = ?
    ORDER BY created_at DESC
  `).all(chapterId) as Feedback[];
}

// Initialize DB on import
initDB();

export default db;
