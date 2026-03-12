'use client';

import { useState, useEffect } from 'react';
import styled, { css } from 'styled-components';
import { AnimatePresence, motion } from 'framer-motion';
import { useAtom } from 'jotai';
import { Feedback, Chapter } from '@/types';
import LikesHeatmapView from './LikesHeatmapView';
import CommentsView from './CommentsView';
import VersionTimeline from './VersionTimeline';
import { selectedVersionAtom } from '@/lib/atoms';

const SURFACE_BASE = '#fcfcfc';
const SURFACE_TEXTURE = css`
  background-color: ${SURFACE_BASE};
  background-image: url('/bg-texture.png');
  background-repeat: repeat;
  background-size: 100px 100px;
`;

/* ─── Desktop ────────────────────────────────────────────────────────────── */

const Desktop = styled.div`
  min-height: 100vh;
  padding: 3% 10% 10% 10%;
  background-color: #d3dae3;
  display: flex;
  flex-direction: column;
`;

/* ─── Outer shell: holds both tab row and panel, gets the outer margin ────── */

const Shell = styled.div`
  position: relative;
  isolation: isolate;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  padding: 2%;
  background: transparent;
`;

/* ─── Tab row ─────────────────────────────────────────────────────────────── */

const TabRow = styled.div`
  display: flex;
  align-items: flex-end;
  gap: 2px;
`;

const FolderTab = styled.button<{ $active: boolean; $isLeft: boolean }>`
  position: relative;
  padding: 0.4rem 1.6rem calc(0.4rem + 1px);
  border: none;
  border-radius: 6px 6px 0 0;
  font-family: var(--font-inter), system-ui, sans-serif;
  font-size: 0.75rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  font-weight: ${p => p.$active ? '500' : '400'};
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
  ${SURFACE_TEXTURE}
  background-color: ${p => p.$active ? SURFACE_BASE : 'rgba(245,241,232,0.78)'};
  color: ${p => p.$active ? '#1a1a18' : 'rgba(26,26,24,0.4)'};
  z-index: ${p => p.$active ? 2 : 1};
  /* Bridge: 1px overlap with panel erases the seam */
  margin-bottom: ${p => p.$active ? '-1px' : '0'};
  /* Inset highlight gives the tab a formed feel */
  ${p => p.$active && css`box-shadow: inset 0 1px 0 rgba(255,255,255,0.55), 0 1px 0 ${SURFACE_BASE};`}

  &:hover {
    background-color: ${p => p.$active ? SURFACE_BASE : 'rgba(245,241,232,0.9)'};
    color: rgba(26,26,24,0.8);
  }

  /* Concave corner: outer-right notch where active tab meets panel surface */
  ${p => p.$active && p.$isLeft && css`
    &::after {
      content: '';
      position: absolute;
      bottom: 0;
      right: -6px;
      width: 6px;
      height: 6px;
      background: transparent;
      border-bottom-left-radius: 6px;
      box-shadow: -3px 3px 0 0 ${SURFACE_BASE};
      pointer-events: none;
      z-index: 3;
    }
  `}

  /* Concave corners on both sides when right tab is active */
  ${p => p.$active && !p.$isLeft && css`
    &::before {
      content: '';
      position: absolute;
      bottom: 0;
      left: -6px;
      width: 6px;
      height: 6px;
      background: transparent;
      border-bottom-right-radius: 6px;
      box-shadow: 3px 3px 0 0 ${SURFACE_BASE};
      pointer-events: none;
      z-index: 3;
    }
    &::after {
      content: '';
      position: absolute;
      bottom: 0;
      right: -6px;
      width: 6px;
      height: 6px;
      background: transparent;
      border-bottom-left-radius: 6px;
      box-shadow: -3px 3px 0 0 ${SURFACE_BASE};
      pointer-events: none;
      z-index: 3;
    }
  `}
`;

/* ─── Panel: the content surface, gets the shadow ────────────────────────── */

const Panel = styled.div`
  display: flex;
  flex: 1;
  ${SURFACE_TEXTURE}
  /* top-left always flat: Heatmap tab always occupies that corner regardless of which tab is active */
  border-radius: 0 6px 6px 6px;
  box-shadow: none;
  overflow: hidden;
  min-height: 0;
  position: relative;
  z-index: 1;
`;

/* ─── Sidebar ─────────────────────────────────────────────────────────────── */

const Sidebar = styled(motion.aside)`
  width: 220px;
  background: rgba(26,26,24,0.025);
  border-right: 1px solid rgba(26,26,24,0.06);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  flex-shrink: 0;
`;

const SidebarHeader = styled.div`
  padding: 1.5rem 1.5rem 0.5rem;
  display: flex;
  align-items: center;
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
  transition: all 0.12s ease;
  border-right: 2px solid ${p => p.$active ? '#b94a36' : 'transparent'};
  background: transparent;

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

/* ─── Content area ────────────────────────────────────────────────────────── */

const ContentArea = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const ContentHeader = styled.div`
  padding: 1.75rem 2.5rem 0;

  display: flex;
  flex-direction: column;
  gap: 0;
`;

const ContentMeta = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 1rem;
`;

const ChapterTitleText = styled.h1`
  font-family: var(--font-playfair), Georgia, serif;
  font-size: 1.45rem;
  font-weight: 400;
  font-style: italic;
  color: #1a1a18;
  margin: 0;
`;

const HeaderStats = styled.div`
  display: flex;
  gap: 1.75rem;
  align-items: center;
`;

const Stat = styled.div`
  font-family: var(--font-inter), system-ui, sans-serif;
  font-size: 0.7rem;
  letter-spacing: 0.01em;
  color: rgba(26,26,24,0.38);
  display: flex;
  gap: 0.35rem;
  align-items: center;

  strong {
    color: #1a1a18;
    font-weight: 500;
  }
`;

const ShareLink = styled.a`
  font-family: var(--font-inter), system-ui, sans-serif;
  font-size: 0.7rem;
  color: #1a1a18;
  opacity: 0.35;
  text-decoration: none;
  transition: opacity 0.15s ease;

  &:hover { opacity: 1; }
`;

const InnerTabBar = styled.div`
  display: flex;
  gap: 0;
`;

const InnerTab = styled.button<{ $active: boolean }>`
  padding: 0.6rem 1.1rem;
  border: none;
  background: transparent;
  font-family: var(--font-inter), system-ui, sans-serif;
  font-size: 0.8rem;
  font-weight: ${p => p.$active ? '600' : '400'};
  color: ${p => p.$active ? '#1a1a18' : '#9a9892'};
  cursor: pointer;
  transition: all 0.15s ease;
  border-bottom: 2px solid ${p => p.$active ? '#1a1a18' : 'transparent'};

  &:hover { color: #1a1a18; }
`;

const ScrollableContent = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 2.5rem 2.5rem;
`;

const ContentTransition = styled(motion.div)`
  width: 100%;
`;

/* ─── Empty / loading states ──────────────────────────────────────────────── */

const EmptyState = styled.div`
  text-align: center;
  padding: 4rem 2rem;
  color: #9a9892;

  h3 {
    font-family: var(--font-playfair), Georgia, serif;
    font-weight: 400;
    font-style: italic;
    font-size: 1.4rem;
    color: #5a5a54;
    margin-bottom: 0.5rem;
  }

  p {
    font-family: var(--font-inter), system-ui, sans-serif;
    font-size: 0.875rem;
  }
`;

const LoadingText = styled.p`
  font-family: var(--font-inter), system-ui, sans-serif;
  text-align: center;
  padding: 3rem;
  color: #9a9892;
  font-size: 0.875rem;
`;

/* ─── Pre-compute indicator ───────────────────────────────────────────────── */

const PreComputeIndicator = styled.div<{ $status: 'computing' | 'complete' | 'error' }>`
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  background: ${p => p.$status === 'error' ? 'rgba(180,40,40,0.9)' : 'rgba(26,26,24,0.88)'};
  color: #f2ede4;
  padding: 0.6rem 1rem;
  border-radius: 4px;
  box-shadow: 0 4px 20px rgba(26,26,24,0.15);
  font-family: var(--font-inter), system-ui, sans-serif;
  font-size: 0.8rem;
  z-index: 1000;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

/* ─── Component ───────────────────────────────────────────────────────────── */

type ViewType = 'likes' | 'comments';

export default function AuthorDashboard() {
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [shareUrl, setShareUrl] = useState('');
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [selectedChapterId, setSelectedChapterId] = useState<number | null>(null);
  const [chapterContent, setChapterContent] = useState<string>('');
  const [chapterHtml, setChapterHtml] = useState<string>('');
  const [contentChapterId, setContentChapterId] = useState<number | null>(null);
  const [displayedCommitSha, setDisplayedCommitSha] = useState<string>('');
  const [loadingChapter, setLoadingChapter] = useState(false);
  const [activeView, setActiveView] = useState<ViewType>('likes');
  const [, setSelectedVersionSha] = useAtom(selectedVersionAtom);
  const [currentCommitSha, setCurrentCommitSha] = useState<string>('');
  const [preComputeStatus, setPreComputeStatus] = useState<'idle' | 'computing' | 'complete' | 'error'>('idle');
  const [, setPreComputeProgress] = useState(0);

  useEffect(() => {
    fetchFeedback();
    fetchChapters();
    generateShareUrl();
  }, []);

  useEffect(() => {
    if (selectedChapterId) {
      setDisplayedCommitSha('');
      fetchChapterContent(selectedChapterId);
      startPreComputation(selectedChapterId);
    }
  }, [selectedChapterId]);

  const startPreComputation = async (chapterId: number) => {
    try {
      const statusResponse = await fetch(`/api/chapters/${chapterId}/precompute`);
      const statusData = await statusResponse.json();
      if (statusData.status === 'complete') { setPreComputeStatus('complete'); return; }

      setPreComputeStatus('computing');
      setPreComputeProgress(0);

      const response = await fetch(`/api/chapters/${chapterId}/precompute`, { method: 'POST' });
      if (response.ok) {
        setPreComputeStatus('complete');
        setPreComputeProgress(100);
      } else {
        setPreComputeStatus('error');
      }
    } catch (error) {
      console.error('Pre-computation error:', error);
      setPreComputeStatus('error');
    }
  };

  const fetchFeedback = async () => {
    try {
      const response = await fetch('/api/admin/feedback');
      const data = await response.json();
      setFeedback(data.feedback);
    } catch (error) {
      console.error('Error fetching feedback:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchChapters = async () => {
    try {
      const response = await fetch('/api/chapters');
      const data = await response.json();
      setChapters(data.chapters || []);
      if (data.chapters && data.chapters.length > 0) {
        setSelectedChapterId(data.chapters[0].id);
      }
    } catch (error) {
      console.error('Error fetching chapters:', error);
    }
  };

  const fetchChapterContent = async (chapterId: number, commitSha?: string) => {
    setLoadingChapter(true);
    try {
      const url = commitSha
        ? `/api/chapters/${chapterId}/versions/${commitSha}`
        : `/api/chapters/${chapterId}`;
      const response = await fetch(url);
      const data = await response.json();
      const nextCommitSha = commitSha || data.version?.commitSha || data.commitSha || '';

      setChapterContent(data.content || '');
      setChapterHtml(data.html || '');
      setContentChapterId(chapterId);
      setDisplayedCommitSha(nextCommitSha);

      if (!commitSha) {
        setCurrentCommitSha(data.commitSha || '');
      }
    } catch (error) {
      console.error('Error fetching chapter content:', error);
    } finally {
      setLoadingChapter(false);
    }
  };

  const generateShareUrl = () => {
    if (typeof window !== 'undefined') {
      setShareUrl(`${window.location.origin}/read`);
    }
  };

  const handleApproveEdit = async (feedbackId: number) => { console.log('Approved edit:', feedbackId); };
  const handleDiscardEdit = async (feedbackId: number) => { console.log('Discarded edit:', feedbackId); };

  const chapterFeedback = selectedChapterId
    ? feedback.filter(f => f.chapterId === selectedChapterId)
    : [];

  const chapterStats = {
    likes: chapterFeedback.filter(f => f.feedbackType === 'like').length,
    dislikes: chapterFeedback.filter(f => f.feedbackType === 'dislike').length,
    comments: chapterFeedback.filter(f => f.feedbackType === 'comment').length,
    edits: chapterFeedback.filter(f => f.feedbackType === 'edit').length,
  };

  const selectedChapter = chapters.find(c => c.id === selectedChapterId);
  const activeContentKey = `${selectedChapterId ?? 'none'}:${displayedCommitSha || currentCommitSha}:${activeView}`;
  const shouldShowLoadingState = loadingChapter && contentChapterId !== selectedChapterId;

  return (
    <Desktop>
      <Shell>
        {/* Tab row sits at the top of the shell */}
        <TabRow>
          <FolderTab $active={activeView === 'likes'} $isLeft={true} onClick={() => setActiveView('likes')}>
            Heatmap
          </FolderTab>
          <FolderTab $active={activeView === 'comments'} $isLeft={false} onClick={() => setActiveView('comments')}>
            Comments & Edits
          </FolderTab>
        </TabRow>

        {/* Panel shares background with the active tab, gets the shadow */}
        <Panel>
          {/* Chapter sidebar */}

          {/* Content */}
          <ContentArea>
            {loading ? (
              <LoadingText>Loading...</LoadingText>
            ) : !selectedChapterId || chapters.length === 0 ? (
              <EmptyState>
                <h3>No chapters yet</h3>
                <p>Add chapters to start collecting feedback</p>
              </EmptyState>
            ) : (
              <>
                <ContentHeader>
                  <ContentMeta>
                    <ChapterTitleText>{selectedChapter?.title}</ChapterTitleText>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                      <HeaderStats>
                        <Stat><span>Likes</span><strong>{chapterStats.likes}</strong></Stat>
                        <Stat><span>Dislikes</span><strong>{chapterStats.dislikes}</strong></Stat>
                        <Stat><span>Comments</span><strong>{chapterStats.comments}</strong></Stat>
                        <Stat><span>Edits</span><strong>{chapterStats.edits}</strong></Stat>
                      </HeaderStats>
                    </div>
                  </ContentMeta>

                {selectedChapterId && currentCommitSha && (
                  <VersionTimeline
                    chapterId={selectedChapterId}
                    currentCommitSha={currentCommitSha}
                    onVersionChange={(sha) => {
                      setSelectedVersionSha(sha);
                      fetchChapterContent(selectedChapterId, sha);
                    }}
                  />
                )}
                </ContentHeader>

                <ScrollableContent>
                  {shouldShowLoadingState ? (
                    <LoadingText>Loading chapter...</LoadingText>
                  ) : chapterFeedback.length === 0 ? (
                    <EmptyState>
                      <h3>No feedback yet</h3>
                      <p>Share your reader link to start collecting feedback</p>
                    </EmptyState>
                  ) : (
                    <AnimatePresence mode="wait" initial={false}>
                      <ContentTransition
                        key={activeContentKey}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.2, ease: 'easeOut' }}
                      >
                        {activeView === 'likes' && (
                          <LikesHeatmapView
                            chapterText={chapterContent}
                            chapterHtml={chapterHtml}
                            feedback={chapterFeedback}
                          />
                        )}
                        {activeView === 'comments' && (
                          <CommentsView
                            chapterText={chapterContent}
                            chapterHtml={chapterHtml}
                            feedback={chapterFeedback}
                            onApproveEdit={handleApproveEdit}
                            onDiscardEdit={handleDiscardEdit}
                          />
                        )}
                      </ContentTransition>
                    </AnimatePresence>
                  )}
                </ScrollableContent>
              </>
            )}
          </ContentArea>

          <Sidebar
            initial={{ x: -220 }}
            animate={{ x: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <SidebarHeader>
              <SidebarTitle>Chapters</SidebarTitle>
            </SidebarHeader>
            <ChapterList>
              {chapters.map(chapter => (
                <ChapterItem
                  key={chapter.id}
                  $active={chapter.id === selectedChapterId}
                  onClick={() => setSelectedChapterId(chapter.id)}
                >
                  <ChapterItemTitle $active={chapter.id === selectedChapterId}>
                    {chapter.title}
                  </ChapterItemTitle>
                </ChapterItem>
              ))}
            </ChapterList>
          </Sidebar>
        </Panel>
      </Shell>

      {preComputeStatus !== 'idle' && preComputeStatus !== 'complete' && (
        <PreComputeIndicator $status={preComputeStatus}>
          {preComputeStatus === 'computing' && 'Pre-computing versions...'}
          {preComputeStatus === 'error' && 'Pre-computation failed'}
        </PreComputeIndicator>
      )}
    </Desktop>
  );
}
