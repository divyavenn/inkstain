'use client';

import { useState, useMemo } from 'react';
import styled from 'styled-components';
import ChapterText from './ChapterText';

const Container = styled.div`
  max-width: 42rem;
  margin: 0 auto;
`;

const HeatmapChapterText = styled(ChapterText)`
  .hw, .hw-gap {
    padding: 0.1em 0;
    transition: filter 0.12s ease;
    cursor: default;
  }
  .hw:hover, .hw:hover + .hw-gap, .hw-gap:has(+ .hw:hover) {
    filter: brightness(0.82);
  }
`;

const Tooltip = styled.div.attrs<{ $x: number; $y: number }>(p => ({
  style: { left: `${p.$x}px`, top: `${p.$y}px` },
}))`
  position: fixed;
  background: rgba(0,0,0,0.9);
  color: white;
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  font-size: 0.875rem;
  pointer-events: none;
  z-index: 1000;
  white-space: nowrap;
`;

export interface HeatmapWord {
  wordIndex: number;
  word: string;
  charStart: number | null;
  charLength: number | null;
  likeCount: number;
  dislikeCount: number;
  netScore: number;
  commentCount: number;
}

// Keep backward compat with line-based shape still used for reader reach
export interface HeatmapLine {
  lineNumber: number;
  lineText: string;
  likeCount: number;
  dislikeCount: number;
  commentCount: number;
  readerReachPercent: number;
}

interface LikesHeatmapViewProps {
  chapterHtml: string;
  heatmapLines: HeatmapLine[];
  words?: HeatmapWord[];
}

function wordColor(netScore: number, maxAbs: number): string | null {
  if (maxAbs === 0 || (netScore === 0)) return null;
  const intensity = Math.abs(netScore) / maxAbs;
  const a = Math.min(0.5, 0.06 + intensity * 0.44);
  return netScore > 0
    ? `rgba(80,200,80,${a.toFixed(2)})`
    : `rgba(200,80,80,${a.toFixed(2)})`;
}

function extractAlpha(colorStr: string): number {
  const m = colorStr.match(/[\d.]+(?=\))/);
  return m ? parseFloat(m[0]) : 1;
}

// After inserting .hw spans, color the whitespace between consecutive highlighted
// words and round only the outer edges of each run.
function blendRunGaps(root: Element): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const gaps: Text[] = [];
  let n: Text | null;
  while ((n = walker.nextNode() as Text | null)) {
    if (/^\s+$/.test(n.textContent ?? '')) gaps.push(n);
  }

  for (const gap of gaps) {
    const prev = gap.previousSibling as HTMLElement | null;
    const next = gap.nextSibling as HTMLElement | null;
    if (
      prev?.classList?.contains('hw') && prev.style.backgroundColor &&
      next?.classList?.contains('hw') && next.style.backgroundColor
    ) {
      const span = document.createElement('span');
      span.className = 'hw-gap';
      span.textContent = gap.textContent;
      // Use the dimmer (lower-alpha) of the two adjacent colors for the gap
      span.style.backgroundColor =
        extractAlpha(prev.style.backgroundColor) <= extractAlpha(next.style.backgroundColor)
          ? prev.style.backgroundColor
          : next.style.backgroundColor;
      gap.parentNode!.replaceChild(span, gap);
    }
  }

  // Apply border-radius only at run boundaries
  for (const el of Array.from(root.querySelectorAll('.hw')) as HTMLElement[]) {
    const prev = el.previousSibling as HTMLElement | null;
    const next = el.nextSibling as HTMLElement | null;
    const hasLeft  = prev?.classList?.contains('hw-gap') || prev?.classList?.contains('hw');
    const hasRight = next?.classList?.contains('hw-gap') || next?.classList?.contains('hw');
    if (hasLeft && hasRight)       el.style.borderRadius = '0';
    else if (hasLeft)              el.style.borderRadius = '0 3px 3px 0';
    else if (hasRight)             el.style.borderRadius = '3px 0 0 3px';
    else                           el.style.borderRadius = '3px';
  }
}

function applyWordHeatmap(html: string, words: HeatmapWord[]): string {
  if (typeof window === 'undefined') return html;

  const maxAbs = Math.max(...words.map(w => Math.abs(w.netScore)), 1);

  const div = document.createElement('div');
  div.innerHTML = html;

  // Build a map of charStart → word data
  const wordMap = new Map<number, HeatmapWord>();
  for (const w of words) {
    if (w.charStart != null && w.charLength != null && (w.likeCount + w.dislikeCount + w.commentCount > 0)) {
      wordMap.set(w.charStart, w);
    }
  }

  let charPos = 0;

  const walk = (node: Node): void => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || '';
      const fragments: Node[] = [];
      let localPos = 0;

      // Split text into words and spaces, wrapping matching words
      const parts = text.split(/(\s+)/);
      for (const part of parts) {
        const globalPos = charPos + localPos;
        const wd = wordMap.get(globalPos);
        if (wd && part.trim() && wd.charLength === part.length) {
          const color = wordColor(wd.netScore, maxAbs);
          const span = document.createElement('span');
          span.className = 'hw';
          span.textContent = part;
          if (color) span.style.backgroundColor = color;
          span.dataset.likes = String(wd.likeCount);
          span.dataset.dislikes = String(wd.dislikeCount);
          span.dataset.comments = String(wd.commentCount);
          span.dataset.wordIndex = String(wd.wordIndex);
          fragments.push(span);
        } else {
          fragments.push(document.createTextNode(part));
        }
        localPos += part.length;
      }

      if (fragments.length > 0 && fragments.some(f => f.nodeType !== Node.TEXT_NODE)) {
        const parent = node.parentNode;
        if (parent) {
          for (const frag of fragments) {
            parent.insertBefore(frag, node);
          }
          parent.removeChild(node);
        }
      }

      charPos += text.length;
    } else {
      for (const child of Array.from(node.childNodes)) {
        walk(child);
      }
    }
  };

  walk(div);
  blendRunGaps(div);
  return div.innerHTML;
}

function applyLineHeatmap(html: string, lines: HeatmapLine[]): string {
  if (typeof window === 'undefined') return html;
  const div = document.createElement('div');
  div.innerHTML = html;
  const blocks = Array.from(div.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, blockquote'));
  const contentLines = lines.filter(l => l.lineText.trim() !== '');
  blocks.forEach((block, i) => {
    const line = contentLines[i];
    if (!line) return;
    const el = block as HTMLElement;
    el.classList.add('heatmap-block');
    const total = line.likeCount + line.dislikeCount;
    if (total > 0) {
      const a = Math.min(0.28, 0.07 + total * 0.035);
      const intensity = (line.likeCount - line.dislikeCount) / total;
      const color = Math.abs(intensity) < 0.1
        ? `rgba(140,140,140,${(a * 0.7).toFixed(2)})`
        : intensity > 0 ? `rgba(34,197,94,${a.toFixed(2)})` : `rgba(239,68,68,${a.toFixed(2)})`;
      el.style.backgroundColor = color;
    }
    el.dataset.likes = String(line.likeCount);
    el.dataset.dislikes = String(line.dislikeCount);
    el.dataset.comments = String(line.commentCount);
  });
  return div.innerHTML;
}

export default function LikesHeatmapView({ chapterHtml, heatmapLines, words }: LikesHeatmapViewProps) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; content: string } | null>(null);

  const processedHtml = useMemo(() => {
    if (words && words.length > 0) {
      return applyWordHeatmap(chapterHtml, words);
    }
    return applyLineHeatmap(chapterHtml, heatmapLines);
  }, [chapterHtml, heatmapLines, words]);

  const handleMouseOver = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    // For gap spans, use the nearest adjacent .hw sibling for data
    let el: HTMLElement | null = target.closest('.hw') ?? target.closest('.heatmap-block');
    if (!el && (target as HTMLElement).classList?.contains('hw-gap')) {
      el = (target.previousSibling as HTMLElement | null)?.classList?.contains('hw')
        ? target.previousSibling as HTMLElement
        : target.nextSibling as HTMLElement | null;
    }
    if (!el) return;

    const likes = parseInt(el.dataset.likes || '0');
    const dislikes = parseInt(el.dataset.dislikes || '0');
    const comments = parseInt(el.dataset.comments || '0');
    if (likes + dislikes + comments === 0) return;

    const parts: string[] = [];
    if (likes > 0) parts.push(`${likes} like${likes !== 1 ? 's' : ''}`);
    if (dislikes > 0) parts.push(`${dislikes} dislike${dislikes !== 1 ? 's' : ''}`);
    if (comments > 0) parts.push(`${comments} comment${comments !== 1 ? 's' : ''}`);
    setTooltip({ x: e.clientX + 10, y: e.clientY + 10, content: parts.join(', ') });
  };

  const handleMouseOut = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('.hw') || target.closest('.heatmap-block') || target.classList?.contains('hw-gap')) setTooltip(null);
  };

  return (
    <Container>
      <HeatmapChapterText html={processedHtml} onMouseOver={handleMouseOver} onMouseOut={handleMouseOut} />
      {tooltip && <Tooltip $x={tooltip.x} $y={tooltip.y}>{tooltip.content}</Tooltip>}
    </Container>
  );
}
