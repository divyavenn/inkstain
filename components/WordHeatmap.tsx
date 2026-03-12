'use client';

import React from 'react';

interface Word {
  text: string;
  good: boolean;
  opacity: number;
}

interface WordHeatmapProps {
  words: Word[];
  className?: string;
}

const GREEN: [number, number, number] = [34, 197, 94];
const RED: [number, number, number] = [239, 68, 68];

function getColor(good: boolean): [number, number, number] {
  return good ? GREEN : RED;
}

function findNeighborOpacity(words: Word[], index: number, direction: 'left' | 'right'): number {
  const step = direction === 'left' ? -1 : 1;
  let i = index + step;
  while (i >= 0 && i < words.length) {
    if (words[i].opacity > 0) return words[i].opacity;
    // If we hit a non-highlighted word, stop — no blending across gaps
    return 0;
    i += step;
  }
  return 0;
}

export default function WordHeatmap({ words, className }: WordHeatmapProps) {
  return (
    <span className={className}>
      {words.map((word, i) => {
        if (word.opacity === 0) {
          return <span key={i}>{word.text}</span>;
        }

        const [r, g, b] = getColor(word.good);
        const op = word.opacity;

        // Find direct neighbors (skip whitespace-only tokens by checking opacity)
        const leftNeighborOp = findNeighborOpacity(words, i, 'left');
        const rightNeighborOp = findNeighborOpacity(words, i, 'right');

        const hasLeft = leftNeighborOp > 0;
        const hasRight = rightNeighborOp > 0;

        const leftEdge = hasLeft ? (op + leftNeighborOp) / 2 : 0;
        const rightEdge = hasRight ? (op + rightNeighborOp) / 2 : 0;

        const peak = op * 0.75;

        const gradient = [
          `linear-gradient(to right,`,
          `rgba(${r},${g},${b},${leftEdge.toFixed(2)}),`,
          `rgba(${r},${g},${b},${peak.toFixed(2)}) 20%,`,
          `rgba(${r},${g},${b},${peak.toFixed(2)}) 80%,`,
          `rgba(${r},${g},${b},${rightEdge.toFixed(2)})`,
          `)`,
        ].join(' ');

        // Round only the outer edges of each highlighted run
        const tl = hasLeft ? '0' : '0.8em';
        const tr = hasRight ? '0' : '0.3em';
        const br = hasRight ? '0' : '0.8em';
        const bl = hasLeft ? '0' : '0.3em';

        return (
          <span
            key={i}
            style={{
              display: 'inline',
              margin: '0 -0.4em',
              padding: '0.1em 0.4em',
              borderRadius: `${tl} ${tr} ${br} ${bl}`,
              backgroundImage: gradient,
              WebkitBoxDecorationBreak: 'clone',
              boxDecorationBreak: 'clone' as React.CSSProperties['boxDecorationBreak'],
            }}
          >
            {word.text}
          </span>
        );
      })}
    </span>
  );
}
