import { LRUCache } from 'lru-cache';
import { LogResult } from 'simple-git';

const gitLogCache = new LRUCache<string, LogResult>({
  max: 100,
  ttl: 10_000,
});

const fileContentCache = new LRUCache<string, string>({
  max: 500,
  ttl: 0,
});

export function clearGitCaches(): void {
  gitLogCache.clear();
  fileContentCache.clear();
}
