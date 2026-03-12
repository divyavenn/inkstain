'use client';

import { useState, useMemo } from 'react';
import styled from 'styled-components';
import { Feedback } from '@/types';
import ChapterText from './ChapterText';

const Container = styled.div`
  max-width: 42rem;
  margin: 0 auto;
`;

const HeatmapChapterText = styled(ChapterText)`
  position: relative;

  .heatmap-run {
    display: inline;
    margin: 0 -0.4em;
    padding: 0.1em 0.4em;
    border-radius: 0.8em 0.3em;
    background: transparent;
    -webkit-box-decoration-break: clone;
    box-decoration-break: clone;
    cursor: pointer;
    transition: filter 0.15s ease;
  }

  .heatmap-run:hover {
    filter: brightness(0.88);
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

/* ─── Types ──────────────────────────────────────────────────────────────── */

type RGBA = { r: number; g: number; b: number; a: number };

type HeatToken =
  | { type: 'word'; text: string; total: number; likes: number; dislikes: number; color: RGBA | null }
  | { type: 'space'; text: string };

type RunGroup =
  | { type: 'run'; tokens: HeatToken[]; maxLikes: number; maxDislikes: number }
  | { type: 'text'; text: string };

/* ─── Pure helpers ───────────────────────────────────────────────────────── */

function colorForWord(maxLikes: number, maxDislikes: number): RGBA | null {
  const total = maxLikes + maxDislikes;
  if (total === 0) return null;

  const intensity = (maxLikes - maxDislikes) / total;
  const a = Math.min(0.28, 0.08 + total * 0.035);

  if (Math.abs(intensity) < 0.1) return { r: 140, g: 140, b: 140, a: a * 0.7 };
  if (intensity > 0) return { r: 34, g: 197, b: 94, a };
  return { r: 239, g: 68, b: 68, a };
}

function tokenizeText(
  text: string,
  charOffset: number,
  heatmap: Record<number, { likes: number; dislikes: number }>,
): HeatToken[] {
  const tokens: HeatToken[] = [];
  const parts = text.split(/(\s+)/);
  let pos = charOffset;

  for (const part of parts) {
    if (!part) continue;
    if (/^\s+$/.test(part)) {
      tokens.push({ type: 'space', text: part });
    } else {
      let maxL = 0, maxD = 0;
      for (let j = pos; j < pos + part.length; j++) {
        if (heatmap[j]) {
          maxL = Math.max(maxL, heatmap[j].likes);
          maxD = Math.max(maxD, heatmap[j].dislikes);
        }
      }
      const total = maxL + maxD;
      tokens.push({ type: 'word', text: part, total, likes: maxL, dislikes: maxD, color: colorForWord(maxL, maxD) });
    }
    pos += part.length;
  }
  return tokens;
}

function groupRuns(tokens: HeatToken[]): RunGroup[] {
  const groups: RunGroup[] = [];
  let i = 0;

  while (i < tokens.length) {
    const tok = tokens[i];
    const isHighlighted = tok.type === 'word' && tok.color !== null;

    if (isHighlighted) {
      const runTokens: HeatToken[] = [tok];
      i++;

      while (i < tokens.length) {
        const cur = tokens[i];

        if (cur.type === 'word' && cur.color !== null) {
          runTokens.push(cur);
          i++;
        } else if (cur.type === 'space') {
          // Include spaces only if the next non-space token is also highlighted
          let j = i + 1;
          while (j < tokens.length && tokens[j].type === 'space') j++;
          const nextHighlighted =
            j < tokens.length &&
            tokens[j].type === 'word' &&
            (tokens[j] as Extract<HeatToken, { type: 'word' }>).color !== null;
          if (nextHighlighted) {
            while (i < j) { runTokens.push(tokens[i]); i++; }
          } else {
            break;
          }
        } else {
          break;
        }
      }

      const wordTokens = runTokens.filter(t => t.type === 'word') as Extract<HeatToken, { type: 'word' }>[];
      const maxLikes = Math.max(...wordTokens.map(t => t.likes));
      const maxDislikes = Math.max(...wordTokens.map(t => t.dislikes));
      groups.push({ type: 'run', tokens: runTokens, maxLikes, maxDislikes });
    } else {
      let text = tok.text;
      i++;
      while (i < tokens.length) {
        const cur = tokens[i];
        if (cur.type === 'word' && cur.color !== null) break;
        text += cur.text;
        i++;
      }
      if (text) groups.push({ type: 'text', text });
    }
  }

  return groups;
}

function buildRunGradient(tokens: HeatToken[]): string {
  const totalLen = tokens.reduce((s, t) => s + t.text.length, 0);
  if (totalLen === 0) return 'none';

  const wordTokens = tokens.filter(
    t => t.type === 'word' && (t as Extract<HeatToken, { type: 'word' }>).color,
  ) as Extract<HeatToken, { type: 'word' }>[];
  if (wordTokens.length === 0) return 'none';

  const first = wordTokens[0];
  const last = wordTokens[wordTokens.length - 1];
  const stops: string[] = [];

  stops.push(`rgba(${first.color!.r},${first.color!.g},${first.color!.b},0) 0%`);

  let charPos = 0;
  for (const token of tokens) {
    if (token.type === 'word' && token.color) {
      const leftPct = (charPos / totalLen) * 100;
      const rightPct = ((charPos + token.text.length) / totalLen) * 100;
      const centerPct = (leftPct + rightPct) / 2;
      stops.push(
        `rgba(${token.color.r},${token.color.g},${token.color.b},${token.color.a.toFixed(2)}) ${centerPct.toFixed(1)}%`,
      );
    }
    charPos += token.text.length;
  }

  stops.push(`rgba(${last.color!.r},${last.color!.g},${last.color!.b},0) 100%`);
  return `linear-gradient(to right, ${stops.join(', ')})`;
}

/* ─── Component ──────────────────────────────────────────────────────────── */

interface LikesHeatmapViewProps {
  chapterText: string;
  chapterHtml: string;
  feedback: Feedback[];
}

export default function LikesHeatmapView({ chapterHtml, feedback }: LikesHeatmapViewProps) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; content: string } | null>(null);

  const heatmapData = useMemo(() => {
    const charMap: Record<number, { likes: number; dislikes: number }> = {};
    feedback
      .filter(f => f.feedbackType === 'like' || f.feedbackType === 'dislike')
      .forEach(item => {
        for (let i = item.snippetStart; i < item.snippetEnd; i++) {
          if (!charMap[i]) charMap[i] = { likes: 0, dislikes: 0 };
          if (item.feedbackType === 'like') charMap[i].likes++;
          else charMap[i].dislikes++;
        }
      });
    return charMap;
  }, [feedback]);

  const processHtmlWithHeatmap = (html: string): string => {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    let charPosition = 0;

    const processNode = (node: Node): Node => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent || '';
        const tokens = tokenizeText(text, charPosition, heatmapData);
        charPosition += text.length;

        const groups = groupRuns(tokens);

        if (groups.every(g => g.type === 'text')) {
          return node.cloneNode(true);
        }

        const fragment = document.createDocumentFragment();
        for (const group of groups) {
          if (group.type === 'text') {
            if (group.text) fragment.appendChild(document.createTextNode(group.text));
          } else {
            const span = document.createElement('span');
            span.className = 'heatmap-run';
            span.textContent = group.tokens.map(t => t.text).join('');
            span.dataset.total = (group.maxLikes + group.maxDislikes).toString();
            span.dataset.likes = group.maxLikes.toString();
            span.dataset.dislikes = group.maxDislikes.toString();
            span.style.backgroundImage = buildRunGradient(group.tokens);
            fragment.appendChild(span);
          }
        }
        return fragment;

      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as Element;
        const newElement = element.cloneNode(false) as Element;
        Array.from(element.childNodes).forEach(child => {
          newElement.appendChild(processNode(child));
        });
        return newElement;
      }

      return node.cloneNode(true);
    };

    const processed = document.createElement('div');
    Array.from(tempDiv.childNodes).forEach(child => {
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
    if (target.classList.contains('heatmap-run')) {
      const total = parseInt(target.dataset.total || '0');
      const likes = parseInt(target.dataset.likes || '0');
      const dislikes = parseInt(target.dataset.dislikes || '0');
      if (total > 0) {
        setTooltip({ x: e.clientX + 10, y: e.clientY + 10, content: `${likes} likes, ${dislikes} dislikes` });
      }
    }
  };

  const handleMouseOut = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('heatmap-run')) {
      setTooltip(null);
    }
  };

  return (
    <Container>
      <HeatmapChapterText
        html={processedHtml}
        onMouseOver={handleMouseOver}
        onMouseOut={handleMouseOut}
      />
      {tooltip && (
        <Tooltip $x={tooltip.x} $y={tooltip.y}>{tooltip.content}</Tooltip>
      )}
    </Container>
  );
}
