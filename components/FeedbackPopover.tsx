'use client';

import { useState } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';

const Popover = styled(motion.div)<{ $x: number; $y: number }>`
  position: fixed;
  left: ${props => props.$x}px;
  top: ${props => props.$y}px;
  transform: translate(1rem, -50%);
  background: white;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
  padding: 0.5rem;
  z-index: 10000;
  min-width: 280px;
  max-width: 320px;
  user-select: none;

  &::before {
    content: '';
    position: absolute;
    left: -8px;
    top: 50%;
    transform: translateY(-50%);
    width: 0;
    height: 0;
    border-top: 8px solid transparent;
    border-bottom: 8px solid transparent;
    border-right: 8px solid white;
    filter: drop-shadow(-2px 0 2px rgba(0, 0, 0, 0.05));
  }
`;

const ButtonRow = styled.div`
  display: flex;
  gap: 0.5rem;
`;

const ActionButton = styled.button<{ $variant?: 'like' | 'dislike' }>`
  padding: 0.5rem 1rem;
  border: none;
  background: ${props =>
    props.$variant === 'like' ? '#e8f5e9' :
    props.$variant === 'dislike' ? '#ffebee' :
    '#f5f5f5'};
  color: ${props =>
    props.$variant === 'like' ? '#2e7d32' :
    props.$variant === 'dislike' ? '#c62828' :
    '#1a1a1a'};
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 0.2s ease;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  &:active {
    transform: translateY(0);
  }
`;

const TextArea = styled.textarea`
  width: 100%;
  min-height: 80px;
  padding: 0.75rem;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  font-size: 0.875rem;
  font-family: inherit;
  resize: vertical;
  margin-top: 0.5rem;
  user-select: text;

  &:focus {
    outline: none;
    border-color: #1a1a1a;
  }
`;

const SubmitButton = styled.button`
  width: 100%;
  padding: 0.625rem;
  background: #1a1a1a;
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 500;
  cursor: pointer;
  margin-top: 0.5rem;
  transition: all 0.2s ease;

  &:hover {
    background: #333;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const CancelButton = styled.button`
  width: 100%;
  padding: 0.5rem;
  background: transparent;
  color: #666;
  border: none;
  border-radius: 8px;
  font-size: 0.875rem;
  cursor: pointer;
  margin-top: 0.25rem;
  transition: all 0.2s ease;

  &:hover {
    color: #1a1a1a;
    background: #f5f5f5;
  }
`;

interface FeedbackPopoverProps {
  selectedText: {
    text: string;
    start: number;
    end: number;
    x: number;
    y: number;
  };
  onSubmit: (
    type: 'like' | 'dislike' | 'comment' | 'edit',
    comment?: string,
    suggestedEdit?: string
  ) => void;
  onClose: () => void;
}

export default function FeedbackPopover({ selectedText, onSubmit, onClose }: FeedbackPopoverProps) {
  const [mode, setMode] = useState<'actions' | 'comment' | 'edit' | null>('actions');
  const [commentText, setCommentText] = useState('');
  const [editText, setEditText] = useState(selectedText.text);

  const handleQuickAction = (type: 'like' | 'dislike') => {
    onSubmit(type);
  };

  const handleCommentSubmit = () => {
    if (commentText.trim()) {
      onSubmit('comment', commentText);
    }
  };

  const handleEditSubmit = () => {
    if (editText.trim() && editText !== selectedText.text) {
      onSubmit('edit', undefined, editText);
    }
  };

  return (
    <Popover
      data-feedback-popover
      $x={selectedText.x}
      $y={selectedText.y}
      initial={{ opacity: 0, scale: 0.9, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <AnimatePresence mode="wait">
        {mode === 'actions' && (
          <motion.div
            key="actions"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <ButtonRow>
              <ActionButton
                $variant="like"
                onClick={() => handleQuickAction('like')}
              >
                👍 Like
              </ActionButton>
              <ActionButton
                $variant="dislike"
                onClick={() => handleQuickAction('dislike')}
              >
                👎 Dislike
              </ActionButton>
            </ButtonRow>
            <ButtonRow style={{ marginTop: '0.5rem' }}>
              <ActionButton onClick={() => setMode('comment')}>
                💬 Comment
              </ActionButton>
              <ActionButton onClick={() => setMode('edit')}>
                ✏️ Suggest Edit
              </ActionButton>
            </ButtonRow>
            <CancelButton onClick={onClose}>Cancel</CancelButton>
          </motion.div>
        )}

        {mode === 'comment' && (
          <motion.div
            key="comment"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <TextArea
              placeholder="What do you think about this passage?"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              autoFocus
            />
            <SubmitButton
              onClick={handleCommentSubmit}
              disabled={!commentText.trim()}
            >
              Submit Comment
            </SubmitButton>
            <CancelButton onClick={() => setMode('actions')}>Back</CancelButton>
          </motion.div>
        )}

        {mode === 'edit' && (
          <motion.div
            key="edit"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <TextArea
              placeholder="Suggest how to improve this passage..."
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              autoFocus
            />
            <SubmitButton
              onClick={handleEditSubmit}
              disabled={!editText.trim() || editText === selectedText.text}
            >
              Submit Edit
            </SubmitButton>
            <CancelButton onClick={() => setMode('actions')}>Back</CancelButton>
          </motion.div>
        )}
      </AnimatePresence>
    </Popover>
  );
}
