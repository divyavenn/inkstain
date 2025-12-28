# Contributing to BookBeta

Thanks for your interest in contributing to BookBeta! This guide will help you get started.

## How to Contribute

### Reporting Bugs

If you find a bug:
1. Check if it's already reported in Issues
2. If not, create a new issue with:
   - Clear description of the problem
   - Steps to reproduce
   - Expected vs actual behavior
   - Your environment (OS, Node version, etc.)

### Suggesting Features

Have an idea? Open an issue with:
- Clear description of the feature
- Use case / why it's needed
- Possible implementation approach (optional)

### Contributing Code

1. **Fork the repository**
2. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make your changes**
   - Follow the existing code style
   - Add comments for complex logic
   - Keep changes focused and atomic

4. **Test your changes**
   ```bash
   npm run dev
   # Test manually in the browser
   ```

5. **Commit your changes**
   ```bash
   git add .
   git commit -m "Add: Brief description of your change"
   ```

6. **Push and create a PR**
   ```bash
   git push origin feature/your-feature-name
   ```
   Then create a Pull Request on GitHub

## Code Style

- **TypeScript**: Use proper types, avoid `any`
- **React**: Use functional components with hooks
- **Styled Components**: Keep styles colocated with components
- **Comments**: Explain the "why", not the "what"
- **File naming**: Use PascalCase for components, camelCase for utilities

## Project Structure

```
bookbeta/
├── app/              # Next.js routes and pages
├── components/       # React components
├── lib/              # Utilities and helpers
│   ├── db/          # Database functions
│   └── chapters.ts  # Markdown parsing
├── types/           # TypeScript types
└── chapters/        # Sample markdown chapters
```

## Priority Areas for Contribution

### High Priority
- [ ] A/B testing UI implementation
- [ ] Export feedback to CSV/JSON
- [ ] Authentication for admin dashboard
- [ ] Dark mode support

### Medium Priority
- [ ] Email notifications
- [ ] Reader progress tracking
- [ ] Better mobile experience
- [ ] Chapter version history

### Nice to Have
- [ ] Multi-book support
- [ ] Collaborative editing
- [ ] Rich text editor for chapters
- [ ] Analytics dashboard

## Development Tips

### Running Locally
```bash
npm install
npm run dev
```

### Database
- SQLite database at `bookbeta.db`
- Schema in `lib/db/index.ts`
- Delete DB file to reset

### Adding New Features

1. **API Routes**: Add to `app/api/`
2. **UI Components**: Add to `components/`
3. **Database**: Modify `lib/db/index.ts`
4. **Types**: Update `types/index.ts`

## Testing Guidelines

Currently, we rely on manual testing. When adding features:

1. Test all user flows
2. Check both reader and author views
3. Verify database operations
4. Test with multiple chapters
5. Check responsive design

## Questions?

- Open an issue for questions
- Tag with "question" label
- Check existing issues first

## Code of Conduct

- Be respectful and constructive
- Welcome newcomers
- Focus on the code, not the person
- Help others learn and grow

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for making BookBeta better! 🙏
