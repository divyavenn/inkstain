'use client';

import { useState, useEffect } from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { Feedback, Chapter } from '@/types';
import LikesHeatmapView from './LikesHeatmapView';
import EditsInlineView from './EditsInlineView';
import CommentsView from './CommentsView';

const Container = styled.div`
  min-height: 100vh;
  background: #fafafa;
  display: flex;
  flex-direction: column;
`;

const TopHeader = styled.header`
  background: white;
  border-bottom: 1px solid #e0e0e0;
  padding: 1rem 2rem;
  position: sticky;
  top: 0;
  z-index: 100;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.04);
`;

const TopHeaderContent = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const Title = styled.h1`
  font-size: 1.5rem;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0;
`;

const ShareLink = styled.a`
  font-size: 0.875rem;
  color: #1976d2;
  text-decoration: none;
  font-weight: 500;

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

const SidebarSection = styled.div`
  padding: 2rem 0;
  border-bottom: 1px solid #e0e0e0;
`;

const SidebarTitle = styled.h3`
  font-size: 0.875rem;
  font-weight: 600;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 0 2rem;
  margin-bottom: 1rem;
`;

const ChapterList = styled.ul`
  list-style: none;
`;

const ChapterItem = styled.li<{ $active: boolean }>`
  padding: 0.75rem 2rem;
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

const GlobalStats = styled.div`
  padding: 0 2rem;
`;

const GlobalStatRow = styled.div`
  display: flex;
  justify-content: space-between;
  padding: 0.5rem 0;
  font-size: 0.875rem;
  color: #666;
`;

const GlobalStatValue = styled.span`
  font-weight: 600;
  color: #1a1a1a;
`;

const Content = styled.div`
  flex: 1;
  overflow-y: auto;
  background: #fafafa;
`;

const ChapterHeader = styled.div`
  background: white;
  border-bottom: 1px solid #e0e0e0;
  padding: 2rem;
  position: sticky;
  top: 0;
  z-index: 50;
`;

const ChapterTitle = styled.h2`
  font-size: 1.75rem;
  font-weight: 700;
  color: #1a1a1a;
  margin-bottom: 1.5rem;
`;

const ChapterStats = styled.div`
  display: flex;
  gap: 2rem;
  margin-bottom: 1.5rem;
`;

const ChapterStat = styled.div`
  display: flex;
  flex-direction: column;
`;

const ChapterStatLabel = styled.span`
  font-size: 0.75rem;
  color: #999;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 0.25rem;
`;

const ChapterStatValue = styled.span`
  font-size: 1.5rem;
  font-weight: 700;
  color: #1a1a1a;
`;

const TabContainer = styled.div`
  display: flex;
  gap: 0.5rem;
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

type ViewType = 'likes' | 'comments' | 'edits';

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

  useEffect(() => {
    fetchFeedback();
    fetchChapters();
    generateShareUrl();
  }, []);

  useEffect(() => {
    if (selectedChapterId) {
      fetchChapterContent(selectedChapterId);
    }
  }, [selectedChapterId]);

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

  const fetchChapterContent = async (chapterId: number) => {
    setLoadingChapter(true);
    try {
      const response = await fetch(`/api/chapters/${chapterId}`);
      const data = await response.json();
      setChapterContent(data.content || '');
      setChapterHtml(data.html || '');
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

  const globalStats = {
    total: feedback.length,
    likes: feedback.filter(f => f.feedbackType === 'like').length,
    dislikes: feedback.filter(f => f.feedbackType === 'dislike').length,
    comments: feedback.filter(f => f.feedbackType === 'comment').length,
    edits: feedback.filter(f => f.feedbackType === 'edit').length,
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
          <Title>Loading...</Title>
        </TopHeader>
      </Container>
    );
  }

  return (
    <Container>
      <TopHeader>
        <TopHeaderContent>
          <Title>Author Dashboard</Title>
          {shareUrl && (
            <ShareLink href={shareUrl} target="_blank" rel="noopener noreferrer">
              Reader Link →
            </ShareLink>
          )}
        </TopHeaderContent>
      </TopHeader>

      <Main>
        <Sidebar
          initial={{ x: -280 }}
          animate={{ x: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        >
          <SidebarSection>
            <SidebarTitle>Chapters</SidebarTitle>
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
          </SidebarSection>

          <SidebarSection>
            <SidebarTitle>Overall Stats</SidebarTitle>
            <GlobalStats>
              <GlobalStatRow>
                <span>Total Feedback</span>
                <GlobalStatValue>{globalStats.total}</GlobalStatValue>
              </GlobalStatRow>
              <GlobalStatRow>
                <span>Likes</span>
                <GlobalStatValue>{globalStats.likes}</GlobalStatValue>
              </GlobalStatRow>
              <GlobalStatRow>
                <span>Dislikes</span>
                <GlobalStatValue>{globalStats.dislikes}</GlobalStatValue>
              </GlobalStatRow>
              <GlobalStatRow>
                <span>Comments</span>
                <GlobalStatValue>{globalStats.comments}</GlobalStatValue>
              </GlobalStatRow>
              <GlobalStatRow>
                <span>Edits</span>
                <GlobalStatValue>{globalStats.edits}</GlobalStatValue>
              </GlobalStatRow>
            </GlobalStats>
          </SidebarSection>
        </Sidebar>

        <Content>
          {!selectedChapterId || chapters.length === 0 ? (
            <EmptyState>
              <h3>No chapters yet</h3>
              <p>Add chapters to start collecting feedback</p>
            </EmptyState>
          ) : (
            <>
              <ChapterHeader>
                <ChapterTitle>{selectedChapter?.title}</ChapterTitle>

                <ChapterStats>
                  <ChapterStat>
                    <ChapterStatLabel>Likes</ChapterStatLabel>
                    <ChapterStatValue>{chapterStats.likes}</ChapterStatValue>
                  </ChapterStat>
                  <ChapterStat>
                    <ChapterStatLabel>Dislikes</ChapterStatLabel>
                    <ChapterStatValue>{chapterStats.dislikes}</ChapterStatValue>
                  </ChapterStat>
                  <ChapterStat>
                    <ChapterStatLabel>Comments</ChapterStatLabel>
                    <ChapterStatValue>{chapterStats.comments}</ChapterStatValue>
                  </ChapterStat>
                  <ChapterStat>
                    <ChapterStatLabel>Edits</ChapterStatLabel>
                    <ChapterStatValue>{chapterStats.edits}</ChapterStatValue>
                  </ChapterStat>
                </ChapterStats>

                <TabContainer>
                  <Tab
                    $active={activeView === 'likes'}
                    onClick={() => setActiveView('likes')}
                  >
                    Likes
                  </Tab>
                  <Tab
                    $active={activeView === 'comments'}
                    onClick={() => setActiveView('comments')}
                  >
                    Comments
                  </Tab>
                  <Tab
                    $active={activeView === 'edits'}
                    onClick={() => setActiveView('edits')}
                  >
                    Edits
                  </Tab>
                </TabContainer>
              </ChapterHeader>

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
                        feedback={chapterFeedback}
                      />
                    )}
                    {activeView === 'edits' && (
                      <EditsInlineView
                        chapterText={chapterContent}
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
    </Container>
  );
}
