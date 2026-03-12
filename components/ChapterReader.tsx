'use client';

import { useState, useEffect, useRef } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import FeedbackPopover from './FeedbackPopover';
import { WordToken } from '@/types';

const PageDesktop = styled.div`
  min-height: 100vh;
  background-color: #dde3ea;
  background-image: url('/bg-texture.png');
  background-repeat: repeat;
  background-size: 400px 400px;
  background-blend-mode: multiply;
  padding: 3rem 2rem 4rem;
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const Paper = styled(motion.div)`
  background: #f5f2ea;
  border-radius: 6px;
  box-shadow:
    0 1px 3px rgba(26, 26, 24, 0.06),
    0 8px 32px rgba(26, 26, 24, 0.1);
  width: 100%;
  max-width: 720px;
  padding: 4rem 5rem;

  @media (max-width: 640px) {
    padding: 2.5rem 2rem;
  }
`;

const ChapterTitle = styled.h2`
  font-family: var(--font-playfair), Georgia, serif;
  font-size: 2.25rem;
  font-weight: 400;
  color: #1a1a18;
  margin-bottom: 2.5rem;
  line-height: 1.2;
`;

const ChapterContent = styled.div`
  font-family: var(--font-inter), system-ui, sans-serif;
  font-size: 1rem;
  line-height: 1.8;
  color: #2a2a26;
  position: relative;

  p {
    margin-bottom: 1.5rem;
  }

  h1, h2, h3, h4, h5, h6 {
    font-family: var(--font-playfair), Georgia, serif;
    font-weight: 400;
    margin-top: 2rem;
    margin-bottom: 0.75rem;
    color: #1a1a18;
  }

  blockquote {
    border-left: 2px solid rgba(26, 26, 24, 0.2);
    padding-left: 1.5rem;
    margin: 1.5rem 0;
    color: #6a6a60;
    font-style: italic;
  }

  ::selection {
    background-color: rgba(255, 225, 0, 0.35);
  }
`;

const SuccessToast = styled(motion.div)`
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  background: #1a1a18;
  color: #f2ede4;
  padding: 0.75rem 1.25rem;
  border-radius: 4px;
  box-shadow: 0 4px 20px rgba(26, 26, 24, 0.2);
  z-index: 10000;
  font-family: var(--font-inter), system-ui, sans-serif;
  font-size: 0.875rem;
`;


interface ChapterReaderProps {
  chapterId: number;
  readerId: string;
}

interface ChapterData {
  chapter: {
    id: number;
    title: string;
  };
  content: string;
  html: string;
  abTests: any[];
  assignments: Record<number, 'A' | 'B'>;
}

interface SavedFeedback {
  snippetStart: number;
  snippetEnd: number;
  type: 'like' | 'dislike' | 'comment' | 'edit';
  text: string;
}

export default function ChapterReader({ chapterId, readerId }: ChapterReaderProps) {
  const [chapterData, setChapterData] = useState<ChapterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedText, setSelectedText] = useState<{
    text: string;
    start: number;
    end: number;
    x: number;
    y: number;
  } | null>(null);
  const [savedFeedback, setSavedFeedback] = useState<SavedFeedback[]>([]);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [commitSha, setCommitSha] = useState<string>('');
  const [wordTokens, setWordTokens] = useState<WordToken[]>([]);
  const [, setLoadingTokens] = useState(false);

  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchChapter();
  }, [chapterId, readerId]);

  const fetchChapter = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/chapters/${chapterId}?readerId=${readerId}`);
      const data = await response.json();
      setChapterData(data);
      const sha = data.commitSha || '';
      setCommitSha(sha);

      if (sha) {
        fetchWordTokens(sha);
      }
    } catch (error) {
      console.error('Error fetching chapter:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchWordTokens = async (sha: string) => {
    try {
      setLoadingTokens(true);
      const response = await fetch(`/api/chapters/${chapterId}/tokens?commitSha=${sha}`);
      const data = await response.json();
      setWordTokens(data.tokens || []);
    } catch (error) {
      console.error('Error fetching word tokens:', error);
      setWordTokens([]);
    } finally {
      setLoadingTokens(false);
    }
  };

  const handleTextSelection = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-feedback-popover]')) {
      return;
    }

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !contentRef.current) {
      setSelectedText(null);
      return;
    }

    const text = selection.toString().trim();
    if (!text) {
      setSelectedText(null);
      return;
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    const getTextPosition = (node: Node, targetNode: Node, targetOffset: number): number => {
      let position = 0;

      const walk = (current: Node): boolean => {
        if (current === targetNode) {
          position += targetOffset;
          return true;
        }

        if (current.nodeType === Node.TEXT_NODE) {
          if (current === targetNode) {
            position += targetOffset;
            return true;
          }
          position += (current.textContent || '').length;
        } else if (current.nodeType === Node.ELEMENT_NODE) {
          for (const child of Array.from(current.childNodes)) {
            if (walk(child)) {
              return true;
            }
          }
        }

        return false;
      };

      walk(node);
      return position;
    };

    const start = getTextPosition(contentRef.current, range.startContainer, range.startOffset);
    const end = getTextPosition(contentRef.current, range.endContainer, range.endOffset);

    setSelectedText({
      text,
      start,
      end,
      x: rect.right,
      y: rect.top + window.scrollY + (rect.height / 2),
    });
  };

  useEffect(() => {
    const handler = (e: Event) => handleTextSelection(e as MouseEvent);
    document.addEventListener('mouseup', handler);
    return () => {
      document.removeEventListener('mouseup', handler);
    };
  }, []);

  const showToast = (message: string) => {
    setToastMessage(message);
    setShowSuccessToast(true);
    setTimeout(() => setShowSuccessToast(false), 3000);
  };

  const handleFeedbackSubmit = async (
    type: 'like' | 'dislike' | 'comment' | 'edit',
    comment?: string,
    suggestedEdit?: string
  ) => {
    if (!selectedText || !chapterData) return;

    let wordId: string | undefined;
    if (wordTokens.length > 0) {
      const firstWord = wordTokens.find(token =>
        (token.charStart >= selectedText.start && token.charStart < selectedText.end) ||
        (token.charEnd > selectedText.start && token.charEnd <= selectedText.end) ||
        (token.charStart <= selectedText.start && token.charEnd >= selectedText.end)
      );
      wordId = firstWord?.wordId;
    }

    if (!wordId) {
      console.warn('No word ID found for selection - feedback may not track across versions');
    }

    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          readerId,
          chapterId: chapterData.chapter.id,
          snippetText: selectedText.text,
          snippetStart: selectedText.start,
          snippetEnd: selectedText.end,
          feedbackType: type,
          createdAtCommit: commitSha,
          wordId: wordId,
          comment,
          suggestedEdit,
        }),
      });

      if (response.ok) {
        setSavedFeedback(prev => [...prev, {
          snippetStart: selectedText.start,
          snippetEnd: selectedText.end,
          type,
          text: selectedText.text,
        }]);

        const messages = {
          like: 'Liked',
          dislike: 'Noted',
          comment: 'Comment saved',
          edit: 'Edit suggestion saved',
        };
        showToast(messages[type]);
      } else {
        showToast('Failed to save feedback');
      }

      setSelectedText(null);
      window.getSelection()?.removeAllRanges();
    } catch (error) {
      console.error('Error submitting feedback:', error);
      showToast('Failed to save feedback');
    }
  };

  const renderContentWithHighlights = () => {
    if (!chapterData || savedFeedback.length === 0) {
      return <div dangerouslySetInnerHTML={{ __html: chapterData?.html || '' }} />;
    }

    const plainText = contentRef.current?.innerText || chapterData.content;
    const sortedFeedback = [...savedFeedback].sort((a, b) => a.snippetStart - b.snippetStart);

    let result = plainText;
    let offset = 0;

    sortedFeedback.forEach(fb => {
      const start = fb.snippetStart + offset;
      const end = fb.snippetEnd + offset;
      const highlightedText = `<mark class="highlight-${fb.type}" data-type="${fb.type}">${result.substring(start, end)}</mark>`;
      result = result.substring(0, start) + highlightedText + result.substring(end);
      offset += highlightedText.length - (end - start);
    });

    return <div dangerouslySetInnerHTML={{ __html: result.replace(/\n/g, '<br/>') }} />;
  };

  if (loading) {
    return (
      <PageDesktop>
        <Paper initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <p style={{ fontFamily: 'var(--font-inter), system-ui, sans-serif', color: '#9a9892', fontSize: '0.9rem' }}>
            Loading chapter...
          </p>
        </Paper>
      </PageDesktop>
    );
  }

  if (!chapterData) {
    return (
      <PageDesktop>
        <Paper initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <p style={{ fontFamily: 'var(--font-inter), system-ui, sans-serif', color: '#9a9892', fontSize: '0.9rem' }}>
            Chapter not found
          </p>
        </Paper>
      </PageDesktop>
    );
  }

  return (
    <>
      <PageDesktop>
        <Paper
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
        >
          <ChapterTitle>{chapterData.chapter.title}</ChapterTitle>
          <ChapterContent ref={contentRef}>
            {savedFeedback.length === 0 ? (
              <div dangerouslySetInnerHTML={{ __html: chapterData.html }} />
            ) : (
              renderContentWithHighlights()
            )}
          </ChapterContent>
        </Paper>
      </PageDesktop>

      {selectedText && (
        <FeedbackPopover
          selectedText={selectedText}
          onSubmit={handleFeedbackSubmit}
          onClose={() => setSelectedText(null)}
        />
      )}

      <AnimatePresence>
        {showSuccessToast && (
          <SuccessToast
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
          >
            {toastMessage}
          </SuccessToast>
        )}
      </AnimatePresence>

      <style jsx global>{`
        .highlight-like {
          margin: 0 -0.4em;
          padding: 0.1em 0.4em;
          border-radius: 0.8em 0.3em;
          background: transparent;
          background-image: linear-gradient(to right, rgba(34,197,94,0.1), rgba(34,197,94,0.55) 4%, rgba(34,197,94,0.25));
          cursor: pointer;
          -webkit-box-decoration-break: clone;
          box-decoration-break: clone;
          transition: filter 0.15s ease;
        }
        .highlight-like:hover { filter: brightness(0.88); }

        .highlight-dislike {
          margin: 0 -0.4em;
          padding: 0.1em 0.4em;
          border-radius: 0.8em 0.3em;
          background: transparent;
          background-image: linear-gradient(to right, rgba(239,68,68,0.1), rgba(239,68,68,0.55) 4%, rgba(239,68,68,0.25));
          cursor: pointer;
          -webkit-box-decoration-break: clone;
          box-decoration-break: clone;
          transition: filter 0.15s ease;
        }
        .highlight-dislike:hover { filter: brightness(0.88); }

        .highlight-comment {
          margin: 0 -0.4em;
          padding: 0.1em 0.4em;
          border-radius: 0.8em 0.3em;
          background: transparent;
          background-image: linear-gradient(to right, rgba(99,102,241,0.1), rgba(99,102,241,0.55) 4%, rgba(99,102,241,0.25));
          cursor: pointer;
          -webkit-box-decoration-break: clone;
          box-decoration-break: clone;
          transition: filter 0.15s ease;
        }
        .highlight-comment:hover { filter: brightness(0.88); }

        .highlight-edit {
          margin: 0 -0.4em;
          padding: 0.1em 0.4em;
          border-radius: 0.8em 0.3em;
          background: transparent;
          background-image: linear-gradient(to right, rgba(245,158,11,0.1), rgba(245,158,11,0.55) 4%, rgba(245,158,11,0.25));
          cursor: pointer;
          -webkit-box-decoration-break: clone;
          box-decoration-break: clone;
          transition: filter 0.15s ease;
        }
        .highlight-edit:hover { filter: brightness(0.88); }
      `}</style>
    </>
  );
}
