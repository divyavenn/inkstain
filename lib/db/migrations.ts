import { getDb } from './index';
import { getAllChapters } from './index';
import { getCurrentCommitForFile } from '@/lib/git';
import { computeFromGitHistory } from '@/lib/words/change-tracker';
import { getWordAtPosition } from '@/lib/words/tokenizer';

/**
 * Migration tracking table
 */
export function initMigrationsTable() {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

/**
 * Check if a migration has been applied
 */
export function isMigrationApplied(name: string): boolean {
  const db = getDb();
  const result = db.prepare('SELECT id FROM migrations WHERE name = ?').get(name);
  return result !== undefined;
}

/**
 * Mark a migration as applied
 */
export function markMigrationApplied(name: string): void {
  const db = getDb();
  db.prepare('INSERT INTO migrations (name) VALUES (?)').run(name);
}

/**
 * Migration: Populate word IDs for existing feedback
 * This migration:
 * 1. Gets current commit for each chapter
 * 2. Computes word tokens for current version
 * 3. Matches existing feedback positions to word IDs
 * 4. Updates feedback with word IDs and commit SHA
 */
export async function migrateExistingFeedback(): Promise<void> {
  const migrationName = '001_populate_word_ids';

  if (isMigrationApplied(migrationName)) {
    console.log('Migration already applied:', migrationName);
    return;
  }

  console.log('Starting migration:', migrationName);

  const db = getDb();
  const chapters = getAllChapters();

  for (const chapter of chapters) {
    console.log(`Migrating feedback for chapter: ${chapter.title}`);

    try {
      // Get current commit for this chapter
      let currentCommit: string;
      try {
        currentCommit = await getCurrentCommitForFile(chapter.filename);
      } catch (error) {
        console.warn(`No git commit for ${chapter.filename}, skipping...`);
        continue;
      }

      // Compute word tokens for current version
      const wordTokens = await computeFromGitHistory(
        chapter.id,
        chapter.filename,
        currentCommit
      );

      // Get all feedback for this chapter without word IDs
      const feedbackToMigrate = db.prepare(`
        SELECT id, snippet_start, snippet_end, snippet_text
        FROM feedback
        WHERE chapter_id = ? AND (word_id IS NULL OR word_id = '')
      `).all(chapter.id) as Array<{
        id: number;
        snippet_start: number;
        snippet_end: number;
        snippet_text: string;
      }>;

      console.log(`  Found ${feedbackToMigrate.length} feedback items to migrate`);

      // Update each feedback with word ID
      for (const fb of feedbackToMigrate) {
        // Find word at the start position of the feedback
        const word = getWordAtPosition(wordTokens, fb.snippet_start);

        if (word) {
          // Update feedback with word ID and commit
          db.prepare(`
            UPDATE feedback
            SET word_id = ?, created_at_commit = ?
            WHERE id = ?
          `).run(word.wordId, currentCommit, fb.id);
        } else {
          console.warn(`  Could not find word for feedback ${fb.id} at position ${fb.snippet_start}`);
        }
      }

      console.log(`  Migrated ${feedbackToMigrate.length} feedback items`);
    } catch (error) {
      console.error(`Error migrating chapter ${chapter.id}:`, error);
      // Continue with next chapter
    }
  }

  // Mark migration as complete
  markMigrationApplied(migrationName);
  console.log('Migration complete:', migrationName);
}

/**
 * Run all pending migrations
 */
export async function runMigrations(): Promise<void> {
  initMigrationsTable();

  console.log('Running database migrations...');

  try {
    await migrateExistingFeedback();
    console.log('All migrations complete');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}
