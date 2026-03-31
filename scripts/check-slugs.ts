import { config } from 'dotenv';
config({ path: '.env.local' });

import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  // Find the 3 most recent document versions
  const recent = await sql`
    SELECT id, commit_sha, commit_message, deployed_at
    FROM document_versions
    ORDER BY deployed_at DESC
    LIMIT 3
  `;
  console.log('Deleting these versions:');
  for (const r of recent) {
    console.log(`  ${(r.commit_sha as string).slice(0, 8)} — ${r.commit_message} (${r.deployed_at})`);
  }

  const dvIds = recent.map(r => r.id as string);

  // Get chapter_version ids for these document versions
  const cvRows = await sql`
    SELECT id FROM chapter_versions WHERE document_version_id = ANY(${dvIds}::uuid[])
  `;
  const cvIds = cvRows.map(r => r.id as string);

  if (cvIds.length > 0) {
    // Delete leaf tables referencing chapter_versions
    await sql`DELETE FROM feedback_reactions WHERE chapter_version_id = ANY(${cvIds}::uuid[])`;
    await sql`DELETE FROM feedback_comments WHERE chapter_version_id = ANY(${cvIds}::uuid[])`;
    await sql`DELETE FROM suggested_edits WHERE chapter_version_id = ANY(${cvIds}::uuid[])`;
    await sql`DELETE FROM chapter_reads WHERE chapter_version_id = ANY(${cvIds}::uuid[])`;
    await sql`DELETE FROM event_log WHERE chapter_version_id = ANY(${cvIds}::uuid[])`;
    await sql`DELETE FROM interest_signups WHERE chapter_version_id = ANY(${cvIds}::uuid[])`;
    await sql`DELETE FROM chapter_diffs WHERE chapter_version_id = ANY(${cvIds}::uuid[])`;
    await sql`DELETE FROM chapter_diffs WHERE previous_chapter_version_id = ANY(${cvIds}::uuid[])`;
    await sql`DELETE FROM chapter_version_lines WHERE chapter_version_id = ANY(${cvIds}::uuid[])`;
    await sql`DELETE FROM chapter_versions WHERE id = ANY(${cvIds}::uuid[])`;
    console.log(`Deleted ${cvIds.length} chapter versions and associated feedback`);
  }

  // Delete the document versions themselves
  await sql`DELETE FROM document_versions WHERE id = ANY(${dvIds}::uuid[])`;
  console.log(`Deleted ${dvIds.length} document versions`);

  // Verify
  const remaining = await sql`SELECT count(*) as n FROM document_versions`;
  console.log(`\nRemaining document versions: ${remaining[0].n}`);
}

main().catch(console.error);
