import { atom } from 'jotai';

/** The commit SHA of the version currently being viewed. Null = latest. */
export const selectedVersionAtom = atom<string | null>(null);
