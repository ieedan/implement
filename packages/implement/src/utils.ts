/** Normalize a thrown value into an `Error`. */
export function toError(error: unknown): Error {
	if (error instanceof Error) return error;
	if (
		typeof error === "object" &&
		error !== null &&
		"message" in error &&
		typeof error.message === "string"
	) {
		return new Error(error.message);
	}
	return new Error(String(error));
}

/**
 * Inserts `nodes` as siblings immediately before `before`. Nodes already in
 * the right place are left alone.
 */
export function syncDomOrder(parent: HTMLElement, nodes: Node[], before: Node | null): void {
	let cursor: Node | null = before;
	for (let i = nodes.length - 1; i >= 0; i--) {
		const node = nodes[i]!;
		if (node.nextSibling !== cursor) {
			parent.insertBefore(node, cursor);
		}
		cursor = node;
	}
}
