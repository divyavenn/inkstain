'use client';

import { useState, useMemo } from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { Feedback } from '@/types';

const Container = styled.div`
  display: grid;
  grid-template-columns: 1fr 350px;
  gap: 2rem;
  max-width: 1200px;
  margin: 0 auto;
  height: calc(100vh - 400px);
  min-height: 600px;
`;

const TextPanel = styled.div`
  overflow-y: auto;
  padding: 0 2rem;
`;

const ChapterText = styled.div`
  line-height: 1.6;
  font-size: 1.125rem;
  color: #2a2a2a;
  user-select: text;
  max-width: 42rem;

  p {
    margin-bottom: 1rem;
  }

  h1, h2, h3, h4, h5, h6 {
    margin-top: 1.5rem;
    margin-bottom: 0.75rem;
    font-weight: 600;
    color: #1a1a1a;
  }

  blockquote {
    border-left: 3px solid #e0e0e0;
    padding-left: 1.5rem;
    margin: 1rem 0;
    color: #666;
    font-style: italic;
  }

  strong {
    font-weight: 600;
  }

  em {
    font-style: italic;
  }
`;

const HighlightedText = styled.span<{ $isActive: boolean; $isHovered: boolean }>`
  background-color: ${props => {
    if (props.$isHovered) return '#bbdefb';
    if (props.$isActive) return '#e3f2fd';
    return '#fff9c4';
  }};
  padding: 2px 0;
  cursor: pointer;
  transition: background-color 0.2s ease;
  border-bottom: 2px solid ${props => props.$isHovered ? '#1976d2' : '#fbc02d'};
`;

const CommentsPanel = styled.div`
  background: white;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid #e0e0e0;
`;

const CommentsPanelHeader = styled.div`
  padding: 1.5rem;
  border-bottom: 1px solid #e0e0e0;
`;

const CommentsTitle = styled.h3`
  font-size: 1.125rem;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0;
`;

const CommentsCount = styled.span`
  color: #666;
  font-size: 0.875rem;
  font-weight: 400;
  margin-left: 0.5rem;
`;

const CommentsList = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
`;

const CommentCard = styled(motion.div)<{ $isFiltered: boolean; $isHovered: boolean }>`
  background: ${props => props.$isHovered ? '#e3f2fd' : '#f9f9f9'};
  border: 2px solid ${props => props.$isHovered ? '#1976d2' : 'transparent'};
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1rem;
  cursor: pointer;
  transition: all 0.2s ease;
  opacity: ${props => props.$isFiltered ? 1 : 0.3};

  &:hover {
    background: ${props => props.$isFiltered ? '#e3f2fd' : '#f0f0f0'};
    border-color: #1976d2;
  }
`;

const CommentSnippet = styled.div`
  background: white;
  padding: 0.75rem;
  border-radius: 6px;
  font-style: italic;
  color: #555;
  font-size: 0.875rem;
  margin-bottom: 0.75rem;
  border-left: 3px solid #1976d2;
`;

const CommentText = styled.div`
  color: #2a2a2a;
  line-height: 1.5;
  font-size: 0.9375rem;
  margin-bottom: 0.5rem;
`;

const CommentMeta = styled.div`
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  color: #999;
`;

const ReaderBadge = styled.span`
  background: #1976d2;
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-weight: 600;
`;

const ClearFilterButton = styled.button`
  margin-top: 1rem;
  padding: 0.75rem;
  background: #1976d2;
  color: white;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  width: 100%;
  transition: background 0.2s ease;

  &:hover {
    background: #1565c0;
  }
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 2rem;
  color: #999;
`;

interface CommentsViewProps {
  chapterText: string;
  feedback: Feedback[];
}

export default function CommentsView({ chapterText, feedback }: CommentsViewProps) {
  const [hoveredCommentId, setHoveredCommentId] = useState<number | null>(null);
  const [selectedRange, setSelectedRange] = useState<{ start: number; end: number } | null>(null);

  const comments = useMemo(() => {
    return feedback
      .filter(f => f.feedbackType === 'comment' && f.comment)
      .sort((a, b) => a.snippetStart - b.snippetStart);
  }, [feedback]);

  const filteredComments = useMemo(() => {
    if (!selectedRange) return comments;

    return comments.filter(comment => {
      const hasOverlap =
        (comment.snippetStart >= selectedRange.start && comment.snippetStart < selectedRange.end) ||
        (comment.snippetEnd > selectedRange.start && comment.snippetEnd <= selectedRange.end) ||
        (comment.snippetStart <= selectedRange.start && comment.snippetEnd >= selectedRange.end);

      return hasOverlap;
    });
  }, [comments, selectedRange]);

  const handleTextSelection = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      setSelectedRange(null);
      return;
    }

    const range = selection.getRangeAt(0);
    const textContent = chapterText;

    const textBefore = range.startContainer.textContent?.slice(0, range.startOffset) || '';
    const parentText = range.startContainer.parentElement?.textContent || '';

    const fullTextBefore = chapterText.slice(0, chapterText.indexOf(parentText) + textBefore.length);
    const start = fullTextBefore.length;
    const end = start + selection.toString().length;

    setSelectedRange({ start, end });
  };

  const renderTextWithHighlights = () => {
    const elements: JSX.Element[] = [];
    const ranges: Array<{ start: number; end: number; commentId: number }> = [];

    comments.forEach(comment => {
      ranges.push({
        start: comment.snippetStart,
        end: comment.snippetEnd,
        commentId: comment.id
      });
    });

    ranges.sort((a, b) => a.start - b.start);

    let lastIndex = 0;

    ranges.forEach((range, idx) => {
      if (range.start > lastIndex) {
        elements.push(
          <span key={`text-${lastIndex}`}>
            {chapterText.slice(lastIndex, range.start)}
          </span>
        );
      }

      const isHovered = hoveredCommentId === range.commentId;
      const isActive = selectedRange !== null &&
        ((range.start >= selectedRange.start && range.start < selectedRange.end) ||
         (range.end > selectedRange.start && range.end <= selectedRange.end));

      elements.push(
        <HighlightedText
          key={`highlight-${range.commentId}`}
          $isActive={isActive}
          $isHovered={isHovered}
          onMouseEnter={() => setHoveredCommentId(range.commentId)}
          onMouseLeave={() => setHoveredCommentId(null)}
        >
          {chapterText.slice(range.start, range.end)}
        </HighlightedText>
      );

      lastIndex = range.end;
    });

    if (lastIndex < chapterText.length) {
      elements.push(
        <span key={`text-${lastIndex}`}>
          {chapterText.slice(lastIndex)}
        </span>
      );
    }

    return elements;
  };

  return (
    <Container>
      <TextPanel>
        <ChapterText onMouseUp={handleTextSelection}>
          {renderTextWithHighlights()}
        </ChapterText>
      </TextPanel>

      <CommentsPanel>
        <CommentsPanelHeader>
          <CommentsTitle>
            Comments
            <CommentsCount>
              {selectedRange
                ? `${filteredComments.length} of ${comments.length}`
                : comments.length}
            </CommentsCount>
          </CommentsTitle>
        </CommentsPanelHeader>

        <CommentsList>
          {filteredComments.length === 0 ? (
            <EmptyState>
              {selectedRange
                ? 'No comments for selected text'
                : 'No comments yet'}
            </EmptyState>
          ) : (
            filteredComments.map((comment, index) => (
              <CommentCard
                key={comment.id}
                $isFiltered={!selectedRange || filteredComments.includes(comment)}
                $isHovered={hoveredCommentId === comment.id}
                onMouseEnter={() => setHoveredCommentId(comment.id)}
                onMouseLeave={() => setHoveredCommentId(null)}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <CommentSnippet>"{comment.snippetText}"</CommentSnippet>
                <CommentText>{comment.comment}</CommentText>
                <CommentMeta>
                  <ReaderBadge>Reader {comment.readerId.slice(0, 8)}</ReaderBadge>
                  <span>{new Date(comment.createdAt).toLocaleDateString()}</span>
                </CommentMeta>
              </CommentCard>
            ))
          )}

          {selectedRange && (
            <ClearFilterButton onClick={() => setSelectedRange(null)}>
              Clear Selection Filter
            </ClearFilterButton>
          )}
        </CommentsList>
      </CommentsPanel>
    </Container>
  );
}
