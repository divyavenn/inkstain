'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import ChapterText from './ChapterText';
import { HeatmapLine } from './LikesHeatmapView';

const Container = styled.div`
  display: grid;
  grid-template-columns: 1fr 350px;
  gap: 2rem;
  max-width: 1200px;
  margin: 0 auto;
  height: calc(100vh - 400px);
  min-height: 600px;
`;

const TextPanel = styled.div`
  overflow-y: auto;
  padding: 0 2rem;
`;

const AnnotatedChapterText = styled(ChapterText)`
  user-select: text;
  max-width: 42rem;

  .feedback-block {
    cursor: pointer;
  }

  .line-highlight {
    border-radius: 0.8em 0.3em;
    margin: 0 -0.4em;
    padding: 0.1em 0.4em;
    background-color: transparent;
    -webkit-box-decoration-break: clone;
    box-decoration-break: clone;
    transition: background-image 0.15s ease;
  }

  .suggestion-preview {
    color: rgba(185, 40, 40, 0.9);
  }
`;

const CommentsPanel = styled.div`
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-left: 1px solid rgba(26,26,24,0.07);
  background: rgba(26,26,24,0.015);
`;

const CommentsPanelHeader = styled.div`
  padding: 1.25rem 1.25rem 0.75rem;
  border-bottom: 1px solid rgba(26,26,24,0.06);
`;

const CommentsTitle = styled.h3`
  font-family: var(--font-inter), system-ui, sans-serif;
  font-size: 0.65rem;
  font-weight: 500;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(26,26,24,0.35);
  margin: 0;
`;

const CommentsCount = styled.span`
  color: rgba(26,26,24,0.35);
  font-size: 0.65rem;
  font-weight: 400;
  margin-left: 0.4rem;
`;

const CommentsList = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 0;
`;

const CommentCard = styled(motion.div)<{ $isHovered: boolean; $isEdit?: boolean }>`
  padding: 1.1rem 1.25rem;
  border-bottom: 1px solid rgba(26,26,24,0.055);
  cursor: pointer;
  transition: background 0.15s ease;
  background: ${p => p.$isHovered ? 'rgba(26,26,24,0.035)' : 'transparent'};
  border-left: 2px solid ${p => p.$isHovered
    ? (p.$isEdit ? 'rgba(185,120,40,0.6)' : 'rgba(80,100,200,0.45)')
    : 'transparent'};
  &:hover { background: rgba(26,26,24,0.025); }
`;

const SnippetText = styled.div`
  font-family: var(--font-playfair), Georgia, serif;
  font-style: italic;
  font-size: 0.82rem;
  color: rgba(26,26,24,0.55);
  margin-bottom: 0.5rem;
  line-height: 1.5;
`;

const CommentBody = styled.div`
  font-family: var(--font-inter), system-ui, sans-serif;
  font-size: 0.85rem;
  color: #1a1a18;
  line-height: 1.55;
  margin-bottom: 0.5rem;
`;

const EditSuggestion = styled.div`
  font-family: var(--font-inter), system-ui, sans-serif;
  font-size: 0.82rem;
  color: rgba(26,26,24,0.7);
  margin-bottom: 0.5rem;
  line-height: 1.5;
  border-left: 2px solid rgba(185,120,40,0.5);
  padding-left: 0.75rem;
`;

const CommentMeta = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-family: var(--font-inter), system-ui, sans-serif;
  font-size: 0.68rem;
  color: rgba(26,26,24,0.32);
  gap: 0.5rem;
  margin-top: 0.25rem;
`;

const ReaderBadge = styled.span`
  font-size: 0.68rem;
  color: rgba(26,26,24,0.45);
  font-weight: 500;
  letter-spacing: 0.02em;
`;

const LineBadge = styled.span`
  font-size: 0.65rem;
  color: rgba(26,26,24,0.28);
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 3rem 1.5rem;
  color: rgba(26,26,24,0.3);
  font-family: var(--font-inter), system-ui, sans-serif;
  font-size: 0.82rem;
`;

export interface DashComment {
  id: string;
  start_line: number;
  end_line: number;
  body: string;
  char_start: number | null;
  char_length: number | null;
  created_at: string;
  reader_name: string | null;
  reader_slug: string | null;
}

export interface DashSuggestion {
  id: string;
  start_line: number;
  end_line: number;
  original_text: string;
  suggested_text: string;
  rationale: string | null;
  char_start: number | null;
  char_length: number | null;
  created_at: string;
  reader_name: string | null;
}

type Item =
  | { kind: 'comment'; data: DashComment }
  | { kind: 'suggestion'; data: DashSuggestion };

interface CommentsViewProps {
  chapterHtml: string;
  comments: DashComment[];
  suggestions: DashSuggestion[];
  heatmapLines: HeatmapLine[];
}

function charWrap(
  div: HTMLElement,
  charIdx: number,
  length: number,
  makeEl: () => HTMLElement,
): void {
  let charPos = 0;
  const walk = (node: Node): boolean => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || '';
      const start = charIdx - charPos;
      const end = start + length;
      if (start >= 0 && end <= text.length) {
        const el = makeEl();
        el.textContent = text.slice(start, end);
        const before = document.createTextNode(text.slice(0, start));
        const after = document.createTextNode(text.slice(end));
        node.parentNode?.insertBefore(before, node);
        node.parentNode?.insertBefore(el, node);
        node.parentNode?.insertBefore(after, node);
        node.parentNode?.removeChild(node);
        return true;
      }
      charPos += text.length;
    } else {
      for (const child of Array.from(node.childNodes)) {
        if (walk(child)) return true;
      }
    }
    return false;
  };
  walk(div);
}

function processHtml(
  html: string,
  contentLines: HeatmapLine[],
  comments: DashComment[],
  suggestions: DashSuggestion[],
  hoveredPanelId: string | null,
  hoveredMarkIds: string[],
  pinnedItemIds: string[] | null,
  previewSuggId: string | null,
): string {
  if (typeof window === 'undefined') return html;
  const div = document.createElement('div');
  div.innerHTML = html;
  const fullText = div.textContent || '';

  const [r, g, b] = [255, 225, 0];
  const gradient = (op: number) =>
    `linear-gradient(to right, rgba(${r},${g},${b},${(op * 0.14).toFixed(2)}), rgba(${r},${g},${b},${op.toFixed(2)}) 4%, rgba(${r},${g},${b},${(op * 0.43).toFixed(2)}))`;

  // Group comments by unique line range, wrap each range once
  const grouped = new Map<string, string[]>(); // "start-end" → comment ids
  for (const c of comments) {
    const key = `${c.start_line}-${c.end_line}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(c.id);
  }

  for (const [key, ids] of grouped) {
    const [startLine, endLine] = key.split('-').map(Number);

    // Use stored char_start if available; otherwise fall back to indexOf
    const representative = comments.find(c => c.start_line === startLine && c.end_line === endLine);
    let charIdx: number;
    let searchLength: number;
    if (representative?.char_start != null && representative?.char_length != null) {
      charIdx = representative.char_start;
      searchLength = representative.char_length;
    } else {
      const rangeLines = contentLines.filter(l => l.lineNumber >= startLine && l.lineNumber <= endLine);
      if (rangeLines.length === 0) continue;
      const searchText = rangeLines.map(l => l.lineText).join(' ');
      charIdx = fullText.indexOf(searchText);
      if (charIdx === -1) continue;
      searchLength = searchText.length;
    }

    // Opacity: panel hover dims all except the hovered item's mark;
    // text hover/pin dims all except the active mark
    let op: number;
    if (hoveredPanelId !== null) {
      op = ids.includes(hoveredPanelId) ? 0.85 : 0;
    } else if (pinnedItemIds !== null) {
      op = ids.some(id => pinnedItemIds.includes(id)) ? 0.85 : 0.3;
    } else if (hoveredMarkIds.length > 0) {
      op = ids.some(id => hoveredMarkIds.includes(id)) ? 0.85 : 0.3;
    } else {
      op = 0.55;
    }

    if (op === 0) continue;

    charWrap(div, charIdx, searchLength, () => {
      const mark = document.createElement('mark');
      mark.className = 'line-highlight feedback-block';
      mark.style.backgroundImage = gradient(op);
      mark.dataset.itemIds = ids.join(',');
      return mark;
    });
  }

  // Inline edit preview: same charWrap mechanism
  if (previewSuggId !== null) {
    const s = suggestions.find(s => s.id === previewSuggId);
    if (s?.original_text) {
      const idx = s.char_start ?? (div.textContent || '').indexOf(s.original_text);
      const len = s.char_length ?? s.original_text.length;
      if (idx !== -1) {
        charWrap(div, idx, len, () => {
          const span = document.createElement('span');
          span.className = 'suggestion-preview';
          span.textContent = s.suggested_text;
          return span;
        });
      }
    }
  }

  return div.innerHTML;
}

export default function CommentsView({ chapterHtml, comments, suggestions, heatmapLines }: CommentsViewProps) {
  const [hoveredPanelId, setHoveredPanelId] = useState<string | null>(null);
  const textPanelRef = useRef<HTMLDivElement>(null);
  const [hoveredMarkIds, setHoveredMarkIds] = useState<string[]>([]);
  const [pinnedItemIds, setPinnedItemIds] = useState<string[] | null>(null);
  const [previewSuggId, setPreviewSuggId] = useState<string | null>(null);

  const contentLines = useMemo(
    () => heatmapLines.filter(l => l.lineText.trim() !== ''),
    [heatmapLines],
  );

  const items: Item[] = useMemo(() => {
    const all: Item[] = [
      ...comments.map(c => ({ kind: 'comment' as const, data: c })),
      ...suggestions.map(s => ({ kind: 'suggestion' as const, data: s })),
    ];
    return all.sort((a, b) => a.data.start_line - b.data.start_line);
  }, [comments, suggestions]);

  // Filter panel to the mark under cursor / pinned mark (pinned takes priority)
  const activeIds = pinnedItemIds ?? (hoveredMarkIds.length > 0 ? hoveredMarkIds : null);
  const visibleItems = useMemo(() => {
    if (!activeIds) return items;
    return items.filter(item => activeIds.includes(item.data.id));
  }, [items, activeIds]);

  // Scroll text panel to the mark containing the hovered panel item
  useEffect(() => {
    if (!hoveredPanelId || !textPanelRef.current) return;
    const marks = Array.from(textPanelRef.current.querySelectorAll('[data-item-ids]'));
    const mark = marks.find(m =>
      (m as HTMLElement).dataset.itemIds!.split(',').includes(hoveredPanelId),
    );
    mark?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [hoveredPanelId]);

  const processedHtml = useMemo(
    () => processHtml(chapterHtml, contentLines, comments, suggestions, hoveredPanelId, hoveredMarkIds, pinnedItemIds, previewSuggId),
    [chapterHtml, contentLines, comments, suggestions, hoveredPanelId, hoveredMarkIds, pinnedItemIds, previewSuggId],
  );

  const handleTextMouseOver = (e: React.MouseEvent) => {
    const mark = (e.target as HTMLElement).closest('[data-item-ids]') as HTMLElement | null;
    setHoveredMarkIds(mark ? mark.dataset.itemIds!.split(',') : []);
  };

  const handleTextMouseOut = (e: React.MouseEvent) => {
    if (!(e.relatedTarget as HTMLElement)?.closest?.('[data-item-ids]')) {
      setHoveredMarkIds([]);
    }
  };

  const handleTextClick = (e: React.MouseEvent) => {
    const mark = (e.target as HTMLElement).closest('[data-item-ids]') as HTMLElement | null;
    if (mark) {
      const ids = mark.dataset.itemIds!.split(',');
      setPinnedItemIds(prev =>
        prev !== null && prev.length === ids.length && ids.every(id => prev.includes(id)) ? null : ids,
      );
    } else {
      setPinnedItemIds(null);
    }
  };

  return (
    <Container>
      <TextPanel ref={textPanelRef}>
        <AnnotatedChapterText
          html={processedHtml}
          onMouseOver={handleTextMouseOver}
          onMouseOut={handleTextMouseOut}
          onClick={handleTextClick}
        />
      </TextPanel>

      <CommentsPanel>
        <CommentsPanelHeader>
          <CommentsTitle>
            Comments & Edits
            <CommentsCount>
              {visibleItems.length}
              {activeIds !== null && visibleItems.length !== items.length ? ` / ${items.length}` : ''}
            </CommentsCount>
          </CommentsTitle>
        </CommentsPanelHeader>

        <CommentsList>
          {items.length === 0 ? (
            <EmptyState>No comments or edits yet</EmptyState>
          ) : visibleItems.length === 0 ? (
            <EmptyState>No feedback on this line</EmptyState>
          ) : (
            visibleItems.map((item, index) => {
              const isEdit = item.kind === 'suggestion';
              const id = item.data.id;
              const isHovered = hoveredPanelId === id;
              const readerName = item.data.reader_name;
              const line = `L${item.data.start_line}${item.data.end_line !== item.data.start_line ? `–${item.data.end_line}` : ''}`;

              return (
                <CommentCard
                  key={id}
                  $isHovered={isHovered}
                  $isEdit={isEdit}
                  onMouseEnter={() => {
                    setHoveredPanelId(id);
                    if (isEdit) setPreviewSuggId(id);
                  }}
                  onMouseLeave={() => {
                    setHoveredPanelId(null);
                    setPreviewSuggId(null);
                  }}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.04 }}
                >
                  {isEdit ? (
                    <>
                      <SnippetText>"{(item.data as DashSuggestion).original_text}"</SnippetText>
                      <EditSuggestion>→ "{(item.data as DashSuggestion).suggested_text}"</EditSuggestion>
                      {(item.data as DashSuggestion).rationale && (
                        <CommentBody>{(item.data as DashSuggestion).rationale}</CommentBody>
                      )}
                    </>
                  ) : (
                    <CommentBody>{(item.data as DashComment).body}</CommentBody>
                  )}
                  <CommentMeta>
                    <ReaderBadge>{readerName || 'Anonymous'}</ReaderBadge>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                      <LineBadge>{line}</LineBadge>
                      <span>{new Date(item.data.created_at).toLocaleDateString()}</span>
                    </div>
                  </CommentMeta>
                </CommentCard>
              );
            })
          )}
        </CommentsList>
      </CommentsPanel>
    </Container>
  );
}
