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

/** The `file:line:column` of the first frame in `stack`, without its function name. */
export function frameLocation(stack: string | undefined): string | undefined {
	const frame = stack?.split("\n")[0]?.trim();
	if (!frame) return undefined;
	// v8: `at name (file:line:col)` or `at file:line:col`
	const parenthesized = /\((.+)\)$/.exec(frame);
	if (parenthesized) return parenthesized[1];
	// spidermonkey/javascriptcore: `name@file:line:col`
	const at = frame.lastIndexOf("@");
	if (at !== -1) return frame.slice(at + 1);
	return frame.replace(/^at\s+/, "");
}

/** The frames of `stack` below its `Error` header line. */
function framesOf(stack: string | undefined): string[] {
	return stack ? stack.split("\n").slice(1) : [];
}

/**
 * Where core's own modules live, read from this file's own frame at load. Frames
 * are matched against this directory rather than bare file names so an app's
 * `context.ts` is never mistaken for core's; a bundle that no longer ships those
 * names simply matches nothing and keeps every frame.
 */
const coreDirectory = ((): string | undefined => {
	const file = frameLocation(framesOf(new Error().stack).join("\n"))?.replace(/:\d+:\d+$/, "");
	const slash = file?.lastIndexOf("/") ?? -1;
	return slash === -1 ? undefined : file!.slice(0, slash + 1);
})();

/**
 * The frames above core's own, so the first line is the code that called in.
 * `modules` names the core files to trim off the top; this file's own frame
 * always goes with them.
 */
export function captureStack(modules: string[]): string | undefined {
	const frames = framesOf(new Error().stack);
	if (frames.length === 0 || !coreDirectory) return frames.join("\n") || undefined;
	const directory = coreDirectory.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const internal = new RegExp(`${directory}(?:${["utils", ...modules].join("|")})\\.[cm]?[jt]s`);
	while (frames.length > 0 && internal.test(frames[0]!)) frames.shift();
	return frames.length > 0 ? frames.join("\n") : undefined;
}
