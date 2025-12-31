/**
 * Git error handling utilities
 * Provides graceful fallbacks when git is not available
 */

export class GitNotAvailableError extends Error {
  constructor(message: string = 'Git repository not available') {
    super(message);
    this.name = 'GitNotAvailableError';
  }
}

export class GitFileNotFoundError extends Error {
  constructor(filename: string) {
    super(`File not found in git: ${filename}`);
    this.name = 'GitFileNotFoundError';
  }
}

/**
 * Check if an error indicates git is not available
 */
export function isGitNotAvailable(error: unknown): boolean {
  if (error instanceof GitNotAvailableError) return true;

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes('not a git repository') ||
      message.includes('git not found') ||
      message.includes('command not found') ||
      message.includes('fatal: not a git repository')
    );
  }

  return false;
}

/**
 * Wrap git operations with graceful error handling
 */
export async function safeGitOperation<T>(
  operation: () => Promise<T>,
  fallbackValue: T
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (isGitNotAvailable(error)) {
      console.warn('Git not available, using fallback');
      return fallbackValue;
    }
    throw error;
  }
}
