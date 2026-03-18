'use client';

import styled from 'styled-components';

const StyledChapterText = styled.div`
  line-height: 1.6;
  font-size: 1.125rem;
  color: #2a2a2a;
  position: relative;

  p {
    margin-bottom: 1rem;
  }

  h1, h2, h3, h4, h5, h6 {
    margin-top: 1.5rem;
    margin-bottom: 0.75rem;
    font-weight: 600;
    color: #1a1a1a;
  }

  h1 {
    font-size: 2rem;
  }

  h2 {
    font-size: 1.75rem;
  }

  h3 {
    font-size: 1.5rem;
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
    font-size: 0.9em;
  }

  pre {
    background: #f5f5f5;
    padding: 1rem;
    border-radius: 6px;
    overflow-x: auto;
    margin: 1rem 0;
  }

  pre code {
    background: none;
    padding: 0;
  }

  ul, ol {
    margin: 1rem 0;
    padding-left: 2rem;
  }

  li {
    margin-bottom: 0.5rem;
  }

  a {
    color: #1976d2;
    text-decoration: underline;
  }

  hr {
    border: none;
    border-top: 1px solid #e0e0e0;
    margin: 2rem 0;
  }
`;

interface ChapterTextProps {
  html: string;
  className?: string;
  onMouseUp?: (e: React.MouseEvent) => void;
  onClick?: (e: React.MouseEvent) => void;
  onMouseOver?: (e: React.MouseEvent) => void;
  onMouseOut?: (e: React.MouseEvent) => void;
}

export default function ChapterText({ html, className, onMouseUp, onClick, onMouseOver, onMouseOut }: ChapterTextProps) {
  return (
    <StyledChapterText
      className={className}
      onMouseUp={onMouseUp}
      onClick={onClick}
      onMouseOver={onMouseOver}
      onMouseOut={onMouseOut}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
