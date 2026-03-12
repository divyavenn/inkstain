'use client';

import React from 'react';

export type HighlightColor = 'yellow' | 'green' | 'red' | 'indigo' | 'amber';

const COLOR_RGB: Record<HighlightColor, [number, number, number]> = {
  yellow:  [255, 225, 0],
  green:   [34,  197, 94],
  red:     [239, 68,  68],
  indigo:  [99,  102, 241],
  amber:   [245, 158, 11],
};

interface HighlighterProps {
  color?: HighlightColor;
  /** Peak opacity of the gradient (0–1). Default 0.7 */
  opacity?: number;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Realistic marker-pen highlight using a left-to-right gradient with:
 * - asymmetric border-radius (pen angle variation)
 * - negative margin / positive padding (overdraw effect)
 * - box-decoration-break: clone (correct multi-line behaviour)
 */
export default function Highlighter({
  color = 'yellow',
  opacity = 0.7,
  children,
  className,
  style,
}: HighlighterProps) {
  const [r, g, b] = COLOR_RGB[color];

  const gradient = `linear-gradient(
    to right,
    rgba(${r}, ${g}, ${b}, ${+(opacity * 0.14).toFixed(2)}),
    rgba(${r}, ${g}, ${b}, ${+opacity.toFixed(2)}) 4%,
    rgba(${r}, ${g}, ${b}, ${+(opacity * 0.43).toFixed(2)})
  )`;

  return (
    <mark
      className={className}
      style={{
        margin: '0 -0.4em',
        padding: '0.1em 0.4em',
        borderRadius: '0.8em 0.3em',
        background: 'transparent',
        backgroundImage: gradient,
        WebkitBoxDecorationBreak: 'clone',
        boxDecorationBreak: 'clone',
        ...style,
      }}
    >
      {children}
    </mark>
  );
}
