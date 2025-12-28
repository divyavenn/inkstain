# 📚 BookBeta

A minimal, open-source platform for collecting feedback on your writing. Perfect for authors seeking beta reader insights with A/B testing capabilities.

## ✨ Features

- **Clean Reading Experience**: Epub-reader-like interface for distraction-free reading
- **Inline Feedback**: Readers can highlight any passage and:
  - Like/dislike passages
  - Leave comments
  - Suggest edits
- **A/B Testing**: Test different versions of passages (database schema ready, UI coming soon)
- **Private Feedback**: Each reader's feedback is private; only the author sees all comments
- **Unique Reader Links**: Share a single link with all beta readers
- **Author Dashboard**: View and manage all feedback in one place
- **Self-Hosted**: No external dependencies - runs entirely on your own machine
- **Markdown-Based**: Write chapters as markdown files with frontmatter

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ installed
- npm or yarn

### Installation

1. Clone this repository:
```bash
git clone https://github.com/yourusername/bookbeta.git
cd bookbeta
```

2. Install dependencies:
```bash
npm install
```

3. Add your chapters as markdown files in the `chapters/` folder (see format below)

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000)

## 📝 Writing Chapters

Create markdown files in the `chapters/` directory with frontmatter:

```markdown
---
title: "Chapter 1: The Beginning"
order: 1
---

Your chapter content goes here in markdown format.

You can use **bold**, *italics*, and all other markdown features.

## Subheadings work too

> Blockquotes for emphasis
```

### Chapter Format

- **Filename**: Can be anything (e.g., `chapter-01.md`, `introduction.md`)
- **Frontmatter**:
  - `title`: The chapter title (required)
  - `order`: Numeric order for sorting chapters (required)
  - Add any other metadata you want

## 🎯 Usage

### For Authors

1. Add your manuscript chapters to the `chapters/` folder
2. Run `npm run dev`
3. Visit `/admin` to see your author dashboard
4. Share the `/read` link with your beta readers
5. Monitor feedback as it comes in

### For Readers

1. Click the shared link from the author
2. Optionally enter your name
3. Select any text to provide feedback:
   - 👍 Like - Quick positive feedback
   - 👎 Dislike - Quick critical feedback
   - 💬 Comment - Leave detailed thoughts
   - ✏️ Suggest Edit - Propose alternative wording

## 🛠️ Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Styled Components
- **Animations**: Framer Motion
- **Database**: SQLite (better-sqlite3)
- **Markdown**: marked + gray-matter

## 📁 Project Structure

```
bookbeta/
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   ├── read/              # Reader interface
│   ├── admin/             # Author dashboard
│   └── page.tsx           # Home page
├── components/            # React components
│   ├── ReaderView.tsx    # Main reader interface
│   ├── ChapterReader.tsx # Chapter reading view
│   ├── FeedbackPopover.tsx # Feedback UI
│   └── AuthorDashboard.tsx # Admin interface
├── lib/
│   ├── db/               # Database functions
│   └── chapters.ts       # Markdown parsing
├── types/                # TypeScript types
├── chapters/             # Your book chapters (markdown)
└── bookbeta.db          # SQLite database (auto-generated)
```

## 🔒 Privacy

- Reader feedback is stored locally in SQLite
- No external services or analytics
- Readers cannot see each other's comments
- Only the author can access the admin dashboard
- Reader IDs are generated client-side

## 🚧 Roadmap / Coming Soon

- [ ] A/B testing UI (schema is ready!)
- [ ] Export feedback as CSV/JSON
- [ ] Chapter-level feedback filtering
- [ ] Dark mode
- [ ] Authentication for author dashboard
- [ ] Email notifications for new feedback
- [ ] Reader progress tracking

## 🎨 Customization

### Styling

All components use styled-components. Edit component files in `components/` to customize the look and feel.

### Colors

Main color scheme:
- Primary: `#1a1a1a` (dark)
- Background: `#fafafa` (light gray)
- Highlight: `#ffe066` (yellow for text selection)

### Fonts

Default: Georgia, Merriweather, Times New Roman (serif stack)
Edit in `app/globals.css` to change.

## 🤝 Contributing

This is an open-source project! Contributions are welcome.

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

MIT License - feel free to use this for your own writing projects!

## 🐛 Troubleshooting

**Database errors**: Delete `bookbeta.db` and restart - it will regenerate

**Chapters not showing**: Make sure markdown files have valid frontmatter with `title` and `order`

**Build errors**: Try deleting `node_modules` and `.next`, then run `npm install` again

## 💡 Tips for Authors

1. **Start small**: Test with 1-2 chapters first
2. **Clear instructions**: Tell beta readers what kind of feedback you want
3. **Respond promptly**: Check the dashboard regularly
4. **Iterate**: Use feedback to refine your work
5. **Export backup**: Database is in `bookbeta.db` - back it up regularly

## 📧 Support

- Open an issue on GitHub
- Check existing issues for solutions
- Contribute improvements via PR

---

Built with ❤️ for writers by writers
