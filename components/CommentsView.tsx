'use client';

import { useState, useMemo } from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { Feedback } from '@/types';
import ChapterText from './ChapterText';

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

const CommentsChapterText = styled(ChapterText)`
  user-select: text;
  max-width: 42rem;

  .highlighted-text {
    padding: 2px 0;
    cursor: pointer;
    transition: background-color 0.2s ease;
    border-bottom: 2px solid #fbc02d;
    background-color: #fff9c4;
  }

  .highlighted-text[data-is-edit="true"] {
    background-color: #fff3e0;
    border-bottom-color: #ff9800;
  }

  .highlighted-text[data-is-hovered="true"] {
    background-color: #bbdefb;
    border-bottom-color: #1976d2;
  }

  .highlighted-text[data-is-edit="true"][data-is-hovered="true"] {
    background-color: #fff3e0;
    border-bottom-color: #ff9800;
  }

  .highlighted-text[data-is-active="true"] {
    background-color: #e3f2fd;
  }

  .edited-text {
    background-color: #fff3e0;
    padding: 2px 0;
    border-bottom: 2px solid #ff9800;
    font-weight: 500;
    cursor: pointer;
  }
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

const CommentCard = styled(motion.div)<{ $isFiltered: boolean; $isHovered: boolean; $isEdit?: boolean }>`
  background: ${props => props.$isHovered ? (props.$isEdit ? '#fff3e0' : '#e3f2fd') : '#f9f9f9'};
  border: 2px solid ${props => props.$isHovered ? (props.$isEdit ? '#ff9800' : '#1976d2') : 'transparent'};
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1rem;
  cursor: pointer;
  transition: all 0.2s ease;
  opacity: ${props => props.$isFiltered ? 1 : 0.3};

  &:hover {
    background: ${props => props.$isFiltered ? (props.$isEdit ? '#fff3e0' : '#e3f2fd') : '#f0f0f0'};
    border-color: ${props => props.$isEdit ? '#ff9800' : '#1976d2'};
  }
`;

const CommentSnippet = styled.div<{ $isEdit?: boolean }>`
  background: white;
  padding: 0.75rem;
  border-radius: 6px;
  font-style: italic;
  color: #555;
  font-size: 0.875rem;
  margin-bottom: 0.75rem;
  border-left: 3px solid ${props => props.$isEdit ? '#ff9800' : '#1976d2'};
`;

const CommentText = styled.div`
  color: #2a2a2a;
  line-height: 1.5;
  font-size: 0.9375rem;
  margin-bottom: 0.5rem;
`;

const EditSuggestion = styled.div`
  background: white;
  padding: 0.75rem;
  border-radius: 6px;
  color: #e65100;
  font-size: 0.875rem;
  margin-bottom: 0.75rem;
  border-left: 3px solid #ff9800;
  font-weight: 500;
`;

const PreviewHint = styled.div`
  font-size: 0.75rem;
  color: #ff9800;
  font-style: italic;
  margin-bottom: 0.5rem;
  padding: 0.5rem;
  background: #fffbf0;
  border-radius: 4px;
`;

const CommentMeta = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.75rem;
  color: #999;
  gap: 0.5rem;
`;

const MetaLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const ReaderBadge = styled.span<{ $isEdit?: boolean }>`
  background: ${props => props.$isEdit ? '#ff9800' : '#1976d2'};
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-weight: 600;
`;

const ActionButtons = styled.div`
  display: flex;
  gap: 0.5rem;
`;

const ActionButton = styled.button<{ $variant: 'approve' | 'discard' }>`
  padding: 0.4rem 0.75rem;
  border: none;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;

  ${props => props.$variant === 'approve' ? `
    background: #66bb6a;
    color: white;
    &:hover {
      background: #4caf50;
    }
  ` : `
    background: #ef5350;
    color: white;
    &:hover {
      background: #e53935;
    }
  `}
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
  chapterHtml: string;
  feedback: Feedback[];
  onApproveEdit?: (feedbackId: number) => void;
  onDiscardEdit?: (feedbackId: number) => void;
}

export default function CommentsView({ chapterText, chapterHtml, feedback, onApproveEdit, onDiscardEdit }: CommentsViewProps) {
  const [hoveredCommentId, setHoveredCommentId] = useState<number | null>(null);
  const [selectedRange, setSelectedRange] = useState<{ start: number; end: number } | null>(null);
  const [hoveredEdit, setHoveredEdit] = useState<Feedback | null>(null);

  const commentsAndEdits = useMemo(() => {
    return feedback
      .filter(f => (f.feedbackType === 'comment' && f.comment) || (f.feedbackType === 'edit' && f.suggestedEdit))
      .sort((a, b) => a.snippetStart - b.snippetStart);
  }, [feedback]);

  const filteredComments = useMemo(() => {
    if (!selectedRange) return commentsAndEdits;

    return commentsAndEdits.filter(item => {
      const hasOverlap =
        (item.snippetStart >= selectedRange.start && item.snippetStart < selectedRange.end) ||
        (item.snippetEnd > selectedRange.start && item.snippetEnd <= selectedRange.end) ||
        (item.snippetStart <= selectedRange.start && item.snippetEnd >= selectedRange.end);

      return hasOverlap;
    });
  }, [commentsAndEdits, selectedRange]);


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

  const processHtmlWithHighlights = () => {
    if (typeof window === 'undefined') return chapterHtml;

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = chapterHtml;

    let charPosition = 0;

    const processNode = (node: Node): Node => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent || '';
        const fragment = document.createDocumentFragment();
        let textIndex = 0;

        // Find all ranges that overlap with this text node
        const relevantRanges = commentsAndEdits
          .filter(item => {
            const start = item.snippetStart;
            const end = item.snippetEnd;
            return (start < charPosition + text.length && end > charPosition);
          })
          .map(item => ({
            start: Math.max(0, item.snippetStart - charPosition),
            end: Math.min(text.length, item.snippetEnd - charPosition),
            item
          }));

        if (relevantRanges.length === 0) {
          charPosition += text.length;
          return node.cloneNode(true);
        }

        // Sort ranges by start position
        relevantRanges.sort((a, b) => a.start - b.start);

        relevantRanges.forEach(({ start, end, item }) => {
          // Add text before the range
          if (textIndex < start) {
            fragment.appendChild(document.createTextNode(text.slice(textIndex, start)));
          }

          const isHovered = hoveredCommentId === item.id;
          const isActive = selectedRange !== null &&
            ((charPosition + start >= selectedRange.start && charPosition + start < selectedRange.end) ||
             (charPosition + end > selectedRange.start && charPosition + end <= selectedRange.end));
          const isHoveredEdit = hoveredEdit?.id === item.id;
          const isEdit = item.feedbackType === 'edit';

          const span = document.createElement('span');
          span.className = isHoveredEdit && item.suggestedEdit ? 'edited-text' : 'highlighted-text';
          span.dataset.commentId = item.id.toString();
          span.dataset.isHovered = isHovered.toString();
          span.dataset.isActive = isActive.toString();
          span.dataset.isEdit = isEdit.toString();

          if (isHoveredEdit && item.suggestedEdit) {
            span.textContent = item.suggestedEdit;
          } else {
            span.textContent = text.slice(start, end);
          }

          fragment.appendChild(span);
          textIndex = end;
        });

        // Add remaining text
        if (textIndex < text.length) {
          fragment.appendChild(document.createTextNode(text.slice(textIndex)));
        }

        charPosition += text.length;
        return fragment;
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as Element;
        const newElement = element.cloneNode(false) as Element;

        Array.from(element.childNodes).forEach((child) => {
          newElement.appendChild(processNode(child));
        });

        return newElement;
      }

      return node.cloneNode(true);
    };

    const processed = document.createElement('div');
    Array.from(tempDiv.childNodes).forEach((child) => {
      processed.appendChild(processNode(child));
    });

    return processed.innerHTML;
  };

  const processedHtml = useMemo(() => {
    return processHtmlWithHighlights();
  }, [chapterHtml, commentsAndEdits, hoveredCommentId, selectedRange, hoveredEdit]);

  const handleMouseOver = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('highlighted-text') || target.classList.contains('edited-text')) {
      const commentId = parseInt(target.dataset.commentId || '0');
      setHoveredCommentId(commentId);
    }
  };

  const handleMouseOut = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('highlighted-text') || target.classList.contains('edited-text')) {
      setHoveredCommentId(null);
    }
  };

  return (
    <Container>
      <TextPanel>
        <CommentsChapterText
          html={processedHtml}
          onMouseUp={handleTextSelection}
          onMouseOver={handleMouseOver}
          onMouseOut={handleMouseOut}
        />
      </TextPanel>

        <CommentsPanel>
        <CommentsPanelHeader>
          <CommentsTitle>
            Comments & Edits
            <CommentsCount>
              {selectedRange
                ? `${filteredComments.length} of ${commentsAndEdits.length}`
                : commentsAndEdits.length}
            </CommentsCount>
          </CommentsTitle>
        </CommentsPanelHeader>

        <CommentsList>
          {filteredComments.length === 0 ? (
            <EmptyState>
              {selectedRange
                ? 'No comments or edits for selected text'
                : 'No comments or edits yet'}
            </EmptyState>
          ) : (
            filteredComments.map((item, index) => {
              const isEdit = item.feedbackType === 'edit';
              const isHovered = hoveredCommentId === item.id;

              return (
                <CommentCard
                  key={item.id}
                  $isFiltered={!selectedRange || filteredComments.includes(item)}
                  $isHovered={isHovered}
                  $isEdit={isEdit}
                  onMouseEnter={() => {
                    setHoveredCommentId(item.id);
                    if (isEdit) {
                      setHoveredEdit(item);
                    }
                  }}
                  onMouseLeave={() => {
                    setHoveredCommentId(null);
                    setHoveredEdit(null);
                  }}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <CommentSnippet $isEdit={isEdit}>"{item.snippetText}"</CommentSnippet>

                  {isEdit ? (
                    <>
                      <EditSuggestion>Suggested: "{item.suggestedEdit}"</EditSuggestion>
                      <PreviewHint>Hover to preview in text →</PreviewHint>
                    </>
                  ) : (
                    <CommentText>{item.comment}</CommentText>
                  )}

                  <CommentMeta>
                    <MetaLeft>
                      <ReaderBadge $isEdit={isEdit}>
                        Reader {item.readerId.slice(0, 8)}
                      </ReaderBadge>
                      <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                    </MetaLeft>
                    {isEdit && (
                      <ActionButtons>
                        <ActionButton
                          $variant="approve"
                          onClick={(e) => {
                            e.stopPropagation();
                            onApproveEdit?.(item.id);
                          }}
                        >
                          Approve
                        </ActionButton>
                        <ActionButton
                          $variant="discard"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDiscardEdit?.(item.id);
                          }}
                        >
                          Discard
                        </ActionButton>
                      </ActionButtons>
                    )}
                  </CommentMeta>
                </CommentCard>
              );
            })
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
