/**
 * Char-position utilities for anchoring feedback to rendered HTML.
 *
 * `char_start` / `char_length` mirror what the browser's `div.textContent`
 * would give, so the frontend can use stored values directly without re-computing.
 */

/** Replicates browser div.textContent: strip tags, decode basic entities. */
export function htmlToTextContent(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, '\u00a0');
}

/** Char position for any feedback anchored to a specific selected text span. */
export function feedbackCharPos(
  renderedHtml: string,
  selectedText: string,
): { charStart: number; charLength: number } | null {
  const textContent = htmlToTextContent(renderedHtml);
  const charStart = textContent.indexOf(selectedText);
  if (charStart === -1) return null;
  return { charStart, charLength: selectedText.length };
}
