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
    margin: 0 -0.4em;
    padding: 0.1em 0.4em;
    border-radius: 0.8em 0.3em;
    background: transparent;
    background-image: linear-gradient(to right, rgba(255,225,0,0.1), rgba(255,225,0,0.7) 4%, rgba(255,225,0,0.3));
    cursor: pointer;
    -webkit-box-decoration-break: clone;
    box-decoration-break: clone;
    transition: filter 0.15s ease;
  }

  .highlighted-text[data-is-edit="true"] {
    background-image: linear-gradient(to right, rgba(245,158,11,0.1), rgba(245,158,11,0.7) 4%, rgba(245,158,11,0.3));
  }

  .highlighted-text[data-is-hovered="true"] {
    background-image: linear-gradient(to right, rgba(99,102,241,0.1), rgba(99,102,241,0.7) 4%, rgba(99,102,241,0.3));
  }

  .highlighted-text[data-is-edit="true"][data-is-hovered="true"] {
    background-image: linear-gradient(to right, rgba(245,158,11,0.15), rgba(245,158,11,0.8) 4%, rgba(245,158,11,0.4));
    filter: brightness(0.95);
  }

  .highlighted-text[data-is-active="true"] {
    filter: brightness(0.92);
  }

  .edited-text {
    margin: 0 -0.4em;
    padding: 0.1em 0.4em;
    border-radius: 0.8em 0.3em;
    background: transparent;
    background-image: linear-gradient(to right, rgba(245,158,11,0.1), rgba(245,158,11,0.65) 4%, rgba(245,158,11,0.3));
    font-weight: 500;
    cursor: pointer;
    -webkit-box-decoration-break: clone;
    box-decoration-break: clone;
  }
`;

const CommentsPanel = styled.div`
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-left: 1px solid rgba(26,26,24,0.07);
  background: rgba(26,26,24,0.015);
`;

const CommentsPanelHeader = styled.div`
  padding: 1.25rem 1.25rem 0.75rem;
  border-bottom: 1px solid rgba(26,26,24,0.06);
`;

const CommentsTitle = styled.h3`
  font-family: var(--font-inter), system-ui, sans-serif;
  font-size: 0.65rem;
  font-weight: 500;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(26,26,24,0.35);
  margin: 0;
`;

const CommentsCount = styled.span`
  color: rgba(26,26,24,0.35);
  font-size: 0.65rem;
  font-weight: 400;
  margin-left: 0.4rem;
`;

const CommentsList = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 0;
`;

const CommentCard = styled(motion.div)<{ $isFiltered: boolean; $isHovered: boolean; $isEdit?: boolean }>`
  padding: 1.1rem 1.25rem;
  border-bottom: 1px solid rgba(26,26,24,0.055);
  cursor: pointer;
  transition: background 0.15s ease;
  opacity: ${props => props.$isFiltered ? 1 : 0.3};
  background: ${props => props.$isHovered ? 'rgba(26,26,24,0.035)' : 'transparent'};
  border-left: 2px solid ${props => props.$isHovered
    ? (props.$isEdit ? 'rgba(185,120,40,0.6)' : 'rgba(80,100,200,0.45)')
    : 'transparent'};
  &:hover { background: rgba(26,26,24,0.025); }
`;

const CommentSnippet = styled.div<{ $isEdit?: boolean }>`
  font-family: var(--font-playfair), Georgia, serif;
  font-style: italic;
  font-size: 0.82rem;
  color: rgba(26,26,24,0.55);
  margin-bottom: 0.5rem;
  line-height: 1.5;
`;

const CommentText = styled.div`
  font-family: var(--font-inter), system-ui, sans-serif;
  font-size: 0.85rem;
  color: #1a1a18;
  line-height: 1.55;
  margin-bottom: 0.5rem;
`;

const EditSuggestion = styled.div`
  font-family: var(--font-inter), system-ui, sans-serif;
  font-size: 0.82rem;
  color: rgba(26,26,24,0.7);
  margin-bottom: 0.5rem;
  line-height: 1.5;
  border-left: 2px solid rgba(185,120,40,0.5);
  padding-left: 0.75rem;
`;

const PreviewHint = styled.div`
  font-size: 0.7rem;
  color: rgba(180,120,40,0.7);
  font-style: italic;
  margin-bottom: 0.4rem;
`;

const CommentMeta = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-family: var(--font-inter), system-ui, sans-serif;
  font-size: 0.68rem;
  color: rgba(26,26,24,0.32);
  gap: 0.5rem;
  margin-top: 0.25rem;
`;

const MetaLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const ReaderBadge = styled.span<{ $isEdit?: boolean }>`
  font-family: var(--font-inter), system-ui, sans-serif;
  font-size: 0.68rem;
  color: rgba(26,26,24,0.45);
  font-weight: 500;
  letter-spacing: 0.02em;
`;

const ActionButtons = styled.div`
  display: flex;
  gap: 0.5rem;
`;

const ActionButton = styled.button<{ $variant: 'approve' | 'discard' }>`
  padding: 0.3rem 0.65rem;
  border: 1px solid ${props => props.$variant === 'approve' ? 'rgba(60,140,70,0.4)' : 'rgba(180,60,60,0.4)'};
  border-radius: 3px;
  font-family: var(--font-inter), system-ui, sans-serif;
  font-size: 0.68rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  background: transparent;
  color: ${props => props.$variant === 'approve' ? 'rgba(40,120,50,0.75)' : 'rgba(160,50,50,0.75)'};
  &:hover {
    background: ${props => props.$variant === 'approve' ? 'rgba(60,140,70,0.08)' : 'rgba(180,60,60,0.08)'};
    border-color: ${props => props.$variant === 'approve' ? 'rgba(60,140,70,0.7)' : 'rgba(180,60,60,0.7)'};
    color: ${props => props.$variant === 'approve' ? 'rgba(30,100,40,0.9)' : 'rgba(150,40,40,0.9)'};
  }
`;

const ClearFilterButton = styled.button`
  margin: 0.75rem 1.25rem;
  padding: 0.55rem 1rem;
  background: transparent;
  color: rgba(26,26,24,0.5);
  border: 1px solid rgba(26,26,24,0.2);
  border-radius: 3px;
  font-family: var(--font-inter), system-ui, sans-serif;
  font-size: 0.75rem;
  font-weight: 400;
  cursor: pointer;
  width: calc(100% - 2.5rem);
  transition: all 0.15s ease;
  &:hover {
    background: rgba(26,26,24,0.04);
    border-color: rgba(26,26,24,0.35);
    color: rgba(26,26,24,0.7);
  }
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 3rem 1.5rem;
  color: rgba(26,26,24,0.3);
  font-family: var(--font-inter), system-ui, sans-serif;
  font-size: 0.82rem;
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

    // Build plain text from the DOM (same traversal order as charPosition below)
    const plainText = tempDiv.textContent || '';

    // Re-locate each snippet by searching for its text in the current content,
    // using the stored position as a hint so duplicates resolve to the right one.
    const locatedRanges = commentsAndEdits.map(item => {
      const snippet = item.snippetText;
      if (!snippet) return null;
      // Search near the original position first, then from the beginning
      let idx = plainText.indexOf(snippet, Math.max(0, item.snippetStart - 200));
      if (idx === -1) idx = plainText.indexOf(snippet);
      if (idx === -1) return null;
      return { item, start: idx, end: idx + snippet.length };
    }).filter((r): r is { item: Feedback; start: number; end: number } => r !== null);

    let charPosition = 0;

    const processNode = (node: Node): Node => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent || '';
        const fragment = document.createDocumentFragment();
        let textIndex = 0;

        // Find all ranges that overlap with this text node
        const relevantRanges = locatedRanges
          .filter(({ start, end }) => {
            return (start < charPosition + text.length && end > charPosition);
          })
          .map(({ start, end, item }) => ({
            start: Math.max(0, start - charPosition),
            end: Math.min(text.length, end - charPosition),
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
