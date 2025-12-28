'use client';

import { useState, useEffect, useRef } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import FeedbackPopover from './FeedbackPopover';

const ReaderContainer = styled(motion.div)`
  max-width: 42rem;
  margin: 0 auto;
  padding: 4rem 2rem;
`;

const ChapterTitle = styled.h2`
  font-size: 2.5rem;
  font-weight: 700;
  color: #1a1a1a;
  margin-bottom: 3rem;
  line-height: 1.2;
`;

const ChapterContent = styled.div`
  font-size: 1.125rem;
  line-height: 1.8;
  color: #2a2a2a;
  position: relative;

  p {
    margin-bottom: 1.5rem;
  }

  h1, h2, h3, h4, h5, h6 {
    margin-top: 2rem;
    margin-bottom: 1rem;
    font-weight: 600;
    color: #1a1a1a;
  }

  blockquote {
    border-left: 3px solid #e0e0e0;
    padding-left: 1.5rem;
    margin: 1.5rem 0;
    color: #666;
    font-style: italic;
  }

  ::selection {
    background-color: #ffe066;
  }
`;

const SuccessToast = styled(motion.div)`
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  background: #2e7d32;
  color: white;
  padding: 1rem 1.5rem;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 10000;
  font-weight: 500;
`;

const HighlightOverlay = styled.mark<{ $type: 'like' | 'dislike' | 'comment' | 'edit' }>`
  background: ${props => {
    switch (props.$type) {
      case 'like': return 'rgba(46, 125, 50, 0.2)';
      case 'dislike': return 'rgba(198, 40, 40, 0.2)';
      case 'comment': return 'rgba(21, 101, 192, 0.2)';
      case 'edit': return 'rgba(239, 108, 0, 0.2)';
      default: return 'rgba(255, 224, 102, 0.3)';
    }
  }};
  cursor: pointer;
  border-radius: 2px;
  transition: background 0.2s ease;

  &:hover {
    background: ${props => {
      switch (props.$type) {
        case 'like': return 'rgba(46, 125, 50, 0.3)';
        case 'dislike': return 'rgba(198, 40, 40, 0.3)';
        case 'comment': return 'rgba(21, 101, 192, 0.3)';
        case 'edit': return 'rgba(239, 108, 0, 0.3)';
        default: return 'rgba(255, 224, 102, 0.4)';
      }
    }};
  }
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
    } catch (error) {
      console.error('Error fetching chapter:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTextSelection = (e: MouseEvent) => {
    // Don't close popover if clicking inside it
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

    // Get selection position
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    // Calculate character offset in the content
    const contentText = contentRef.current.innerText;
    const beforeSelection = contentText.indexOf(text);

    if (beforeSelection !== -1) {
      // Position to the right side of selection, vertically centered
      setSelectedText({
        text,
        start: beforeSelection,
        end: beforeSelection + text.length,
        x: rect.right,
        y: rect.top + window.scrollY + (rect.height / 2),
      });
    }
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
          comment,
          suggestedEdit,
        }),
      });

      if (response.ok) {
        // Save feedback to local state for highlighting
        setSavedFeedback(prev => [...prev, {
          snippetStart: selectedText.start,
          snippetEnd: selectedText.end,
          type,
          text: selectedText.text,
        }]);

        // Show success message
        const messages = {
          like: '👍 Liked!',
          dislike: '👎 Noted',
          comment: '💬 Comment saved!',
          edit: '✏️ Edit suggestion saved!',
        };
        showToast(messages[type]);
      } else {
        showToast('❌ Failed to save feedback');
      }

      setSelectedText(null);
      window.getSelection()?.removeAllRanges();
    } catch (error) {
      console.error('Error submitting feedback:', error);
      showToast('❌ Failed to save feedback');
    }
  };

  const renderContentWithHighlights = () => {
    if (!chapterData || savedFeedback.length === 0) {
      return <div dangerouslySetInnerHTML={{ __html: chapterData?.html || '' }} />;
    }

    const plainText = contentRef.current?.innerText || chapterData.content;

    // Sort feedback by start position
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
      <ReaderContainer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <p>Loading chapter...</p>
      </ReaderContainer>
    );
  }

  if (!chapterData) {
    return (
      <ReaderContainer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <p>Chapter not found</p>
      </ReaderContainer>
    );
  }

  return (
    <>
      <ReaderContainer
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3 }}
      >
        <ChapterTitle>{chapterData.chapter.title}</ChapterTitle>
        <ChapterContent ref={contentRef}>
          {savedFeedback.length === 0 ? (
            <div dangerouslySetInnerHTML={{ __html: chapterData.html }} />
          ) : (
            renderContentWithHighlights()
          )}
        </ChapterContent>
      </ReaderContainer>

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
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
          >
            {toastMessage}
          </SuccessToast>
        )}
      </AnimatePresence>

      <style jsx global>{`
        .highlight-like {
          background: rgba(46, 125, 50, 0.2);
          border-radius: 2px;
          cursor: pointer;
          transition: background 0.2s ease;
        }
        .highlight-like:hover {
          background: rgba(46, 125, 50, 0.3);
        }
        .highlight-dislike {
          background: rgba(198, 40, 40, 0.2);
          border-radius: 2px;
          cursor: pointer;
          transition: background 0.2s ease;
        }
        .highlight-dislike:hover {
          background: rgba(198, 40, 40, 0.3);
        }
        .highlight-comment {
          background: rgba(21, 101, 192, 0.2);
          border-radius: 2px;
          cursor: pointer;
          transition: background 0.2s ease;
        }
        .highlight-comment:hover {
          background: rgba(21, 101, 192, 0.3);
        }
        .highlight-edit {
          background: rgba(239, 108, 0, 0.2);
          border-radius: 2px;
          cursor: pointer;
          transition: background 0.2s ease;
        }
        .highlight-edit:hover {
          background: rgba(239, 108, 0, 0.3);
        }
      `}</style>
    </>
  );
}
