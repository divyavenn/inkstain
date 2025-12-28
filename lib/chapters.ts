import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { marked } from 'marked';

const chaptersDirectory = path.join(process.cwd(), 'chapters');

export interface ChapterMetadata {
  title: string;
  order: number;
  [key: string]: any;
}

export interface ChapterData {
  filename: string;
  metadata: ChapterMetadata;
  content: string;
  html: string;
}

export function getChapterFiles(): string[] {
  try {
    const files = fs.readdirSync(chaptersDirectory);
    return files.filter(file => file.endsWith('.md'));
  } catch (error) {
    return [];
  }
}

export function getChapterData(filename: string): ChapterData | null {
  try {
    const fullPath = path.join(chaptersDirectory, filename);
    const fileContents = fs.readFileSync(fullPath, 'utf8');

    const { data, content } = matter(fileContents);

    // Parse markdown to HTML
    const html = marked.parse(content) as string;

    return {
      filename,
      metadata: {
        title: data.title || filename.replace('.md', ''),
        order: data.order || 0,
        ...data,
      },
      content,
      html,
    };
  } catch (error) {
    console.error(`Error reading chapter ${filename}:`, error);
    return null;
  }
}

export function getAllChapters(): ChapterData[] {
  const files = getChapterFiles();
  const chapters = files
    .map(getChapterData)
    .filter((chapter): chapter is ChapterData => chapter !== null);

  // Sort by order
  chapters.sort((a, b) => a.metadata.order - b.metadata.order);

  return chapters;
}
