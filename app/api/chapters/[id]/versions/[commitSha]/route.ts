import { NextResponse } from 'next/server';
import { getChapterById, getFeedbackForChapter } from '@/lib/db';
import { getFileContentAtCommit, getCommitInfo, validateCommitExists, getChapterVersions } from '@/lib/git';
import { marked } from 'marked';
import matter from 'gray-matter';
import { computeFromGitHistory } from '@/lib/words/change-tracker';

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string; commitSha: string }> }
) {
  try {
    const { id, commitSha } = await context.params;
    const chapterId = parseInt(id);

    const chapter = getChapterById(chapterId);
    if (!chapter) {
      return NextResponse.json({ error: 'Chapter not found' }, { status: 404 });
    }

    // Validate commit exists
    const commitExists = await validateCommitExists(commitSha);
    if (!commitExists) {
      return NextResponse.json({ error: 'Invalid commit SHA' }, { status: 400 });
    }

    // Get file content at this commit
    const fileContent = await getFileContentAtCommit(chapter.filename, commitSha);

    // Parse markdown with frontmatter
    const { content: rawContent, data: frontmatter } = matter(fileContent);

    // Convert to HTML
    const html = await marked(rawContent);

    // Get commit info
    const version = await getCommitInfo(commitSha);

    // Compute word IDs for this version
    const wordTokens = await computeFromGitHistory(chapterId, chapter.filename, commitSha);

    // Get all feedback for chapter
    const allFeedback = getFeedbackForChapter(chapterId);

    // Get all versions to determine commit timeline
    const allVersions = await getChapterVersions(chapter.filename);
    const commitDates = new Map(allVersions.map(v => [v.commitSha, v.date]));

    // Filter feedback valid for this version
    // Feedback is shown if:
    // 1. It has a wordId that exists in this version
    // 2. The word text matches (word hasn't changed)
    // 3. Feedback was created at or before this commit (by date)
    const validFeedback = allFeedback.filter(fb => {
      if (!fb.wordId) {
        // Old feedback without word tracking - use position matching
        return true; // Show all old feedback for backward compatibility
      }

      // Check if word exists in this version
      const word = wordTokens.find(w => w.wordId === fb.wordId);
      if (!word) return false; // Word doesn't exist

      // Check if word text matches the feedback snippet
      // (word might have changed even if ID exists)
      if (word.text !== fb.snippetText.split(/\s+/)[0]) {
        return false; // Word text changed
      }

      // Check if feedback was created at or before this commit
      if (!fb.createdAtCommit) return true; // No commit tracking, show it

      const feedbackDate = commitDates.get(fb.createdAtCommit);
      const versionDate = commitDates.get(commitSha);

      if (!feedbackDate || !versionDate) return true; // Can't determine, show it

      // Show feedback if it was created at or before this version
      return feedbackDate <= versionDate;
    });

    return NextResponse.json({
      chapter,
      version: {
        commitSha: version.sha,
        date: version.date,
        author: version.author,
        message: version.message
      },
      content: rawContent,
      html,
      feedback: validFeedback,
      wordTokens, // Include for frontend debugging if needed
    });
  } catch (error) {
    console.error('Error fetching chapter version:', error);
    return NextResponse.json({ error: 'Failed to fetch version' }, { status: 500 });
  }
}
