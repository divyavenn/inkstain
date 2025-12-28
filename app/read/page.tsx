'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import ReaderView from '@/components/ReaderView';

const WelcomeContainer = styled.div`
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 2rem;
`;

const WelcomeCard = styled(motion.div)`
  background: white;
  padding: 3rem;
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  max-width: 500px;
  width: 100%;
`;

const Title = styled.h1`
  font-size: 2rem;
  font-weight: 700;
  color: #1a1a1a;
  margin-bottom: 1rem;
`;

const Description = styled.p`
  font-size: 1rem;
  color: #666;
  margin-bottom: 2rem;
  line-height: 1.6;
`;

const Input = styled.input`
  width: 100%;
  padding: 0.875rem;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 1rem;
  margin-bottom: 1rem;
  transition: border-color 0.2s ease;

  &:focus {
    outline: none;
    border-color: #667eea;
  }
`;

const Button = styled.button`
  width: 100%;
  padding: 1rem;
  background: #1a1a1a;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: #333;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }
`;

const SkipButton = styled.button`
  width: 100%;
  padding: 0.75rem;
  background: transparent;
  color: #666;
  border: none;
  font-size: 0.875rem;
  cursor: pointer;
  margin-top: 0.5rem;
  transition: color 0.2s ease;

  &:hover {
    color: #1a1a1a;
  }
`;

export default function ReadPage() {
  const [readerId, setReaderId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Check if reader already has an ID in localStorage
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
    <WelcomeContainer>
      <WelcomeCard
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      >
        <Title>Welcome, Reader!</Title>
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
        <Button
          onClick={() => handleStartReading()}
          disabled={loading}
        >
          {loading ? 'Loading...' : 'Start Reading'}
        </Button>
        <SkipButton
          onClick={() => handleStartReading(true)}
          disabled={loading}
        >
          Skip and read anonymously
        </SkipButton>
      </WelcomeCard>
    </WelcomeContainer>
  );
}
