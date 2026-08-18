const roots = new Set<() => void>();

/** Tracks a mounted root so `disposeRoots` can unmount it. Returns an untrack function. */
export function registerRoot(unmount: () => void): () => void {
	roots.add(unmount);
	return () => roots.delete(unmount);
}

/**
 * Unmounts every registered `App` root. An app entry passes this to
 * `import.meta.hot.dispose` so the old tree is torn down before the updated
 * entry module re-executes and mounts a fresh one.
 */
export function disposeRoots(): void {
	roots.forEach((unmount) => unmount());
	roots.clear();
}
