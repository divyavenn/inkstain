'use client';

import { useState, useEffect } from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { Feedback, Chapter } from '@/types';
import LikesHeatmapView from './LikesHeatmapView';
import CommentsView from './CommentsView';
import VersionTimeline from './VersionTimeline';

const Container = styled.div`
  min-height: 100vh;
  background: #fafafa;
  display: flex;
  flex-direction: column;
`;

const TopHeader = styled.header`
  background: white;
  border-bottom: 1px solid #e0e0e0;
  padding: 1.5rem 2rem;
  position: sticky;
  top: 0;
  z-index: 100;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.04);
`;

const TopHeaderContent = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 2rem;
`;

const HeaderLeft = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  gap: 2rem;
`;

const ChapterTitle = styled.h1`
  font-size: 1.25rem;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0;
`;

const HeaderStats = styled.div`
  display: flex;
  gap: 1.5rem;
`;

const HeaderStat = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: #666;
`;

const HeaderStatValue = styled.span`
  font-weight: 600;
  color: #1a1a1a;
`;

const ShareLink = styled.a`
  font-size: 0.875rem;
  color: #1976d2;
  text-decoration: none;
  font-weight: 500;
  white-space: nowrap;

  &:hover {
    text-decoration: underline;
  }
`;

const Main = styled.main`
  flex: 1;
  display: flex;
`;

const Sidebar = styled(motion.aside)`
  width: 280px;
  background: white;
  border-right: 1px solid #e0e0e0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
`;

const ChapterList = styled.ul`
  list-style: none;
  padding: 1rem 0;
`;

const ChapterItem = styled.li<{ $active: boolean }>`
  padding: 0.75rem 1.5rem;
  cursor: pointer;
  transition: all 0.2s ease;
  background: ${props => props.$active ? '#f0f0f0' : 'transparent'};
  border-left: 3px solid ${props => props.$active ? '#1976d2' : 'transparent'};
  color: ${props => props.$active ? '#1a1a1a' : '#666'};
  font-weight: ${props => props.$active ? '600' : '400'};
  font-size: 0.9375rem;

  &:hover {
    background: #f5f5f5;
    color: #1a1a1a;
  }
`;

const Content = styled.div`
  flex: 1;
  overflow-y: auto;
  background: #fafafa;
`;

const TabContainer = styled.div`
  display: flex;
  gap: 0.5rem;
  padding: 1rem 2rem;
  background: white;
  border-bottom: 1px solid #e0e0e0;
`;

const Tab = styled.button<{ $active: boolean }>`
  padding: 0.5rem 1.5rem;
  border: none;
  border-bottom: 3px solid ${props => props.$active ? '#1976d2' : 'transparent'};
  font-size: 0.9375rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  background: transparent;
  color: ${props => props.$active ? '#1976d2' : '#666'};

  &:hover {
    color: #1976d2;
    background: #f5f5f5;
  }
`;

const ViewContainer = styled.div`
  padding: 2rem;
`;

const LoadingMessage = styled.div`
  text-align: center;
  padding: 3rem;
  color: #999;
  font-size: 1.125rem;
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 4rem 2rem;
  color: #999;
  max-width: 42rem;
  margin: 0 auto;
`;

const VersionBanner = styled.div`
  background: #fff3cd;
  border-bottom: 1px solid #ffc107;
  padding: 0.75rem 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const BannerText = styled.span`
  font-size: 0.9375rem;
  color: #856404;
`;

const ReturnButton = styled.button`
  padding: 0.5rem 1rem;
  background: #1976d2;
  color: white;
  border: none;
  border-radius: 4px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease;

  &:hover {
    background: #1565c0;
  }
`;

const PreComputeIndicator = styled.div<{ $status: 'computing' | 'complete' | 'error' }>`
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  background: ${props => {
    switch (props.$status) {
      case 'computing': return '#ffa726';
      case 'complete': return '#66bb6a';
      case 'error': return '#ef5350';
    }
  }};
  color: white;
  padding: 0.75rem 1rem;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  font-size: 0.875rem;
  font-weight: 500;
  z-index: 1000;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

type ViewType = 'likes' | 'comments';

export default function AuthorDashboard() {
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [shareUrl, setShareUrl] = useState('');
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [selectedChapterId, setSelectedChapterId] = useState<number | null>(null);
  const [chapterContent, setChapterContent] = useState<string>('');
  const [chapterHtml, setChapterHtml] = useState<string>('');
  const [loadingChapter, setLoadingChapter] = useState(false);
  const [activeView, setActiveView] = useState<ViewType>('likes');
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);
  const [currentCommitSha, setCurrentCommitSha] = useState<string>('');
  const [versionInfo, setVersionInfo] = useState<{ date: Date; author: string; message: string } | null>(null);
  const [preComputeStatus, setPreComputeStatus] = useState<'idle' | 'computing' | 'complete' | 'error'>('idle');
  const [preComputeProgress, setPreComputeProgress] = useState(0);

  useEffect(() => {
    fetchFeedback();
    fetchChapters();
    generateShareUrl();
  }, []);

  useEffect(() => {
    if (selectedChapterId) {
      fetchChapterContent(selectedChapterId);
      // Start pre-computation in background
      startPreComputation(selectedChapterId);
    }
  }, [selectedChapterId]);

  const startPreComputation = async (chapterId: number) => {
    try {
      // Check if already complete
      const statusResponse = await fetch(`/api/chapters/${chapterId}/precompute`);
      const statusData = await statusResponse.json();

      if (statusData.status === 'complete') {
        setPreComputeStatus('complete');
        return;
      }

      // Start pre-computation
      setPreComputeStatus('computing');
      setPreComputeProgress(0);

      const response = await fetch(`/api/chapters/${chapterId}/precompute`, {
        method: 'POST'
      });

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

      setChapterContent(data.content || '');
      setChapterHtml(data.html || '');

      if (!commitSha) {
        // Fetching current version - store commit SHA
        setCurrentCommitSha(data.commitSha || '');
        setVersionInfo(null);
      }

      if (data.version) {
        // Fetching historical version - store version info
        setVersionInfo({
          date: new Date(data.version.date),
          author: data.version.author,
          message: data.version.message
        });
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

  const handleApproveEdit = async (feedbackId: number) => {
    console.log('Approved edit:', feedbackId);
  };

  const handleDiscardEdit = async (feedbackId: number) => {
    console.log('Discarded edit:', feedbackId);
  };

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

  if (loading) {
    return (
      <Container>
        <TopHeader>
          <TopHeaderContent>
            <ChapterTitle>Loading...</ChapterTitle>
          </TopHeaderContent>
        </TopHeader>
      </Container>
    );
  }

  return (
    <Container>
      <TopHeader>
        <TopHeaderContent>
          <HeaderLeft>
            {selectedChapter && (
              <>
                <ChapterTitle>{selectedChapter.title}</ChapterTitle>
                <HeaderStats>
                  <HeaderStat>
                    <span>Likes:</span>
                    <HeaderStatValue>{chapterStats.likes}</HeaderStatValue>
                  </HeaderStat>
                  <HeaderStat>
                    <span>Dislikes:</span>
                    <HeaderStatValue>{chapterStats.dislikes}</HeaderStatValue>
                  </HeaderStat>
                  <HeaderStat>
                    <span>Comments:</span>
                    <HeaderStatValue>{chapterStats.comments}</HeaderStatValue>
                  </HeaderStat>
                  <HeaderStat>
                    <span>Edits:</span>
                    <HeaderStatValue>{chapterStats.edits}</HeaderStatValue>
                  </HeaderStat>
                </HeaderStats>
              </>
            )}
          </HeaderLeft>
          {shareUrl && (
            <ShareLink href={shareUrl} target="_blank" rel="noopener noreferrer">
              Reader Link →
            </ShareLink>
          )}
        </TopHeaderContent>
      </TopHeader>

      {selectedChapterId && currentCommitSha && (
        <VersionTimeline
          chapterId={selectedChapterId}
          currentCommitSha={currentCommitSha}
          onVersionChange={(sha) => {
            setSelectedVersion(sha);
            fetchChapterContent(selectedChapterId, sha);
          }}
        />
      )}

      {selectedVersion && selectedVersion !== currentCommitSha && versionInfo && (
        <VersionBanner>
          <BannerText>
            Viewing version from {versionInfo.date.toLocaleDateString()}
            {versionInfo.message && `: "${versionInfo.message}"`}
          </BannerText>
          <ReturnButton onClick={() => {
            setSelectedVersion(null);
            if (selectedChapterId) {
              fetchChapterContent(selectedChapterId);
            }
          }}>
            Return to Current
          </ReturnButton>
        </VersionBanner>
      )}

      <Main>
        <Sidebar
          initial={{ x: -280 }}
          animate={{ x: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        >
          <ChapterList>
            {chapters.map(chapter => (
              <ChapterItem
                key={chapter.id}
                $active={chapter.id === selectedChapterId}
                onClick={() => setSelectedChapterId(chapter.id)}
              >
                {chapter.title}
              </ChapterItem>
            ))}
          </ChapterList>
        </Sidebar>

        <Content>
          {!selectedChapterId || chapters.length === 0 ? (
            <EmptyState>
              <h3>No chapters yet</h3>
              <p>Add chapters to start collecting feedback</p>
            </EmptyState>
          ) : (
            <>
              <TabContainer>
                <Tab
                  $active={activeView === 'likes'}
                  onClick={() => setActiveView('likes')}
                >
                  Heatmap
                </Tab>
                <Tab
                  $active={activeView === 'comments'}
                  onClick={() => setActiveView('comments')}
                >
                  Comments & Edits
                </Tab>
              </TabContainer>

              <ViewContainer>
                {loadingChapter ? (
                  <LoadingMessage>Loading chapter...</LoadingMessage>
                ) : chapterFeedback.length === 0 ? (
                  <EmptyState>
                    <h3>No feedback for this chapter yet</h3>
                    <p>Share your book link with readers to start collecting feedback</p>
                  </EmptyState>
                ) : (
                  <>
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
                  </>
                )}
              </ViewContainer>
            </>
          )}
        </Content>
      </Main>

      {preComputeStatus !== 'idle' && preComputeStatus !== 'complete' && (
        <PreComputeIndicator $status={preComputeStatus}>
          {preComputeStatus === 'computing' && '⏳ Pre-computing versions...'}
          {preComputeStatus === 'error' && '❌ Pre-computation failed'}
        </PreComputeIndicator>
      )}
    </Container>
  );
}
