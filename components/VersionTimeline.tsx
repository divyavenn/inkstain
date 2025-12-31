'use client';

import { useState, useEffect } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';

const TimelineContainer = styled.div`
  position: sticky;
  top: 0;
  z-index: 99;
  background: white;
  border-bottom: 2px solid #e0e0e0;
  padding: 1.5rem 2rem;
  overflow-x: auto;
`;

const TimelineTrack = styled.div`
  position: relative;
  height: 60px;
  display: flex;
  align-items: center;
  min-width: 100%;
`;

const TimelineLine = styled.div`
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  height: 2px;
  background: #e0e0e0;
  transform: translateY(-50%);
`;

const VersionMarkerContainer = styled.div`
  position: relative;
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  min-width: 100px;
`;

const VersionMarker = styled(motion.button)<{ $active: boolean }>`
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 3px solid ${props => props.$active ? '#1976d2' : '#999'};
  background: ${props => props.$active ? '#1976d2' : 'white'};
  cursor: pointer;
  position: relative;
  z-index: 2;
  transition: all 0.2s ease;

  &:hover {
    transform: scale(1.3);
    border-color: #1976d2;
  }
`;

const FeedbackBadge = styled.div<{ $active: boolean }>`
  position: absolute;
  top: -8px;
  right: -8px;
  background: ${props => props.$active ? '#1976d2' : '#666'};
  color: white;
  font-size: 0.625rem;
  font-weight: 600;
  padding: 0.125rem 0.375rem;
  border-radius: 10px;
  min-width: 20px;
  text-align: center;
`;

const Tooltip = styled(motion.div)`
  position: absolute;
  bottom: calc(100% + 10px);
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.9);
  color: white;
  padding: 0.75rem 1rem;
  border-radius: 6px;
  font-size: 0.875rem;
  white-space: nowrap;
  pointer-events: none;
  z-index: 1000;
  max-width: 300px;
  text-align: center;

  &::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    border: 6px solid transparent;
    border-top-color: rgba(0, 0, 0, 0.9);
  }
`;

const TooltipTitle = styled.div`
  font-weight: 600;
  margin-bottom: 0.25rem;
`;

const TooltipMeta = styled.div`
  font-size: 0.75rem;
  opacity: 0.8;
`;

interface Version {
  commitSha: string;
  commitShortSha: string;
  date: Date | string;
  author: string;
  message: string;
  feedbackCount: number;
}

interface VersionTimelineProps {
  chapterId: number;
  currentCommitSha: string;
  onVersionChange: (commitSha: string) => void;
}

export default function VersionTimeline({
  chapterId,
  currentCommitSha,
  onVersionChange
}: VersionTimelineProps) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVersion, setSelectedVersion] = useState<string>(currentCommitSha);
  const [hoveredVersion, setHoveredVersion] = useState<string | null>(null);

  useEffect(() => {
    fetchVersions();
  }, [chapterId]);

  useEffect(() => {
    setSelectedVersion(currentCommitSha);
  }, [currentCommitSha]);

  const fetchVersions = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/chapters/${chapterId}/versions`);
      const data = await response.json();
      setVersions(data.versions || []);
    } catch (error) {
      console.error('Error fetching versions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVersionClick = (commitSha: string) => {
    setSelectedVersion(commitSha);
    onVersionChange(commitSha);
  };

  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
    });
  };

  if (loading || versions.length === 0) {
    return null;
  }

  return (
    <TimelineContainer>
      <TimelineTrack>
        <TimelineLine />
        {versions.map((version, index) => (
          <VersionMarkerContainer key={version.commitSha}>
            <VersionMarker
              $active={selectedVersion === version.commitSha}
              onClick={() => handleVersionClick(version.commitSha)}
              onMouseEnter={() => setHoveredVersion(version.commitSha)}
              onMouseLeave={() => setHoveredVersion(null)}
              whileHover={{ scale: 1.3 }}
              whileTap={{ scale: 0.9 }}
            >
              {version.feedbackCount > 0 && (
                <FeedbackBadge $active={selectedVersion === version.commitSha}>
                  {version.feedbackCount}
                </FeedbackBadge>
              )}
            </VersionMarker>

            <AnimatePresence>
              {hoveredVersion === version.commitSha && (
                <Tooltip
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 5 }}
                  transition={{ duration: 0.15 }}
                >
                  <TooltipTitle>
                    {version.message || 'No commit message'}
                  </TooltipTitle>
                  <TooltipMeta>
                    {version.author} • {formatDate(version.date)}
                    <br />
                    {version.commitShortSha}
                    {version.feedbackCount > 0 && ` • ${version.feedbackCount} feedback`}
                  </TooltipMeta>
                </Tooltip>
              )}
            </AnimatePresence>
          </VersionMarkerContainer>
        ))}
      </TimelineTrack>
    </TimelineContainer>
  );
}
