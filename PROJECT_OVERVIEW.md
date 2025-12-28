# BookBeta - Project Overview

## What is BookBeta?

BookBeta is a minimal, open-source platform for authors to collect feedback on their writing from beta readers. It provides a beautiful, distraction-free reading experience with powerful feedback tools.

## Core Features Implemented

### ✅ Reader Experience
- **Epub-style Reader Interface**: Clean, focused reading environment
- **Text Selection & Highlighting**: Click and drag to select any passage
- **Inline Feedback Popover**: Beautiful animated feedback UI
- **Multiple Feedback Types**:
  - 👍 Like (quick positive feedback)
  - 👎 Dislike (quick critical feedback)
  - 💬 Comment (detailed thoughts)
  - ✏️ Suggest Edit (alternative wording)
- **Chapter Navigation**: Sidebar with smooth transitions
- **Unique Reader IDs**: Each reader gets a persistent ID
- **Optional Names**: Readers can identify themselves or stay anonymous

### ✅ Author Dashboard
- **Feedback Overview**: All reader feedback in one place
- **Statistics**: Total feedback, likes, dislikes, comments, edits
- **Detailed View**: See exact passages, comments, and suggestions
- **Share Links**: Easy copy-paste link for beta readers
- **Chapter Filtering**: View feedback by chapter (API ready)

### ✅ Technical Implementation
- **TypeScript + React**: Type-safe, modern development
- **Next.js 15**: App Router with API routes
- **Styled Components**: Component-scoped styling
- **Framer Motion**: Smooth, delightful animations
- **SQLite Database**: Local, self-contained storage
- **Markdown Support**: Write chapters in markdown with frontmatter
- **No External Dependencies**: Fully self-hosted

## Database Schema

### Tables

**readers**
- id (unique reader identifier)
- name (optional)
- created_at

**chapters**
- id
- filename
- title
- order
- created_at

**feedback**
- id
- reader_id
- chapter_id
- snippet_text (highlighted passage)
- snippet_start/end (character positions)
- feedback_type (like/dislike/comment/edit)
- comment
- suggested_edit
- ab_test_id (for A/B testing)
- ab_test_version
- created_at

**ab_tests** (ready for implementation)
- id
- chapter_id
- passage_id
- version_a
- version_b
- context
- created_at

**ab_test_assignments** (ready for implementation)
- id
- ab_test_id
- reader_id
- assigned_version (A or B)
- created_at

## File Structure

```
bookbeta/
├── app/
│   ├── api/
│   │   ├── chapters/          # Chapter CRUD
│   │   │   ├── route.ts       # List all chapters
│   │   │   └── [id]/route.ts  # Get specific chapter
│   │   ├── reader/            # Reader management
│   │   │   └── route.ts       # Create/get readers
│   │   ├── feedback/          # Feedback submission
│   │   │   └── route.ts       # POST feedback
│   │   └── admin/             # Admin endpoints
│   │       └── feedback/route.ts  # Get all feedback
│   ├── read/                  # Reader interface
│   │   └── page.tsx
│   ├── admin/                 # Author dashboard
│   │   └── page.tsx
│   ├── layout.tsx             # Root layout with styled-components
│   ├── page.tsx               # Home page
│   └── globals.css            # Global styles
│
├── components/
│   ├── ReaderView.tsx         # Main reader interface
│   ├── ChapterReader.tsx      # Chapter reading component
│   ├── FeedbackPopover.tsx    # Feedback UI popover
│   └── AuthorDashboard.tsx    # Admin dashboard
│
├── lib/
│   ├── db/
│   │   └── index.ts           # SQLite database functions
│   ├── chapters.ts            # Markdown parsing
│   └── registry.tsx           # Styled-components setup
│
├── types/
│   └── index.ts               # TypeScript interfaces
│
├── chapters/                  # Markdown chapter files
│   ├── chapter-01.md
│   └── chapter-02.md
│
├── package.json
├── tsconfig.json
├── next.config.js
├── .gitignore
├── README.md
├── QUICKSTART.md
├── CONTRIBUTING.md
└── PROJECT_OVERVIEW.md (this file)
```

## API Endpoints

### Public Endpoints

**GET /api/chapters**
- Returns list of all chapters
- Auto-syncs with markdown files

**GET /api/chapters/[id]?readerId={readerId}**
- Returns chapter content and metadata
- Includes A/B test assignments if readerId provided

**POST /api/reader**
- Creates new reader session
- Body: `{ name?: string }`
- Returns: `{ reader: { id, name, createdAt } }`

**POST /api/feedback**
- Submits reader feedback
- Body: `{ readerId, chapterId, snippetText, snippetStart, snippetEnd, feedbackType, comment?, suggestedEdit?, abTestId?, abTestVersion? }`

### Admin Endpoints

**GET /api/admin/feedback?chapterId={chapterId}**
- Returns all feedback (optionally filtered by chapter)

## Data Flow

### Reader Flow
1. Reader visits `/read`
2. Optionally enters name
3. System generates unique reader ID (stored in localStorage)
4. Reader selects chapter from sidebar
5. Chapter content fetched from `/api/chapters/[id]`
6. Reader highlights text
7. Feedback popover appears
8. Reader submits feedback
9. Feedback posted to `/api/feedback`

### Author Flow
1. Author visits `/admin`
2. Dashboard fetches feedback from `/api/admin/feedback`
3. Stats calculated client-side
4. Feedback displayed with filtering options

## Styling System

### Design Tokens

**Colors**
- Primary: `#1a1a1a` (dark gray/black)
- Background: `#fafafa` (light gray)
- Text: `#2a2a2a` (near black)
- Secondary Text: `#666` (gray)
- Highlight: `#ffe066` (yellow)
- Like: `#e8f5e9` / `#2e7d32` (green)
- Dislike: `#ffebee` / `#c62828` (red)
- Comment: `#e3f2fd` / `#1565c0` (blue)
- Edit: `#fff3e0` / `#ef6c00` (orange)

**Typography**
- Font Family: Georgia, Merriweather, Times New Roman (serif)
- Reading Size: 1.125rem
- Line Height: 1.8
- Heading Weight: 600-700

**Spacing**
- Container Max Width: 42rem (reader)
- Padding: 2-4rem
- Component Gap: 0.5-1rem

### Animation Principles
- Page transitions: 300ms
- Popovers: Spring animation (stiffness: 400, damping: 25)
- Buttons: 200ms ease
- Hover effects: translateY(-2px)

## A/B Testing (Ready for UI Implementation)

The database schema supports A/B testing:

1. **Create Test**: Author defines two versions of a passage
2. **Assignment**: Each reader randomly assigned version A or B
3. **Consistency**: Same reader always sees same version
4. **Feedback**: All feedback tagged with version
5. **Analysis**: Compare feedback between versions

**Implementation TODO**:
- Author UI to create A/B tests
- Reader UI to display assigned version
- Analytics to compare versions

## Security Considerations

### Current State
- No authentication (single author assumed)
- No rate limiting
- Local database only
- Reader IDs generated client-side

### Production Recommendations
- Add authentication for `/admin` routes
- Implement rate limiting on feedback API
- Add CSRF protection
- Sanitize all user input
- Consider adding admin password in environment variable

## Performance Optimizations

### Implemented
- SQLite WAL mode for better concurrency
- Indexed database queries
- Markdown parsing on demand
- Client-side caching of reader ID

### Future Considerations
- Server-side caching of rendered chapters
- Pagination for large feedback lists
- Lazy loading of chapters
- Optimistic UI updates

## Browser Compatibility

**Tested**:
- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)

**Requirements**:
- Modern browser with ES6+ support
- LocalStorage enabled
- JavaScript enabled

## Deployment Options

### Local (Current)
```bash
npm run dev
```
Access at http://localhost:3000

### Production Build
```bash
npm run build
npm start
```

### Self-Hosted Options
1. **VPS/Dedicated Server**: Run with PM2 or systemd
2. **Docker**: Create Dockerfile (not included)
3. **Raspberry Pi**: Perfect for home use

**Note**: Avoid serverless platforms (Vercel, Netlify) due to SQLite requirement

## Environment Variables

Currently none required! Everything works out of the box.

**Optional future additions**:
```env
ADMIN_PASSWORD=secret123
MAX_FEEDBACK_PER_HOUR=100
DATABASE_PATH=./custom/path/bookbeta.db
```

## Maintenance

### Database Backups
```bash
# Backup
cp bookbeta.db bookbeta.db.backup

# Restore
cp bookbeta.db.backup bookbeta.db
```

### Updating Chapters
1. Edit markdown files in `chapters/`
2. Update frontmatter if needed
3. Refresh browser - changes reflected immediately

### Clearing Data
```bash
# Clear all feedback (delete database)
rm bookbeta.db

# Server will recreate on next start
```

## Future Roadmap

### Phase 1 (Near Term)
- [ ] A/B testing UI
- [ ] Export feedback as CSV/JSON
- [ ] Chapter-level filtering in dashboard
- [ ] Dark mode

### Phase 2 (Medium Term)
- [ ] Authentication for admin
- [ ] Email notifications
- [ ] Reader progress tracking
- [ ] Markdown editor for chapters

### Phase 3 (Long Term)
- [ ] Multi-book support
- [ ] Collaborative features
- [ ] Analytics dashboard
- [ ] Mobile app

## Community & Support

- **GitHub**: Open issues and PRs
- **License**: MIT (use freely!)
- **Documentation**: Comprehensive README.md
- **Examples**: Sample chapters included

## Success Metrics

BookBeta is successful when:
1. Authors easily collect structured feedback
2. Readers enjoy the reading experience
3. Feedback quality is high and actionable
4. Setup takes < 5 minutes
5. Other authors can deploy it themselves

---

Built with ❤️ for the writing community
