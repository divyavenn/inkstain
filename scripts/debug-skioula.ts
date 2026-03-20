import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import { htmlToTextContent } from '../lib/db/charPos.js';
import { feedbackWordPos } from '../lib/db/wordPos.js';

async function main() {
  const sql = neon(process.env.DATABASE_URL!);

  const [latestVer] = await sql`
    SELECT cv.id, cv.rendered_html FROM chapter_versions cv
    JOIN chapters c ON c.id = cv.chapter_id
    JOIN document_versions dv ON dv.id = cv.document_version_id
    WHERE c.file_path = 'chapter-01.md'
    ORDER BY dv.deployed_at DESC LIMIT 1
  `;

  const text = htmlToTextContent(latestVer.rendered_html);

  // Check the two null-char_start comments
  const nullRows = await sql`
    SELECT selected_text FROM feedback_comments
    WHERE chapter_version_id = ${latestVer.id} AND char_start IS NULL
  `;

  for (const row of nullRows) {
    const needle = row.selected_text as string;
    console.log('needle:', JSON.stringify(needle.slice(0, 60)));

    // Try exact search in text
    const idx = text.indexOf(needle);
    console.log('  text.indexOf:', idx);

    // Try feedbackWordPos
    const wp = feedbackWordPos(latestVer.rendered_html, needle);
    console.log('  feedbackWordPos:', wp);

    // Look for the first word in the text
    const firstWord = needle.split(/\s+/)[0];
    const wordIdx = text.indexOf(firstWord);
    console.log('  first word:', JSON.stringify(firstWord), 'found at:', wordIdx);
    if (wordIdx >= 0) {
      console.log('  text at that spot:', JSON.stringify(text.slice(wordIdx, wordIdx + 80)));
      // Show char codes around that area
      const problematic = text.slice(wordIdx, wordIdx + 30);
      const codes = [...problematic].map((c, i) => `${i}:${c.codePointAt(0)}`).join(', ');
      console.log('  char codes:', codes);
    }
    console.log('');
  }
}

main().catch(console.error);
