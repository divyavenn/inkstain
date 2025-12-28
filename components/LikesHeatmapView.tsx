'use client';

import { useState, useEffect, useMemo } from 'react';
import styled from 'styled-components';
import { Feedback } from '@/types';

const Container = styled.div`
  max-width: 42rem;
  margin: 0 auto;
`;

const ChapterText = styled.div`
  line-height: 1.6;
  font-size: 1.125rem;
  color: #2a2a2a;
  position: relative;
  isolation: isolate;

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

  code {
    background: #f5f5f5;
    padding: 0.2em 0.4em;
    border-radius: 3px;
    font-family: monospace;
  }

  .heatmap-word {
    position: relative;
    display: inline;
    padding: 2px;
    border-radius: 3px;
    transition: all 0.2s ease;
    margin: 0 -1px;
  }

  .heatmap-word:not([data-total="0"]) {
    cursor: pointer;
  }

  .heatmap-word:hover {
    filter: brightness(1.1);
  }
`;

const Tooltip = styled.div<{ $x: number; $y: number }>`
  position: fixed;
  left: ${props => props.$x}px;
  top: ${props => props.$y}px;
  background: rgba(0, 0, 0, 0.9);
  color: white;
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  font-size: 0.875rem;
  pointer-events: none;
  z-index: 1000;
  white-space: nowrap;
`;

interface LikesHeatmapViewProps {
  chapterText: string;
  chapterHtml: string;
  feedback: Feedback[];
}

export default function LikesHeatmapView({ chapterText, chapterHtml, feedback }: LikesHeatmapViewProps) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; content: string } | null>(null);

  const heatmapData = useMemo(() => {
    const likesDislikesData = feedback.filter(
      f => f.feedbackType === 'like' || f.feedbackType === 'dislike'
    );

    const charMap: { [key: number]: { likes: number; dislikes: number } } = {};

    likesDislikesData.forEach(item => {
      for (let i = item.snippetStart; i < item.snippetEnd; i++) {
        if (!charMap[i]) {
          charMap[i] = { likes: 0, dislikes: 0 };
        }
        if (item.feedbackType === 'like') {
          charMap[i].likes++;
        } else {
          charMap[i].dislikes++;
        }
      }
    });

    return charMap;
  }, [feedback]);

  const processHtmlWithHeatmap = (html: string) => {
    // Parse HTML to a temporary DOM element
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;

    let charPosition = 0;

    const processNode = (node: Node): Node => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent || '';
        const words = text.split(/(\s+)/);
        const fragment = document.createDocumentFragment();

        let wordStartPos = charPosition;

        words.forEach((word) => {
          if (word) {
            if (/\s/.test(word)) {
              // Whitespace - just add as text
              fragment.appendChild(document.createTextNode(word));
              wordStartPos += word.length;
            } else {
              // Word - check if it needs highlighting
              let maxLikes = 0;
              let maxDislikes = 0;

              for (let j = wordStartPos; j < wordStartPos + word.length; j++) {
                if (heatmapData[j]) {
                  maxLikes = Math.max(maxLikes, heatmapData[j].likes);
                  maxDislikes = Math.max(maxDislikes, heatmapData[j].dislikes);
                }
              }

              const total = maxLikes + maxDislikes;
              const intensity = total > 0 ? (maxLikes - maxDislikes) / total : 0;

              const span = document.createElement('span');
              span.textContent = word;
              span.className = 'heatmap-word';
              span.dataset.intensity = intensity.toString();
              span.dataset.total = total.toString();
              span.dataset.likes = maxLikes.toString();
              span.dataset.dislikes = maxDislikes.toString();

              // Calculate and apply inline styles
              if (total > 0) {
                const opacity = Math.min(0.5, 0.15 + (total * 0.05));
                const blurSize = Math.min(20, 10 + total * 2);
                const shadowOpacity = Math.min(0.4, 0.1 + (total * 0.03));

                let bgColor;
                let shadowColor;

                if (Math.abs(intensity) < 0.1) {
                  // Nearly balanced - gray
                  const grayValue = Math.max(100, 220 - (total * 15));
                  bgColor = `rgba(${grayValue}, ${grayValue}, ${grayValue}, ${opacity})`;
                  shadowColor = `rgba(${grayValue}, ${grayValue}, ${grayValue}, ${shadowOpacity})`;
                } else if (intensity > 0) {
                  // More likes - green
                  bgColor = `rgba(102, 187, 106, ${opacity})`;
                  shadowColor = `rgba(102, 187, 106, ${shadowOpacity})`;
                } else {
                  // More dislikes - red
                  bgColor = `rgba(239, 83, 80, ${opacity})`;
                  shadowColor = `rgba(239, 83, 80, ${shadowOpacity})`;
                }

                span.style.backgroundColor = bgColor;
                span.style.boxShadow = `0 0 ${blurSize}px ${shadowColor}`;
              }

              fragment.appendChild(span);
              wordStartPos += word.length;
            }
          }
        });

        charPosition = wordStartPos;
        return fragment;
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as Element;
        const newElement = element.cloneNode(false) as Element;

        Array.from(element.childNodes).forEach((child) => {
          newElement.appendChild(processNode(child));
        });

        return newElement;
      }

      return node.cloneNode(true);
    };

    const processed = document.createElement('div');
    Array.from(tempDiv.childNodes).forEach((child) => {
      processed.appendChild(processNode(child));
    });

    return processed.innerHTML;
  };

  const processedHtml = useMemo(() => {
    if (typeof window === 'undefined') return chapterHtml;
    return processHtmlWithHeatmap(chapterHtml);
  }, [chapterHtml, heatmapData]);

  const handleMouseOver = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('heatmap-word')) {
      const total = parseInt(target.dataset.total || '0');
      const likes = parseInt(target.dataset.likes || '0');
      const dislikes = parseInt(target.dataset.dislikes || '0');

      if (total > 0) {
        setTooltip({
          x: e.clientX + 10,
          y: e.clientY + 10,
          content: `${likes} likes, ${dislikes} dislikes`
        });
      }
    }
  };

  const handleMouseOut = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('heatmap-word')) {
      setTooltip(null);
    }
  };

  return (
    <Container>
      <ChapterText
        onMouseOver={handleMouseOver}
        onMouseOut={handleMouseOut}
        dangerouslySetInnerHTML={{ __html: processedHtml }}
      />

      {tooltip && (
        <Tooltip $x={tooltip.x} $y={tooltip.y}>
          {tooltip.content}
        </Tooltip>
      )}
    </Container>
  );
}
