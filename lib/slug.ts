export function titleToSlug(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'default';
}

export function getWorkSlug(): string {
  return titleToSlug(process.env.TITLE || 'default');
}
