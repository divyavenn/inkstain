'use client';

import { useState, useEffect } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { Chapter } from '@/types';
import ChapterReader from './ChapterReader';

const Container = styled.div`
  min-height: 100vh;
  background: #fafafa;
  display: flex;
  flex-direction: column;
`;

const Header = styled.header`
  background: white;
  border-bottom: 1px solid #e0e0e0;
  padding: 1rem 2rem;
  position: sticky;
  top: 0;
  z-index: 100;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.04);
`;

const Title = styled.h1`
  font-size: 1.5rem;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0;
`;

const Main = styled.main`
  flex: 1;
  display: flex;
`;

const Sidebar = styled(motion.aside)`
  width: 280px;
  background: white;
  border-right: 1px solid #e0e0e0;
  padding: 2rem 0;
  overflow-y: auto;
`;

const ChapterList = styled.ul`
  list-style: none;
`;

const ChapterItem = styled.li<{ $active: boolean }>`
  padding: 0.75rem 2rem;
  cursor: pointer;
  transition: all 0.2s ease;
  background: ${props => props.$active ? '#f0f0f0' : 'transparent'};
  border-left: 3px solid ${props => props.$active ? '#1a1a1a' : 'transparent'};
  color: ${props => props.$active ? '#1a1a1a' : '#666'};
  font-weight: ${props => props.$active ? '600' : '400'};

  &:hover {
    background: #f5f5f5;
    color: #1a1a1a;
  }
`;

const Content = styled.div`
  flex: 1;
  overflow-y: auto;
`;

interface ReaderViewProps {
  readerId: string;
}

export default function ReaderView({ readerId }: ReaderViewProps) {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [currentChapterId, setCurrentChapterId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchChapters();
  }, []);

  const fetchChapters = async () => {
    try {
      const response = await fetch('/api/chapters');
      const data = await response.json();
      setChapters(data.chapters);
      if (data.chapters.length > 0) {
        setCurrentChapterId(data.chapters[0].id);
      }
    } catch (error) {
      console.error('Error fetching chapters:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Container>
        <Header>
          <Title>Loading...</Title>
        </Header>
      </Container>
    );
  }

  return (
    <Container>
      <Header>
        <Title>BookBeta</Title>
      </Header>
      <Main>
        <Sidebar
          initial={{ x: -280 }}
          animate={{ x: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        >
          <ChapterList>
            {chapters.map((chapter) => (
              <ChapterItem
                key={chapter.id}
                $active={chapter.id === currentChapterId}
                onClick={() => setCurrentChapterId(chapter.id)}
              >
                {chapter.title}
              </ChapterItem>
            ))}
          </ChapterList>
        </Sidebar>
        <Content>
          <AnimatePresence mode="wait">
            {currentChapterId && (
              <ChapterReader
                key={currentChapterId}
                chapterId={currentChapterId}
                readerId={readerId}
              />
            )}
          </AnimatePresence>
        </Content>
      </Main>
    </Container>
  );
}
