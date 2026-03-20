import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('DATABASE_URL is not set'); process.exit(1); }

const sql = neon(DATABASE_URL);

async function main() {
  await sql`ALTER TABLE chapter_diffs ADD COLUMN IF NOT EXISTS word_map int[]`;
  await sql`ALTER TABLE chapter_diffs ALTER COLUMN diff_json DROP NOT NULL`;
  await sql`ALTER TABLE feedback_comments ADD COLUMN IF NOT EXISTS word_start int`;
  await sql`ALTER TABLE feedback_comments ADD COLUMN IF NOT EXISTS word_end int`;
  await sql`ALTER TABLE suggested_edits ADD COLUMN IF NOT EXISTS word_start int`;
  await sql`ALTER TABLE suggested_edits ADD COLUMN IF NOT EXISTS word_end int`;
  console.log('✓ word position columns added');
}

main().catch(err => { console.error(err); process.exit(1); });
