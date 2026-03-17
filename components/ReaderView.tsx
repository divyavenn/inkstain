'use client';

import { useState, useEffect } from 'react';
import styled, { css } from 'styled-components';
import { AnimatePresence, motion } from 'framer-motion';
import { Chapter } from '@/types';
import ChapterReader from './ChapterReader';

const SURFACE_BASE = '#fcfcfc';
const SURFACE_TEXTURE = css`
  background-color: ${SURFACE_BASE};
  background-image: url('/bg-texture.png');
  background-repeat: repeat;
  background-size: 100px 100px;
`;

const Page = styled.div`
  min-height: 100vh;
  ${SURFACE_TEXTURE}
  position: relative;
`;

/* Invisible strip on the left edge that triggers the sidebar */
const SidebarEdge = styled.div`
  position: fixed;
  left: 0;
  top: 0;
  width: 20px;
  height: 100vh;
  z-index: 200;
`;

const ChaptersSidebar = styled(motion.aside)`
  position: fixed;
  left: 0;
  top: 0;
  height: 100vh;
  width: 220px;
  ${SURFACE_TEXTURE}
  border-right: 1px solid rgba(26,26,24,0.08);
  box-shadow: 4px 0 24px rgba(26,26,24,0.08);
  z-index: 199;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
`;

const SidebarHeader = styled.div`
  padding: 1.5rem 1.5rem 0.5rem;
`;

const SidebarTitle = styled.span`
  font-family: var(--font-inter), system-ui, sans-serif;
  font-size: 0.62rem;
  font-weight: 500;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(26,26,24,0.3);
`;

const ChapterList = styled.ul`
  list-style: none;
  padding: 0.5rem 0 1rem;
`;

const ChapterItem = styled.li<{ $active: boolean }>`
  padding: 0.5rem 1.5rem;
  cursor: pointer;
  transition: background 0.12s ease;
  border-right: 2px solid ${p => p.$active ? '#b94a36' : 'transparent'};

  &:hover {
    background: rgba(26,26,24,0.03);
  }
`;

const ChapterItemTitle = styled.div<{ $active: boolean }>`
  font-family: var(--font-inter), system-ui, sans-serif;
  font-size: 0.82rem;
  font-weight: ${p => p.$active ? '500' : '400'};
  color: ${p => p.$active ? '#1a1a18' : '#6a6a62'};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

interface ReaderViewProps {
  sessionId: string;
}

export default function ReaderView({ sessionId }: ReaderViewProps) {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [currentChapterId, setCurrentChapterId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    fetchChapters();
  }, []);

  const fetchChapters = async () => {
    try {
      const response = await fetch('/api/chapters');
      const data = await response.json();
      setChapters(data.chapters);
      if (data.chapters.length > 0) setCurrentChapterId(data.chapters[0].id);
    } catch (error) {
      console.error('Error fetching chapters:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Page />;

  return (
    <Page>
      <SidebarEdge onMouseEnter={() => setSidebarOpen(true)} />

      <AnimatePresence>
        {sidebarOpen && (
          <ChaptersSidebar
            initial={{ x: -220 }}
            animate={{ x: 0 }}
            exit={{ x: -220 }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            onMouseLeave={() => setSidebarOpen(false)}
          >
            <SidebarHeader>
              <SidebarTitle>Chapters</SidebarTitle>
            </SidebarHeader>
            <ChapterList>
              {chapters.map(chapter => (
                <ChapterItem
                  key={chapter.id}
                  $active={chapter.id === currentChapterId}
                  onClick={() => {
                    setCurrentChapterId(chapter.id);
                    setSidebarOpen(false);
                  }}
                >
                  <ChapterItemTitle $active={chapter.id === currentChapterId}>
                    {chapter.title}
                  </ChapterItemTitle>
                </ChapterItem>
              ))}
            </ChapterList>
          </ChaptersSidebar>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {currentChapterId && (
          <ChapterReader
            key={currentChapterId}
            chapterId={currentChapterId}
            sessionId={sessionId}
          />
        )}
      </AnimatePresence>
    </Page>
  );
}
