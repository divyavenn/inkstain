import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('DATABASE_URL is not set'); process.exit(1); }

const sql = neon(DATABASE_URL);

async function main() {
  await sql`ALTER TABLE feedback_comments ADD COLUMN IF NOT EXISTS char_start int`;
  await sql`ALTER TABLE feedback_comments ADD COLUMN IF NOT EXISTS char_length int`;
  await sql`ALTER TABLE feedback_comments ADD COLUMN IF NOT EXISTS selected_text text`;
  await sql`ALTER TABLE suggested_edits ADD COLUMN IF NOT EXISTS char_start int`;
  await sql`ALTER TABLE suggested_edits ADD COLUMN IF NOT EXISTS char_length int`;
  console.log('✓ columns added');
}

main().catch(err => { console.error(err); process.exit(1); });
