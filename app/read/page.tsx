'use client';

import { useEffect, useState } from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import ReaderView from '@/components/ReaderView';

const Page = styled.div`
  min-height: 100vh;
  background-color: #f2ede4;
  background-image: url('/bg-texture.png');
  background-repeat: repeat;
  background-size: 400px 400px;
  background-blend-mode: multiply;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
`;

const Card = styled(motion.div)`
  background: rgba(245, 241, 234, 0.95);
  border: 1px solid rgba(26, 26, 24, 0.1);
  padding: 3.5rem;
  border-radius: 4px;
  max-width: 480px;
  width: 100%;
  box-shadow: 0 8px 40px rgba(26, 26, 24, 0.08);
`;

const Title = styled.h1`
  font-family: var(--font-playfair), Georgia, serif;
  font-size: 2.25rem;
  font-weight: 400;
  font-style: italic;
  color: #1a1a18;
  margin-bottom: 1rem;
  line-height: 1.2;
`;

const Description = styled.p`
  font-family: var(--font-inter), system-ui, sans-serif;
  font-size: 0.9rem;
  color: #5a5a54;
  margin-bottom: 2rem;
  line-height: 1.65;
`;

const Input = styled.input`
  width: 100%;
  padding: 0.8rem 1rem;
  border: 1.5px solid rgba(26, 26, 24, 0.18);
  border-radius: 4px;
  font-family: var(--font-inter), system-ui, sans-serif;
  font-size: 0.9rem;
  background: rgba(242, 237, 228, 0.5);
  color: #1a1a18;
  margin-bottom: 0.875rem;
  transition: border-color 0.15s ease;

  &::placeholder {
    color: #b8b4aa;
  }

  &:focus {
    outline: none;
    border-color: rgba(26, 26, 24, 0.45);
  }
`;

const Button = styled.button`
  width: 100%;
  padding: 0.875rem;
  background: #1a1a18;
  color: #f2ede4;
  border: none;
  border-radius: 4px;
  font-family: var(--font-inter), system-ui, sans-serif;
  font-size: 0.9rem;
  cursor: pointer;
  transition: background 0.15s ease;

  &:hover {
    background: #333330;
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
`;

const SkipButton = styled.button`
  width: 100%;
  padding: 0.75rem;
  background: transparent;
  color: #9a9892;
  border: none;
  font-family: var(--font-inter), system-ui, sans-serif;
  font-size: 0.85rem;
  cursor: pointer;
  margin-top: 0.25rem;
  transition: color 0.15s ease;

  &:hover {
    color: #1a1a18;
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
`;

export default function ReadPage() {
  const [readerId, setReaderId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const existingReaderId = localStorage.getItem('readerId');
    if (existingReaderId) {
      setReaderId(existingReaderId);
    }
  }, []);

  const handleStartReading = async (skipName = false) => {
    setLoading(true);
    try {
      const response = await fetch('/api/reader', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: skipName ? undefined : name }),
      });

      const data = await response.json();
      localStorage.setItem('readerId', data.reader.id);
      setReaderId(data.reader.id);
    } catch (error) {
      console.error('Error creating reader:', error);
    } finally {
      setLoading(false);
    }
  };

  if (readerId) {
    return <ReaderView readerId={readerId} />;
  }

  return (
    <Page>
      <Card
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
      >
        <Title>Welcome, Reader.</Title>
        <Description>
          You're about to help make this book better. Highlight any passage to
          share your thoughts, suggest edits, or simply let the author know what
          resonated with you.
        </Description>
        <Input
          type="text"
          placeholder="Your name (optional)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleStartReading()}
        />
        <Button onClick={() => handleStartReading()} disabled={loading}>
          {loading ? 'Loading...' : 'Start Reading'}
        </Button>
        <SkipButton onClick={() => handleStartReading(true)} disabled={loading}>
          Skip and read anonymously
        </SkipButton>
      </Card>
    </Page>
  );
}
