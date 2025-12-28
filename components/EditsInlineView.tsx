'use client';

import { useState, useMemo } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { Feedback } from '@/types';

const Container = styled.div`
  max-width: 42rem;
  margin: 0 auto;
`;

const ChapterText = styled.div`
  line-height: 2;
  font-size: 1.125rem;
  color: #2a2a2a;

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

const TextSegment = styled.span`
  position: relative;
`;

const OriginalText = styled.span<{ $hasEdit: boolean }>`
  background-color: ${props => props.$hasEdit ? '#fff3e0' : 'transparent'};
  text-decoration: ${props => props.$hasEdit ? 'line-through' : 'none'};
  text-decoration-color: #ef6c00;
  padding: 2px 0;
`;

const EditContainer = styled(motion.div)`
  display: inline-block;
  margin: 0 0.5rem;
  position: relative;
`;

const EditBox = styled.div`
  display: inline-flex;
  flex-direction: column;
  gap: 0.5rem;
  background: white;
  border: 2px solid #ff9800;
  border-radius: 8px;
  padding: 0.75rem;
  margin: 0.5rem 0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
`;

const SuggestedText = styled.div`
  color: #ef6c00;
  font-weight: 500;
  font-size: 1rem;
  padding: 0.5rem;
  background: #fff3e0;
  border-radius: 4px;
`;

const EditMeta = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.75rem;
  color: #999;
  padding: 0 0.5rem;
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 0.5rem;
`;

const Button = styled.button<{ $variant?: 'approve' | 'discard' }>`
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;

  ${props => props.$variant === 'approve' ? `
    background: #66bb6a;
    color: white;
    &:hover {
      background: #4caf50;
    }
  ` : props.$variant === 'discard' ? `
    background: #ef5350;
    color: white;
    &:hover {
      background: #e53935;
    }
  ` : `
    background: #e0e0e0;
    color: #666;
    &:hover {
      background: #d0d0d0;
    }
  `}
`;

const ReaderName = styled.span`
  font-weight: 600;
  color: #666;
`;

const EditCount = styled.div`
  background: #fff3e0;
  color: #ef6c00;
  padding: 1rem;
  border-radius: 8px;
  margin-bottom: 1.5rem;
  font-weight: 600;
  text-align: center;
`;

interface EditsInlineViewProps {
  chapterText: string;
  feedback: Feedback[];
  onApproveEdit?: (feedbackId: number) => void;
  onDiscardEdit?: (feedbackId: number) => void;
}

export default function EditsInlineView({
  chapterText,
  feedback,
  onApproveEdit,
  onDiscardEdit
}: EditsInlineViewProps) {
  const [processedEdits, setProcessedEdits] = useState<Set<number>>(new Set());

  const edits = useMemo(() => {
    return feedback
      .filter(f => f.feedbackType === 'edit' && f.suggestedEdit)
      .sort((a, b) => a.snippetStart - b.snippetStart);
  }, [feedback]);

  const handleApprove = (feedbackId: number) => {
    setProcessedEdits(prev => new Set(prev).add(feedbackId));
    onApproveEdit?.(feedbackId);
  };

  const handleDiscard = (feedbackId: number) => {
    setProcessedEdits(prev => new Set(prev).add(feedbackId));
    onDiscardEdit?.(feedbackId);
  };

  const renderTextWithEdits = () => {
    const elements: JSX.Element[] = [];
    let lastIndex = 0;

    edits.forEach((edit, idx) => {
      if (processedEdits.has(edit.id)) return;

      if (edit.snippetStart > lastIndex) {
        elements.push(
          <TextSegment key={`text-${lastIndex}`}>
            {chapterText.slice(lastIndex, edit.snippetStart)}
          </TextSegment>
        );
      }

      elements.push(
        <TextSegment key={`edit-${edit.id}`}>
          <OriginalText $hasEdit={true}>
            {edit.snippetText}
          </OriginalText>
          <EditContainer
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.2 }}
          >
            <EditBox>
              <SuggestedText>"{edit.suggestedEdit}"</SuggestedText>
              <EditMeta>
                <ReaderName>Reader {edit.readerId.slice(0, 8)}</ReaderName>
                <span>{new Date(edit.createdAt).toLocaleDateString()}</span>
              </EditMeta>
              <ButtonGroup>
                <Button
                  $variant="approve"
                  onClick={() => handleApprove(edit.id)}
                >
                  Approve
                </Button>
                <Button
                  $variant="discard"
                  onClick={() => handleDiscard(edit.id)}
                >
                  Discard
                </Button>
              </ButtonGroup>
            </EditBox>
          </EditContainer>
        </TextSegment>
      );

      lastIndex = edit.snippetEnd;
    });

    if (lastIndex < chapterText.length) {
      elements.push(
        <TextSegment key={`text-${lastIndex}`}>
          {chapterText.slice(lastIndex)}
        </TextSegment>
      );
    }

    return elements;
  };

  const pendingEditsCount = edits.filter(e => !processedEdits.has(e.id)).length;

  return (
    <Container>
      {pendingEditsCount > 0 && (
        <EditCount>
          {pendingEditsCount} suggested edit{pendingEditsCount !== 1 ? 's' : ''} pending
        </EditCount>
      )}

      <AnimatePresence>
        <ChapterText>
          {renderTextWithEdits()}
        </ChapterText>
      </AnimatePresence>
    </Container>
  );
}
