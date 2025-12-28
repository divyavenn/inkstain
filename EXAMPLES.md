# Usage Examples

## Example Chapter Frontmatter

### Basic Chapter
```markdown
---
title: "Chapter 1: The Beginning"
order: 1
---

Your content here...
```

### Chapter with Additional Metadata
```markdown
---
title: "Chapter 3: The Turning Point"
order: 3
author: "Your Name"
date: "2024-01-15"
wordCount: 3500
tags: ["action", "romance"]
---

Your content here...
```

The system will automatically use `title` and `order`. Other fields are ignored but can be useful for your own organization.

## Markdown Formatting Examples

### Headings
```markdown
# Main Chapter Title
## Section Heading
### Subsection
```

### Text Styling
```markdown
**Bold text** for emphasis
*Italic text* for subtle emphasis
***Bold and italic*** for strong emphasis
`Code or special terms` in monospace
```

### Paragraphs
```markdown
First paragraph with regular text.

Second paragraph starts after a blank line.

Multiple paragraphs help break up content.
```

### Blockquotes
```markdown
> "The first draft is just you telling yourself the story."
> - Terry Pratchett

Great for epigraphs, quotes, or emphasis.
```

### Lists
```markdown
Unordered list:
- First item
- Second item
- Third item

Ordered list:
1. First step
2. Second step
3. Third step
```

### Scene Breaks
```markdown
---

Use horizontal rules for scene breaks or chapter endings.
```

## API Usage Examples

### Creating a Reader
```javascript
const response = await fetch('/api/reader', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'Jane Reader' })
});

const { reader } = await response.json();
// reader = { id: "abc123", name: "Jane Reader", createdAt: "..." }
```

### Fetching Chapters
```javascript
const response = await fetch('/api/chapters');
const { chapters } = await response.json();
// chapters = [{ id: 1, title: "...", order: 1, ... }]
```

### Getting Chapter Content
```javascript
const readerId = 'abc123';
const chapterId = 1;
const response = await fetch(`/api/chapters/${chapterId}?readerId=${readerId}`);
const data = await response.json();
// data = { chapter: {...}, content: "...", html: "...", abTests: [...], assignments: {...} }
```

### Submitting Feedback
```javascript
await fetch('/api/feedback', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    readerId: 'abc123',
    chapterId: 1,
    snippetText: 'The highlighted passage',
    snippetStart: 150,
    snippetEnd: 175,
    feedbackType: 'comment',
    comment: 'This passage was really engaging!'
  })
});
```

### Fetching All Feedback (Admin)
```javascript
const response = await fetch('/api/admin/feedback');
const { feedback } = await response.json();
// feedback = [{ id: 1, snippetText: "...", comment: "...", ... }]
```

### Fetching Chapter-Specific Feedback
```javascript
const response = await fetch('/api/admin/feedback?chapterId=1');
const { feedback } = await response.json();
```

## Database Query Examples

If you want to add custom database operations:

```typescript
import db from '@/lib/db';

// Get all readers
const readers = db.prepare(`
  SELECT * FROM readers
  ORDER BY created_at DESC
`).all();

// Get feedback stats for a chapter
const stats = db.prepare(`
  SELECT
    feedback_type,
    COUNT(*) as count
  FROM feedback
  WHERE chapter_id = ?
  GROUP BY feedback_type
`).all(chapterId);

// Get most liked passages
const topPassages = db.prepare(`
  SELECT
    snippet_text,
    COUNT(*) as likes
  FROM feedback
  WHERE feedback_type = 'like'
  GROUP BY snippet_text
  ORDER BY likes DESC
  LIMIT 10
`).all();
```

## Styled Components Examples

### Creating a New Component
```typescript
import styled from 'styled-components';

const MyComponent = styled.div`
  padding: 1rem;
  background: white;
  border-radius: 8px;

  &:hover {
    background: #f5f5f5;
  }
`;

// With props
const Button = styled.button<{ $primary?: boolean }>`
  background: ${props => props.$primary ? '#1a1a1a' : 'white'};
  color: ${props => props.$primary ? 'white' : '#1a1a1a'};
`;
```

### Using in Component
```typescript
export default function MyPage() {
  return (
    <MyComponent>
      <Button $primary>Primary Action</Button>
      <Button>Secondary Action</Button>
    </MyComponent>
  );
}
```

## Framer Motion Examples

### Page Transition
```typescript
import { motion } from 'framer-motion';

<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  exit={{ opacity: 0, y: -20 }}
  transition={{ duration: 0.3 }}
>
  Content here
</motion.div>
```

### Spring Animation
```typescript
<motion.div
  initial={{ scale: 0.9 }}
  animate={{ scale: 1 }}
  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
>
  Content with spring animation
</motion.div>
```

### Hover Effect
```typescript
<motion.button
  whileHover={{ scale: 1.05 }}
  whileTap={{ scale: 0.95 }}
>
  Click me
</motion.button>
```

## Common Customizations

### Changing the Color Scheme

Edit component files or create a theme:

```typescript
// lib/theme.ts
export const theme = {
  colors: {
    primary: '#1a1a1a',
    background: '#fafafa',
    text: '#2a2a2a',
    highlight: '#ffe066',
  },
  fonts: {
    body: 'Georgia, serif',
    heading: 'Helvetica, sans-serif',
  },
  spacing: {
    small: '0.5rem',
    medium: '1rem',
    large: '2rem',
  },
};
```

### Adding New Feedback Types

1. Update TypeScript type in `types/index.ts`:
```typescript
feedbackType: 'like' | 'dislike' | 'comment' | 'edit' | 'question';
```

2. Update database check in `lib/db/index.ts`:
```sql
CHECK(feedback_type IN ('like', 'dislike', 'comment', 'edit', 'question'))
```

3. Add UI button in `components/FeedbackPopover.tsx`

### Adding Authentication

Simple password protection for admin:

```typescript
// app/admin/page.tsx
'use client';

import { useState } from 'react';
import AuthorDashboard from '@/components/AuthorDashboard';

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState('');

  if (!authenticated) {
    return (
      <div>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button onClick={() => {
          if (password === 'your-secret-password') {
            setAuthenticated(true);
          }
        }}>
          Login
        </button>
      </div>
    );
  }

  return <AuthorDashboard />;
}
```

## Testing Checklist

When testing your installation:

- [ ] Server starts without errors
- [ ] Home page loads at `/`
- [ ] Can navigate to `/read`
- [ ] Can enter name and create reader
- [ ] Chapters appear in sidebar
- [ ] Can read chapter content
- [ ] Can select text
- [ ] Feedback popover appears on selection
- [ ] Can submit each type of feedback
- [ ] Can access admin dashboard at `/admin`
- [ ] Feedback appears in dashboard
- [ ] Can copy share link
- [ ] Share link works in new browser tab

## Troubleshooting Examples

### No chapters showing
```bash
# Check chapters directory
ls -la chapters/

# Verify markdown files have correct frontmatter
cat chapters/chapter-01.md
```

### Database errors
```bash
# Reset database
rm bookbeta.db

# Restart server - it will recreate
npm run dev
```

### Port already in use
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Or use different port
PORT=3001 npm run dev
```

---

For more examples, explore the codebase and the comprehensive README.md!
